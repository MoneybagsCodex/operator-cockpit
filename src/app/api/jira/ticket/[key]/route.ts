import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATE_DIR = process.env.OPERATOR_STATE_DIR || path.join(os.homedir(), '.operator-state');

// Flatten Atlassian Document Format (ADF) into readable plain text.
function adfToText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { type?: string; text?: string; content?: unknown[]; attrs?: Record<string, unknown> };
  // Some tickets store escaped "\n" as literal text — turn those into real breaks.
  if (n.type === 'text') return (n.text ?? '').replace(/\\n/g, '\n');
  if (n.type === 'hardBreak') return '\n';
  const inner = Array.isArray(n.content) ? n.content.map(adfToText).join('') : '';
  switch (n.type) {
    case 'paragraph':
    case 'heading':
    case 'blockquote':
    case 'codeBlock':
      return inner + '\n\n';
    case 'listItem':
      return '- ' + inner.trim() + '\n';
    case 'bulletList':
    case 'orderedList':
      return inner;
    default:
      return inner;
  }
}

interface JiraComment {
  author?: { displayName?: string };
  created?: string;
  body?: unknown;
}

export async function GET(_req: NextRequest, { params }: { params: { key: string } }) {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_TOKEN;
  const baseUrl = process.env.JIRA_BASE_URL || 'https://your-domain.atlassian.net';
  const key = params.key;

  if (!email || !token) {
    return NextResponse.json({ ok: false, error: 'JIRA_EMAIL and JIRA_TOKEN required in .env.local' }, { status: 503 });
  }
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}`, Accept: 'application/json' };

  try {
    const res = await fetch(`${baseUrl}/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,description,status,assignee,comment`, { headers });
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ ok: false, error: 'Jira token expired or invalid — refresh JIRA_TOKEN in .env.local' }, { status: 401 });
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return NextResponse.json({ ok: false, error: `Jira ${res.status}${body ? ': ' + body.slice(0, 160) : ''}` }, { status: 502 });
    }
    const issue = await res.json() as {
      fields: {
        summary?: string;
        status?: { name?: string };
        assignee?: { displayName?: string };
        description?: unknown;
        comment?: { comments?: JiraComment[] };
      };
    };
    const f = issue.fields ?? {};
    const summary = f.summary ?? '';
    const description = (f.description ? adfToText(f.description) : '').trim() || '(no description)';
    const comments = f.comment?.comments ?? [];

    // Build the brief
    const lines: string[] = [];
    lines.push(`# ${key} — ${summary}`);
    lines.push(`${baseUrl}/browse/${key}`);
    lines.push('');
    lines.push(`Status: ${f.status?.name ?? '—'}   Assignee: ${f.assignee?.displayName ?? '—'}`);
    lines.push('');
    lines.push('## Description');
    lines.push(description);
    lines.push('');
    lines.push(`## Comments (${comments.length})`);
    if (comments.length === 0) lines.push('(none)');
    for (const c of comments) {
      const who = c.author?.displayName ?? 'Unknown';
      const when = c.created ? new Date(c.created).toISOString().slice(0, 10) : '';
      lines.push('');
      lines.push(`### ${who} — ${when}`);
      lines.push((adfToText(c.body) || '').trim());
    }

    const briefDir = path.join(STATE_DIR, 'jira-briefs');
    fs.mkdirSync(briefDir, { recursive: true });
    const briefPath = path.join(briefDir, `${key}.md`);
    fs.writeFileSync(briefPath, lines.join('\n'), 'utf-8');

    return NextResponse.json({ ok: true, key, summary, path: briefPath, commentCount: comments.length });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
