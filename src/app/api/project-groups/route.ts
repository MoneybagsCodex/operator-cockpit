import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Deliberately separate from ~/.operator-state/projects/ (an older, unrelated
// ops-dashboard concept — single assignedAgent, priority/status/blockers —
// that isn't wired into the live UI). A ProjectGroup pins specific terminal
// threads to a stable, named, colored TerminalGroup so relaunching it resumes
// the exact same conversations instead of starting fresh ones.
const GROUPS_DIR = path.join(os.homedir(), '.operator-state', 'project-groups');

export interface ProjectGroupMember {
  pinnedSid: string; // the underlying claude/hermes session id — resume target
  label: string;
}

export interface ProjectGroup {
  id: string; // stable slug — also used as the terminal groupId, prefixed "project:"
  name: string;
  color: string;
  direction: 'vertical' | 'horizontal';
  members: ProjectGroupMember[];
  createdAt: string;
  updatedAt: string;
}

function readAll(): ProjectGroup[] {
  try {
    if (!fs.existsSync(GROUPS_DIR)) return [];
    return fs.readdirSync(GROUPS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try { return JSON.parse(fs.readFileSync(path.join(GROUPS_DIR, f), 'utf-8')) as ProjectGroup; }
        catch { return null; }
      })
      .filter((g): g is ProjectGroup => g !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function GET() {
  return NextResponse.json({ groups: readAll() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, color, direction, members } = body as {
      name: string; color: string; direction: 'vertical' | 'horizontal'; members: ProjectGroupMember[];
    };
    if (!name || !color || !direction || !Array.isArray(members) || members.length === 0) {
      return NextResponse.json({ error: 'Missing name, color, direction, or members' }, { status: 400 });
    }

    fs.mkdirSync(GROUPS_DIR, { recursive: true });

    // Slugify the name into a stable id; disambiguate on collision with existing files.
    const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
    let id = base;
    let n = 2;
    while (fs.existsSync(path.join(GROUPS_DIR, `${id}.json`))) { id = `${base}-${n}`; n++; }

    const now = new Date().toISOString();
    const group: ProjectGroup = { id, name, color, direction, members, createdAt: now, updatedAt: now };
    fs.writeFileSync(path.join(GROUPS_DIR, `${id}.json`), JSON.stringify(group, null, 2));
    console.log(`[API] Created project group: ${id} (${members.length} members)`);

    return NextResponse.json({ ok: true, group });
  } catch (err) {
    console.error('[API] Failed to create project group:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
