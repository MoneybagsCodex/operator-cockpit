/**
 * Embedded terminal server — gives the cockpit real, interactive `claude`
 * sessions in the browser (full slash commands, MCP, live streaming).
 *
 * Attaches a WebSocket server at ws://127.0.0.1:<bridge>/terminal to the
 * existing bridge HTTP server. Each connection is bound to a stable session id
 * (`sid`). The underlying `claude` process runs in a pseudo-terminal (node-pty)
 * and OUTLIVES the WebSocket: a dropped/refreshed connection re-attaches to the
 * same live agent and replays its scrollback, so no conversation context is
 * lost. If the bridge itself restarted (the pty is gone), we fall back to
 * `claude --resume <sid>` to reload the conversation from disk.
 *
 * Connect with query params:
 *   ?sid=<uuid>        — stable session id (client-generated; the linchpin)
 *   ?mode=launch&agent=<agentId>   — fresh agent in the agent's workDir
 *   ?cwd=<path>        — explicit working dir (project-folder launch)
 *   ?prompt=<text>     — optional seed task for a fresh launch
 *   ?label=<name>      — display/attribution label
 *
 * Behaviour by state (auto-detected, `mode` is only a hint):
 *   live pty for sid exists  → re-attach + replay buffer
 *   session file on disk      → `claude --resume <sid>`
 *   neither                   → `claude --session-id <sid> [prompt]` (fresh)
 */
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as pty from 'node-pty';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { isAutoApprovedForAgent, readApprovals } from '../lib/state';

interface AgentConfig {
  id: string;
  workDir?: string;
}

/** A running agent, kept alive independently of any browser connection. */
interface Session {
  term: pty.IPty;
  buffer: string;                       // recent output, replayed on re-attach
  ws: WebSocket | null;                 // currently attached browser (if any)
  detachTimer: ReturnType<typeof setTimeout> | null;
  cols: number;
  rows: number;
  startedAt: number;                    // unix timestamp when session was created
  agentId: string;                      // for approval tracking
  approvalWatcher?: () => void;         // cleanup function for approval poller
  watchedApprovals: Set<string>;        // already-seen approval IDs to avoid duplicate handling
  metrics: {
    totalLines: number;                 // newline count in all output
    totalChars: number;                 // total characters output
    errorCount: number;                 // lines matching error patterns
  };
}

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const CLAUDE_BIN_DIR = path.join(os.homedir(), '.local', 'bin');

// Live agents, keyed by stable session id. Survives browser disconnects.
const sessions = new Map<string, Session>();
const MAX_BUFFER = 200_000;              // ~200KB scrollback kept for replay
const DETACH_GRACE_MS = 15 * 60 * 1000;  // keep an agent alive 15m after a disconnect

// Export metrics for all sessions (called by bridge server)
export function getSessionMetrics(): Record<string, unknown> {
  const metrics: Record<string, unknown> = {};
  for (const [sid, session] of sessions) {
    const uptime = Date.now() - session.startedAt;
    const tokenEstimate = Math.ceil(session.metrics.totalChars / 4); // rough estimate: 1 token ≈ 4 chars
    metrics[sid] = {
      pid: session.term.pid,
      uptime,
      uptimeSeconds: Math.floor(uptime / 1000),
      lines: session.metrics.totalLines,
      chars: session.metrics.totalChars,
      tokens: tokenEstimate,
      errors: session.metrics.errorCount,
    };
  }
  return { sessions: metrics };
}

function loadAgentConfig(stateDir: string, agentId: string): AgentConfig | null {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(stateDir, 'agent-configs', `${agentId}.json`), 'utf-8')
    ) as AgentConfig;
  } catch {
    return null;
  }
}

function findSessionFile(sessionId: string): string | null {
  try {
    for (const dir of fs.readdirSync(CLAUDE_PROJECTS_DIR)) {
      const candidate = path.join(CLAUDE_PROJECTS_DIR, dir, `${sessionId}.jsonl`);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch { /* ignore */ }
  return null;
}

function sessionCwd(filePath: string): string | undefined {
  try {
    for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.cwd) return entry.cwd as string;
      } catch { /* skip */ }
    }
  } catch { /* unreadable */ }
  return undefined;
}

