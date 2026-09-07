import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const SESSION_METADATA_DIR = path.join(os.homedir(), '.operator-state', 'session-metadata');

function readSessionMetadata(sessionId: string): { name?: string } {
  try {
    const metaPath = path.join(SESSION_METADATA_DIR, `${sessionId}.json`);
    const content = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    return { name: content.name };
  } catch {
    return {};
  }
}

export interface SessionMeta {
  id: string;
  projectDir: string;
  projectLabel: string;
  filePath: string;
  lastModified: string;
  sizeBytes: number;
  preview: string; // first user message, truncated
  sessionName?: string; // custom name if user renamed it (cockpit's own rename)
  aiTitle?: string; // custom-title or Claude-generated ai-title from the transcript itself
  agentId?: string; // agent ID if known
}

// Fallback only — the directory-name encoding replaces every "/" in the cwd
// with "-", which is ambiguous whenever the real path also contains dashes
// (e.g. "projects/operator-cockpit"). Used only when no line in the transcript
// carries a `cwd` field to read the real path from directly.
function projectLabel(dirName: string): string {
  const decoded = dirName
    .replace(/^[A-Z]--Users-[^-]+-/, '') // strip drive + user prefix (Windows encoding)
    .replace(/^-/, '') // strip leading "-" from the encoded absolute path
    .replace(/-/g, '/');
  if (!decoded || decoded === dirName) return dirName;
  const parts = decoded.split('/').filter(Boolean);
  if (parts.length === 0) return '~';
  return parts.slice(-2).join('/') || parts[0];
}

// Real project name, read from the transcript's own `cwd` field rather than
// decoded from the directory name — reliable even when the project path
// itself contains dashes.
function labelFromCwd(cwd: string | undefined, dirName: string): string {
  if (!cwd) return projectLabel(dirName);
  if (cwd === os.homedir()) return '~';
  return path.basename(cwd) || projectLabel(dirName);
}

function readSessionInfo(filePath: string): { preview: string; cwd?: string; aiTitle?: string } {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);

    // Forward pass: earliest cwd and first real user message (the preview).
    let preview = '';
    let cwd: string | undefined;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (!cwd && typeof entry.cwd === 'string') cwd = entry.cwd;
        if (!preview && entry.type === 'user' && entry.message?.content) {
          const text = typeof entry.message.content === 'string'
            ? entry.message.content
            : (Array.isArray(entry.message.content)
                ? entry.message.content.find((b: { type: string }) => b.type === 'text')?.text ?? ''
                : '');
          if (text.trim()) preview = text.slice(0, 120);
        }
        if (preview && cwd) break;
      } catch { /* skip */ }
    }

    // Backward pass: the CLI rewrites custom-title/ai-title entries as a
    // conversation evolves, so the most recent one (scanning from the end) is
    // the accurate title — an early one can describe a session that's since
    // moved on to something else. custom-title (explicitly set in the CLI)
    // outranks ai-title (auto-generated).
    let customTitle: string | undefined;
    let aiTitle: string | undefined;
    for (let i = lines.length - 1; i >= 0 && !(customTitle && aiTitle); i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (!customTitle && entry.type === 'custom-title' && typeof entry.customTitle === 'string') {
          customTitle = entry.customTitle;
        }
        if (!aiTitle && entry.type === 'ai-title' && typeof entry.aiTitle === 'string') {
          aiTitle = entry.aiTitle;
        }
      } catch { /* skip */ }
    }

    return { preview, cwd, aiTitle: customTitle || aiTitle };
  } catch {
    return { preview: '' };
  }
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
            const sessionId = file.replace('.jsonl', '');
            const metadata = readSessionMetadata(sessionId);
            const { preview, cwd, aiTitle } = readSessionInfo(filePath);
            sessions.push({
              id: sessionId,
              projectDir: dirName,
              projectLabel: labelFromCwd(cwd, dirName),
              filePath,
              lastModified: fstat.mtime.toISOString(),
              sizeBytes: fstat.size,
              preview,
              sessionName: metadata.name,
              aiTitle,
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
