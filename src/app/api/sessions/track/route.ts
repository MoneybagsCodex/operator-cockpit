import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

const STATE_DIR = process.env.OPERATOR_STATE_DIR || path.join(os.homedir(), '.operator-state');
const ACTIVE_SESSIONS_FILE = path.join(STATE_DIR, 'active-sessions.json');

interface ActiveSession {
  sid: string;
  label: string;
  mode: 'launch' | 'resume';
  createdAt: string;
  lastSeen: string;
}

function readActiveSessions(): ActiveSession[] {
  try {
    const data = fs.readFileSync(ACTIVE_SESSIONS_FILE, 'utf-8');
    return JSON.parse(data) as ActiveSession[];
  } catch {
    return [];
  }
}

function writeActiveSessions(sessions: ActiveSession[]): void {
  fs.mkdirSync(path.dirname(ACTIVE_SESSIONS_FILE), { recursive: true });
  fs.writeFileSync(ACTIVE_SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

export async function GET() {
  const sessions = readActiveSessions();
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const { action, sid, label, mode } = await req.json() as {
    action: 'register' | 'unregister' | 'heartbeat';
    sid?: string;
    label?: string;
    mode?: 'launch' | 'resume';
  };

  let sessions = readActiveSessions();

  if (action === 'register' && sid && label && mode) {
    // Add or update session
    const existing = sessions.findIndex((s) => s.sid === sid);
    const session: ActiveSession = {
      sid,
      label,
      mode,
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };
    if (existing >= 0) {
      sessions[existing] = session;
    } else {
      sessions.push(session);
    }
    console.log(`[sessions-track] Registered: ${sid} (${label})`);
  } else if (action === 'heartbeat' && sid) {
    // Update lastSeen
    const session = sessions.find((s) => s.sid === sid);
    if (session) {
      session.lastSeen = new Date().toISOString();
    }
  } else if (action === 'unregister' && sid) {
    // Remove session after 15+ minutes idle
    sessions = sessions.filter((s) => s.sid !== sid);
    console.log(`[sessions-track] Unregistered: ${sid}`);
  }

  writeActiveSessions(sessions);
  return NextResponse.json({ ok: true, sessions });
}