// Ensure claude's install dir + System32 are on PATH so the PTY can find it,
// and tag the session so the approval-bridge hook activates + attributes correctly.
function ptyEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
  const env = { ...process.env, ...(extra ?? {}) };
  const pathExtra = process.platform === 'win32'
    ? [CLAUDE_BIN_DIR, 'C:\\Windows\\System32']
    : [CLAUDE_BIN_DIR];
  env.PATH = [...pathExtra, process.env.PATH ?? ''].filter(Boolean).join(path.delimiter);
  // Route this terminal's risky actions through the cockpit approval gate.
  env.COCKPIT_APPROVAL_BRIDGE = '1';
  // Force HOME/USERPROFILE to the real Windows home. If the bridge was launched
  // from Git Bash, HOME is a POSIX path ("/c/Users/…") that the spawned `claude`
  // can't resolve → it looks for ~/.claude/projects in the wrong place and reports
  // "Session not found" on every --resume. os.homedir() is always the correct
  // Windows path, so pin both regardless of how the bridge process was started.
  env.HOME = os.homedir();
  env.USERPROFILE = os.homedir();
  return env;
}

/**
 * Watch for approval decisions for a specific agent and handle auto-approve.
 * Writes decisions to the PTY's STDIN so interactive prompts can be answered.
 */
function setupApprovalBridge(session: Session): void {
  const agentId = session.agentId;
  const pollInterval = 500; // check every 500ms for new approvals

  const pollApprovals = () => {
    try {
      const approvals = readApprovals('all');
      const isAutoApproved = isAutoApprovedForAgent(agentId);

      for (const approval of approvals) {
        if (approval.agentId !== agentId) continue;
        if (session.watchedApprovals.has(approval.id)) continue;
        session.watchedApprovals.add(approval.id);

        // If approval is already decided and auto-approve is on, handle it
        if (isAutoApproved && approval.status !== 'pending') {
          const response = approval.status === 'approved' ? 'y\n' : 'n\n';
          try {
            session.term.write(response);
            console.log(
              `[approval-bridge] Auto-approved for ${agentId}: ${approval.id} → ${response.trim()}`
            );
          } catch (err) {
            console.warn(`[approval-bridge] Failed to write to PTY for ${agentId}:`, err);
          }
        }
      }
    } catch (err) {
      console.warn(`[approval-bridge] Error polling approvals for ${agentId}:`, err);
    }
  };

  const timer = setInterval(pollApprovals, pollInterval);
  session.approvalWatcher = () => clearInterval(timer);
  pollApprovals(); // initial check
}

/**
 * Stop watching approvals for a session.
 */
function cleanupApprovalBridge(session: Session): void {
  if (session.approvalWatcher) {
    session.approvalWatcher();
    session.approvalWatcher = undefined;
  }
}

/**
 * Bind a browser WebSocket to a live session: cancel any pending shutdown,
 * replace a stale client, resize to the new viewport, replay scrollback, and
 * wire input/close. The pty's onData/onExit are wired once (at spawn) and keep
 * pushing to whatever `session.ws` currently is.
 */
