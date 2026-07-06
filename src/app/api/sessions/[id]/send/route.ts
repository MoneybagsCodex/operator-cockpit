import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const BRIDGE_URL = process.env.COCKPIT_BRIDGE_URL?.replace(/\/send$/, '') || 'http://127.0.0.1:3002';

function findSessionFile(sessionId: string): string | null {
  try {
    for (const dir of fs.readdirSync(CLAUDE_PROJECTS_DIR)) {
      const candidate = path.join(CLAUDE_PROJECTS_DIR, dir, `${sessionId}.jsonl`);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch { /* ignore */ }
  return null;
}

// Pull the working directory the session was running in (from its first entry)
function sessionCwd(filePath: string): string | undefined {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.cwd) return entry.cwd as string;
      } catch { /* skip */ }
    }
  } catch { /* unreadable */ }
  return undefined;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id;
  const filePath = findSessionFile(sessionId);
  if (!filePath) {
    return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
  }

  let message: string;
  try {
    ({ message } = await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }
  if (!message?.trim()) {
    return NextResponse.json({ ok: false, error: 'message required' }, { status: 400 });
  }

  const workDir = sessionCwd(filePath);

  let res: Response;
  try {
    res = await fetch(`${BRIDGE_URL}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, workDir, message }),
      signal: AbortSignal.timeout(310_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      return NextResponse.json(
        { ok: false, error: 'Bridge server is not running. Start it with: npm run dev:all' },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  const data = await res.json().catch(() => ({ ok: false, error: `Bridge HTTP ${res.status}` }));
  return NextResponse.json(data, { status: res.status });
}
