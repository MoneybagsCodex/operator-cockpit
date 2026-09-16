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

// Demo ticket content for when JIRA is not configured
const DEMO_TICKET_CONTENT: Record<string, { summary: string; description: string; comments: Array<{ author: string; date: string; body: string }> }> = {
  'PROJ-42': {
    summary: 'Implement auto-approve feature for agent commands',
    description: `## Goal
Implement auto-approval of agent commands in the operator-cockpit to reduce friction when working with trusted agents.

## Requirements
- Add toggle in UI to enable/disable auto-approve per agent or globally
- When enabled, approval queue items are automatically moved to approved status
- Maintain audit trail of auto-approved items
- Allow manual override/rejection even with auto-approve enabled

## Acceptance Criteria
- [ ] Toggle visible in approval queue header
- [ ] Auto-approved items removed from pending queue within 1s
- [ ] State persists across page reload
- [ ] E2E tests pass for all scenarios`,
    comments: [
      { author: 'Josh', date: '2026-09-10', body: 'Setting priority to High — this is blocking daily workflows. Agent commands are safe for trusted agents.' },
      { author: 'OpenClaw', date: '2026-09-12', body: 'Identified the bug: approvals endpoint was always writing to pending status regardless of auto-approve setting. Fix is in review.' },
    ],
  },
  'PROJ-38': {
    summary: 'Add color-coded terminal tabs by project',
    description: `## Goal
Add visual differentiation to terminal tabs based on which project/agent they're running in.

## Design
Use the existing LINK_COLORS palette (already defined in page.tsx) to color-code tabs. Each active agent gets a unique color from the palette.

## Implementation
- Add color prop to TerminalPanel component
- Map agent/project to stable color from palette
- Persist color choice in localStorage for consistency`,
    comments: [
      { author: 'Josh', date: '2026-09-08', body: 'This will help with visual navigation when running 4-5 agents at once.' },
    ],
  },
  'PROJ-51': {
    summary: 'Fix system prompt not applying to spawned agents',
    description: `## Problem
When spinning up a new agent from the cockpit, the system prompt from CLAUDE.md is not being passed to the agent. This causes agents to behave differently than expected.

## Root Cause
Agent creation in the bridge is not reading CLAUDE.md or passing prompt context to the Claude API.

## Solution
1. Read CLAUDE.md from the working directory
2. Parse system prompt from the file
3. Pass to Claude API as system message when creating agent

## Testing
- Spin up agent from cockpit
- Verify it acknowledges the system rules in its first response`,
    comments: [
      { author: 'Josh', date: '2026-09-14', body: 'This is critical for consistency. Every agent should follow the same rules.' },
    ],
  },
};

export async function GET(_req: NextRequest, { params }: { params: { key: string } }) {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_TOKEN;
  const baseUrl = process.env.JIRA_BASE_URL || 'https://your-domain.atlassian.net';
  const key = params.key;

  // Return demo ticket if available and no Jira credentials
  if (!email || !token) {
    const demoTicket = DEMO_TICKET_CONTENT[key];
    if (demoTicket) {
      const lines: string[] = [];
      lines.push(`# ${key} — ${demoTicket.summary}`);
      lines.push('https://jira.example.com/browse/' + key);
      lines.push('');
      lines.push(demoTicket.description);
      lines.push('');
      lines.push(`## Comments (${demoTicket.comments.length})`);
      for (const c of demoTicket.comments) {
        lines.push('');
        lines.push(`### ${c.author} — ${c.date}`);
        lines.push(c.body);
      }

      const briefDir = path.join(STATE_DIR, 'jira-briefs');
      fs.mkdirSync(briefDir, { recursive: true });
      const briefPath = path.join(briefDir, `${key}.md`);
      fs.writeFileSync(briefPath, lines.join('\n'), 'utf-8');

      return NextResponse.json({ ok: true, key, summary: demoTicket.summary, path: briefPath, commentCount: demoTicket.comments.length });
    }
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