function attachClient(
  key: string,
  session: Session,
  ws: WebSocket,
  cols: number,
  rows: number,
  replay: boolean
): void {
  // Cancel a pending grace-period shutdown from a previous disconnect.
  if (session.detachTimer) { clearTimeout(session.detachTimer); session.detachTimer = null; }
  // If another browser was attached (e.g. a duplicate tab), drop it.
  if (session.ws && session.ws !== ws) { try { session.ws.close(); } catch { /* ignore */ } }
  session.ws = ws;

  // Match the pty to the (possibly new) viewport size.
  if (cols && rows && (cols !== session.cols || rows !== session.rows)) {
    try { session.term.resize(cols, rows); session.cols = cols; session.rows = rows; } catch { /* ignore */ }
  }

  // Redraw prior output so a reconnected browser shows the conversation history.
  if (replay && session.buffer) { try { ws.send(session.buffer); } catch { /* ignore */ } }

  ws.on('message', (raw: Buffer) => {
    let msg: { type?: string; data?: string; cols?: number; rows?: number } | null = null;
    const text = raw.toString();
    try { msg = JSON.parse(text); } catch { /* treat as raw input */ }

    if (msg && msg.type === 'resize' && msg.cols && msg.rows) {
      try { session.term.resize(msg.cols, msg.rows); session.cols = msg.cols; session.rows = msg.rows; } catch { /* ignore */ }
    } else if (msg && msg.type === 'input' && typeof msg.data === 'string') {
      session.term.write(msg.data);
    } else {
      session.term.write(text); // raw keystrokes
    }
  });

  ws.on('close', () => {
    if (session.ws !== ws) return; // a newer client already took over
    session.ws = null;
    // Keep the agent alive so a refresh/blip can re-attach with full context;
    // only kill it if nobody comes back within the grace window.
    session.detachTimer = setTimeout(() => {
      if (session.ws) return; // reattached in time
      try { session.term.kill(); } catch { /* already gone */ }
      sessions.delete(key);
      console.log(`[terminal] killed ${key} after ${DETACH_GRACE_MS / 1000}s idle`);
    }, DETACH_GRACE_MS);
    console.log(`[terminal] detached ${key} — keeping alive ${DETACH_GRACE_MS / 1000}s`);
  });
}

