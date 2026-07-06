#!/usr/bin/env npx tsx
/**
 * Operator Cockpit Bridge Server
 *
 * Manages `claude --print` subprocesses per agent so the dashboard can talk to
 * any number of Claude Code sessions from a single terminal tab.
 *
 * POST   /send              { agentId, message } → { ok, reply } | { ok: false, error }
 * GET    /health                                 → { ok, agents, sessions[] }
 * DELETE /session/:agentId                       → { ok, reset } (clears conversation state)
 *
 * Start:
 *   npm run bridge
 *   — or —
 *   npm run dev:all   (dashboard + bridge together)
 */

import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { attachTerminalServer, getSessionMetrics } from './terminal';

const PORT = parseInt(process.env.BRIDGE_PORT ?? '3002', 10);

const STATE_DIR =
  process.env.OPERATOR_STATE_DIR ??
  path.join(require('os').homedir(), '.operator-state');

const AGENT_CONFIGS_DIR = path.join(STATE_DIR, 'agent-configs');
const SESSIONS_FILE = path.join(STATE_DIR, 'bridge-sessions.json');

interface AgentConfig {
  id: string;
  name: string;
  model?: string;
  prompt?: string;
  workDir?: string;
}

interface Session {
  workDir: string;
  hasConversation: boolean;
  config: AgentConfig;
  // The claude session id this agent owns. Captured on first message, then
  // used with --resume so the agent stays in ITS OWN conversation regardless
  // of what else runs in the same working directory.
  claudeSessionId?: string;
}

const sessions = new Map<string, Session>();

// ── Session persistence ───────────────────────────────────────────────────────
// Survives bridge restarts so agents continue existing conversations.

type PersistedSessions = Record<string, { workDir: string; hasConversation: boolean; claudeSessionId?: string }>;

function loadSessions(): void {
  try {
    const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8')) as PersistedSessions;
    for (const [id, s] of Object.entries(raw)) {
      const config = loadConfig(id);
      if (config) {
        sessions.set(id, {
          workDir: s.workDir,
          hasConversation: s.hasConversation,
          config,
          claudeSessionId: s.claudeSessionId,
        });
      }
    }
    if (sessions.size > 0) console.log(`Restored ${sessions.size} session(s).`);
  } catch {
    // First run — no sessions file yet
  }
}

function saveSessions(): void {
  const out: PersistedSessions = {};
  for (const [id, s] of sessions) {
    out[id] = { workDir: s.workDir, hasConversation: s.hasConversation, claudeSessionId: s.claudeSessionId };
  }
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(out, null, 2));
  } catch (err) {
    console.warn('Could not save sessions:', err);
  }
}

// ── Agent config ──────────────────────────────────────────────────────────────

function loadConfig(agentId: string): AgentConfig | null {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(AGENT_CONFIGS_DIR, `${agentId}.json`), 'utf-8')
    ) as AgentConfig;
  } catch {
    return null;
  }
}

// ── Claude runner ─────────────────────────────────────────────────────────────

function runClaude(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', args, {
      cwd,
      env: process.env,
      // Windows requires shell:true to find PATH-installed executables
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        proc.kill();
        reject(new Error('Timeout: claude did not respond within 5 minutes'));
      }
    }, 300_000);

    proc.on('close', (code) => {
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `claude exited with code ${code}`));
    });

    proc.on('error', (err) => {
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Failed to spawn claude: ${(err as Error).message}. Is Claude Code installed and in PATH?`));
    });
  });
}

// ── Agent heartbeat ───────────────────────────────────────────────────────────

function writeHeartbeat(agentId: string, config: AgentConfig, workDir: string, status: 'working' | 'idle'): void {
  try {
    const agentsDir = path.join(STATE_DIR, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    const projectId = path.basename(workDir).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    fs.writeFileSync(
      path.join(agentsDir, `${agentId}.json`),
      JSON.stringify({
        id: agentId,
        name: config.name,
        type: 'bridge',
        status,
        lastHeartbeat: new Date().toISOString(),
        projectId,
        confidenceLevel: null,
      }, null, 2)
    );
  } catch {
    // Non-fatal — dashboard just won't show the agent heartbeat
  }
}

// ── Send handler ──────────────────────────────────────────────────────────────

async function handleSend(
  agentId: string,
  message: string
): Promise<{ ok: boolean; reply?: string; error?: string }> {
  let session = sessions.get(agentId);

  if (!session) {
    const config = loadConfig(agentId);
    if (!config) {
      return {
        ok: false,
        error: `No config found for agent "${agentId}". Create it via the dashboard first.`,
      };
    }
    const workDir = config.workDir ?? process.cwd();
    if (!fs.existsSync(workDir)) {
      return {
        ok: false,
        error: `Working directory not found: "${workDir}". Update the agent's workDir in the dashboard.`,
      };
    }
    session = { workDir, hasConversation: false, config };
    sessions.set(agentId, session);
  }

  // --output-format json so we can capture the session id claude assigns and
  // parse the reply text cleanly.
  const args: string[] = ['--print', '--output-format', 'json'];

  if (session.config.model) {
    args.push('--model', session.config.model);
  }

  // Resume THIS agent's own conversation by id (not directory-based --continue,
  // which collides with other conversations sharing the working directory).
  const isFirstMessage = !session.claudeSessionId;
  if (session.claudeSessionId) {
    args.push('--resume', session.claudeSessionId);
  }

  // On first message, prepend the system prompt so claude treats it as context
  const finalMessage =
    isFirstMessage && session.config.prompt?.trim()
      ? `${session.config.prompt.trim()}\n\n${message}`
      : message;

  args.push(finalMessage);

  writeHeartbeat(agentId, session.config, session.workDir, 'working');

  try {
    const raw = await runClaude(args, session.workDir);

    // Parse the JSON envelope: { result: "<text>", session_id: "<id>", ... }
    let reply = raw;
    try {
      const parsed = JSON.parse(raw) as { result?: string; session_id?: string };
      if (typeof parsed.result === 'string') reply = parsed.result;
      if (parsed.session_id) session.claudeSessionId = parsed.session_id;
    } catch {
      // Not JSON (older claude / error text) — fall back to raw stdout
    }

    session.hasConversation = true;
    saveSessions();
    writeHeartbeat(agentId, session.config, session.workDir, 'idle');
    return { ok: true, reply };
  } catch (err) {
    writeHeartbeat(agentId, session.config, session.workDir, 'idle');
    return { ok: false, error: String(err) };
  }
}

