import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

export interface SessionMeta {
  id: string;
  projectDir: string;
  projectLabel: string;
  filePath: string;
  lastModified: string;
  sizeBytes: number;
  preview: string; // first user message, truncated
}

function projectLabel(dirName: string): string {
  // C--Users-me-projects-my-app → my-app
  const decoded = dirName
    .replace(/^[A-Z]--Users-[^-]+-/, '') // strip drive + user prefix
    .replace(/-/g, '/');
  if (!decoded || decoded === dirName) return dirName;
  const parts = decoded.split('/').filter(Boolean);
  if (parts.length === 0) return '~';
  return parts.slice(-2).join('/') || parts[0];
}

function readPreview(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'user' && entry.message?.content) {
          const text = typeof entry.message.content === 'string'
            ? entry.message.content
            : (Array.isArray(entry.message.content)
                ? entry.message.content.find((b: { type: string }) => b.type === 'text')?.text ?? ''
                : '');
          if (text.trim()) return text.slice(0, 120);
        }
      } catch { /* skip */ }
    }
  } catch { /* unreadable */ }
  return '';
}

export async function GET() {
  try {
    if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) {
      return NextResponse.json({ sessions: [] });
    }

    const sessions: SessionMeta[] = [];
    const projectDirs = fs.readdirSync(CLAUDE_PROJECTS_DIR);

    for (const dirName of projectDirs) {
      const dirPath = path.join(CLAUDE_PROJECTS_DIR, dirName);
      try {
        const stat = fs.statSync(dirPath);
        if (!stat.isDirectory()) continue;

        const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.jsonl'));
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          try {
            const fstat = fs.statSync(filePath);
            if (fstat.size < 100) continue; // skip empty/metadata-only files
            sessions.push({
              id: file.replace('.jsonl', ''),
              projectDir: dirName,
              projectLabel: projectLabel(dirName),
              filePath,
              lastModified: fstat.mtime.toISOString(),
              sizeBytes: fstat.size,
              preview: readPreview(filePath),
            });
          } catch { /* skip unreadable */ }
        }
      } catch { /* skip unreadable dirs */ }
    }

    // Sort newest first
    sessions.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    return NextResponse.json({ sessions });
  } catch (err) {
    return NextResponse.json({ error: String(err), sessions: [] }, { status: 500 });
  }
}