export function attachTerminalServer(server: Server, stateDir: string): void {
  const wss = new WebSocketServer({
    server,
    path: '/terminal',
    verifyClient: ({ origin }: { origin?: string }) =>
      !origin || /^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin),
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const cols = parseInt(url.searchParams.get('cols') ?? '80', 10) || 80;
    const rows = parseInt(url.searchParams.get('rows') ?? '24', 10) || 24;

    // Stable session id owned by the client. `session=` kept for back-compat.
    const key = url.searchParams.get('sid') || url.searchParams.get('session') || randomUUID();

    // 1) Re-attach to a still-running agent (survived a brief disconnect/refresh).
    const existing = sessions.get(key);
    if (existing) {
      attachClient(key, existing, ws, cols, rows, /* replay */ true);
      console.log(`[terminal] ✓ REATTACHED ${key} (pid ${existing.term.pid})`);
      return;
    }

    // 2) Not live — resume from disk if the conversation exists, else fresh launch.
    const sessionFile = findSessionFile(key);
    let cwd = os.homedir();
    const claudeArgs: string[] = [];
    let agentLabel = url.searchParams.get('label') || '';

    if (sessionFile) {
      cwd = sessionCwd(sessionFile) ?? os.homedir();
      claudeArgs.push('--resume', key);
      if (!agentLabel) agentLabel = key.slice(0, 8);
      console.log(`[terminal] ✓ RESUME from disk: ${key} @ ${sessionFile}`);
    } else {
      console.log(`[terminal] ✗ FRESH: ${key} (no session file found in ${CLAUDE_PROJECTS_DIR})`);
      // Fresh — PIN the session id so this conversation can always be resumed later.
      const agentId = url.searchParams.get('agent') ?? '';
      const explicitCwd = url.searchParams.get('cwd');
      const config = agentId ? loadAgentConfig(stateDir, agentId) : null;
      if (explicitCwd && fs.existsSync(explicitCwd)) {
        cwd = explicitCwd; // launched from a project-folder button
      } else {
        cwd = config?.workDir && fs.existsSync(config.workDir) ? config.workDir : os.homedir();
      }
      claudeArgs.push('--session-id', key);
      // Optional seed prompt (e.g. from a Jira ticket) so claude starts on this task.
      const prompt = url.searchParams.get('prompt');
      if (prompt) {
        const safe = prompt.replace(/"/g, "'").slice(0, 800).trim();
        if (safe) claudeArgs.push(safe);
      }
      if (!agentLabel) agentLabel = agentId || 'Cockpit agent';
    }

    // Diagnostic: exactly how this connection resolved (helps debug "Session not
    // found" on resume — did findSessionFile locate the file? which cwd/args?).
    console.log(
      `[terminal] resolve ${key}: sessionFile=${sessionFile ?? 'NONE'} ` +
      `→ ${sessionFile ? 'RESUME' : 'FRESH'} cwd=${cwd} args=${JSON.stringify(claudeArgs)} ` +
      `homedir=${os.homedir()} projectsDir=${CLAUDE_PROJECTS_DIR}`
    );
    console.log(
      `[terminal] connection details: mode=${url.searchParams.get('mode')} ` +
      `label="${url.searchParams.get('label')}" agent="${url.searchParams.get('agent')}" ` +
      `cols=${cols} rows=${rows}`
    );

    // Spawn claude inside cmd.exe so PATH/.cmd resolution works on Windows.
    const isWin = process.platform === 'win32';
    const file = isWin ? 'cmd.exe' : 'claude';
    const args = isWin ? ['/c', 'claude', ...claudeArgs] : claudeArgs;

    let term: pty.IPty;
    try {
      term = pty.spawn(file, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        // CLAUDE_SESSION_ID = the pinned id, so approvals + heartbeat attribute
        // to the SAME session claude itself uses.
        env: ptyEnv({ CLAUDE_SESSION_ID: key, CLAUDE_AGENT_NAME: agentLabel }),
      });
    } catch (err) {
      ws.send(`\r\n\x1b[31mFailed to start terminal: ${String(err)}\x1b[0m\r\n`);
      ws.close();
      return;
    }

    // Agent ID for approval tracking: use session label or session id
    const agentId = agentLabel || `cockpit-${key.slice(0, 8)}`;

    const session: Session = {
      term,
      buffer: '',
      ws: null,
      detachTimer: null,
      cols,
      rows,
      startedAt: Date.now(),
      agentId,
      watchedApprovals: new Set(),
      metrics: { totalLines: 0, totalChars: 0, errorCount: 0 },
    };
    sessions.set(key, session);
    console.log(`[terminal] spawned ${key} (${sessionFile ? 'resume' : 'fresh'}) in ${cwd} — pid ${term.pid} agentId=${agentId}`);

    // Set up approval bridge so auto-approve works for this session
    setupApprovalBridge(session);

    // Wire the pty ONCE. It pushes to whatever browser is currently attached and
    // keeps a rolling buffer for replay after a reconnect.
    term.onData((data: string) => {
      session.buffer += data;
      if (session.buffer.length > MAX_BUFFER) session.buffer = session.buffer.slice(-MAX_BUFFER);

      // Update metrics
      session.metrics.totalChars += data.length;
      session.metrics.totalLines += (data.match(/\n/g) || []).length;
      if (/ERROR|error|Exception|exception|Failed|failed|✗|✘/.test(data)) {
        session.metrics.errorCount += 1;
      }

      // Detect Claude approval prompts and auto-respond if auto-approve is enabled
      if (isAutoApprovedForAgent(session.agentId)) {
        // Match Claude Code approval prompts like:
        // "Do you approve? (y/n)" or "Accept? (y/n)" or "Continue? (yes/no)"
        if (/[Dd]o you (approve|accept|trust|confirm)\?|[Aa]ccept\?|[Cc]ontinue\?|[Yy]es, [Ii] (trust|approve)|bypass permissions\?/i.test(data)) {
          try {
            term.write('y\n');
            console.log(`[approval-bridge] Auto-approved prompt for ${session.agentId}`);
          } catch (err) {
            console.warn(`[approval-bridge] Failed to auto-respond to approval prompt for ${session.agentId}:`, err);
          }
        }
      }

      if (session.ws && session.ws.readyState === session.ws.OPEN) session.ws.send(data);
    });

    term.onExit(({ exitCode }: { exitCode: number }) => {
      if (session.ws && session.ws.readyState === session.ws.OPEN) {
        session.ws.send(`\r\n\x1b[90m[session ended — exit ${exitCode}]\x1b[0m\r\n`);
        try { session.ws.close(); } catch { /* ignore */ }
      }
      if (session.detachTimer) clearTimeout(session.detachTimer);
      cleanupApprovalBridge(session);
      sessions.delete(key);
      console.log(`[terminal] exited ${key} (exit ${exitCode})`);
    });

    attachClient(key, session, ws, cols, rows, /* replay */ false);
  });

  console.log('  Terminal: ws://127.0.0.1 (path /terminal)');
}