// ── HTTP server ───────────────────────────────────────────────────────────────

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
  });
}

function jsonResponse(res: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = req.url ?? '/';

  // Allow requests from any localhost port (dashboard may be on 3000 or 3001)
  const origin = req.headers.origin ?? '';
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // POST /send
  if (req.method === 'POST' && url === '/send') {
    try {
      const body = await readBody(req);
      const { agentId, message } = JSON.parse(body) as { agentId?: string; message?: string };
      if (!agentId?.trim() || !message?.trim()) {
        return jsonResponse(res, 400, { ok: false, error: 'agentId and message are required' });
      }
      console.log(`[${new Date().toISOString()}] → ${agentId}: ${message.slice(0, 80)}`);
      const result = await handleSend(agentId.trim(), message.trim());
      console.log(`[${new Date().toISOString()}] ← ${agentId}: ${result.ok ? 'ok' : result.error}`);
      return jsonResponse(res, result.ok ? 200 : 502, result);
    } catch (err) {
      return jsonResponse(res, 400, { ok: false, error: String(err) });
    }
  }

  // POST /resume  — continue an EXISTING claude session by its session id
  if (req.method === 'POST' && url === '/resume') {
    try {
      const body = await readBody(req);
      const { sessionId, workDir, message } = JSON.parse(body) as {
        sessionId?: string; workDir?: string; message?: string;
      };
      if (!sessionId?.trim() || !message?.trim()) {
        return jsonResponse(res, 400, { ok: false, error: 'sessionId and message are required' });
      }
      const cwd = workDir && fs.existsSync(workDir) ? workDir : process.cwd();
      console.log(`[${new Date().toISOString()}] ↻ resume ${sessionId}: ${message.slice(0, 80)}`);
      try {
        const reply = await runClaude(['--resume', sessionId.trim(), '--print', message.trim()], cwd);
        return jsonResponse(res, 200, { ok: true, reply });
      } catch (err) {
        return jsonResponse(res, 502, { ok: false, error: String(err) });
      }
    } catch (err) {
      return jsonResponse(res, 400, { ok: false, error: String(err) });
    }
  }

  // GET /health
  if (req.method === 'GET' && url === '/health') {
    return jsonResponse(res, 200, {
      ok: true,
      port: PORT,
      agents: sessions.size,
      sessions: [...sessions.keys()],
    });
  }

  // GET /metrics — return metrics for all active terminal sessions
  if (req.method === 'GET' && url === '/metrics') {
    return jsonResponse(res, 200, getSessionMetrics());
  }

  // DELETE /session/:agentId  — reset conversation (next send starts fresh)
  if (req.method === 'DELETE' && url.startsWith('/session/')) {
    const agentId = decodeURIComponent(url.slice('/session/'.length));
    const existed = sessions.has(agentId);
    sessions.delete(agentId);
    saveSessions();
    console.log(`[bridge] Session reset: ${agentId}`);
    return jsonResponse(res, 200, { ok: true, reset: agentId, existed });
  }

  jsonResponse(res, 404, { error: 'Not found' });
});

// ── Boot ──────────────────────────────────────────────────────────────────────

loadSessions();

// Embedded interactive terminals (node-pty over WebSocket)
attachTerminalServer(server, STATE_DIR);

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n  Bridge already running on :${PORT} — skipping (this instance exits cleanly).\n`);
    process.exit(0);
  }
  console.error('Bridge server error:', err);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('\n  Operator Cockpit Bridge');
  console.log(`  ▶  http://127.0.0.1:${PORT}`);
  console.log(`  State : ${STATE_DIR}`);
  console.log(`  Config: ${AGENT_CONFIGS_DIR}`);
  console.log('\n  POST   /send              { agentId, message }');
  console.log('  GET    /health');
  console.log('  DELETE /session/:agentId  (reset conversation)\n');
});
