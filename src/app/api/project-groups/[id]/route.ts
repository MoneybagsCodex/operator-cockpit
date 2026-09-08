import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { ProjectGroup } from '../route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GROUPS_DIR = path.join(os.homedir(), '.operator-state', 'project-groups');

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const file = path.join(GROUPS_DIR, `${id}.json`);
    if (!fs.existsSync(file)) {
      return NextResponse.json({ error: 'Project group not found' }, { status: 404 });
    }
    const existing = JSON.parse(fs.readFileSync(file, 'utf-8')) as ProjectGroup;
    const patch = await req.json();
    // Only these fields are ever patched — id/createdAt are immutable, members
    // are replaced wholesale (not merged) since callers always send the full list.
    const next: ProjectGroup = {
      ...existing,
      name: patch.name ?? existing.name,
      color: patch.color ?? existing.color,
      direction: patch.direction ?? existing.direction,
      members: patch.members ?? existing.members,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(file, JSON.stringify(next, null, 2));
    return NextResponse.json({ ok: true, group: next });
  } catch (err) {
    console.error(`[API] Failed to update project group ${id}:`, err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const file = path.join(GROUPS_DIR, `${id}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[API] Failed to delete project group ${id}:`, err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
