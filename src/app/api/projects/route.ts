import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// User's local project workspaces live under ~/claude/projects
const ROOT = path.join(os.homedir(), 'claude', 'projects');
// A folder is a "project" if it carries one of these markers.
const MARKERS = ['package.json', 'CLAUDE.md', '.git', 'pyproject.toml', 'go.mod'];

function isProject(dir: string): boolean {
  return MARKERS.some((m) => {
    try { return fs.existsSync(path.join(dir, m)); } catch { return false; }
  });
}

interface ProjectDir {
  name: string; // display name (may be "group/app")
  path: string; // absolute workDir
}

export async function GET() {
  const out: ProjectDir[] = [];
  try {
    if (!fs.existsSync(ROOT)) return NextResponse.json({ projects: [] });
    for (const name of fs.readdirSync(ROOT)) {
      const p = path.join(ROOT, name);
      let st: fs.Stats;
      try { st = fs.statSync(p); } catch { continue; }
      if (!st.isDirectory()) continue;

      if (isProject(p)) {
        out.push({ name, path: p });
      } else {
        // One level deeper for container folders (e.g. "group/…")
        try {
          for (const sub of fs.readdirSync(p)) {
            const sp = path.join(p, sub);
            try {
              if (fs.statSync(sp).isDirectory() && isProject(sp)) out.push({ name: `${name}/${sub}`, path: sp });
            } catch { /* skip */ }
          }
        } catch { /* not readable */ }
      }
    }
  } catch { /* root unreadable */ }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ projects: out });
}
