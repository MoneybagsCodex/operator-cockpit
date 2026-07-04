import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ChatMessage } from '@/src/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const MAX_MESSAGES = 300;

function extractUserText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return (content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n')
      .trim();
  }
  return '';
}

function extractAssistantText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return (content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n')
    .trim();
}

function findSessionFile(sessionId: string): string | null {
  try {
    const dirs = fs.readdirSync(CLAUDE_PROJECTS_DIR);
    for (const dir of dirs) {
      const candidate = path.join(CLAUDE_PROJECTS_DIR, dir, `${sessionId}.jsonl`);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch { /* ignore */ }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id;
  const filePath = findSessionFile(sessionId);

  if (!filePath) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);

    const messages: ChatMessage[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        if (entry.type === 'user' && entry.message?.content) {
          const text = extractUserText(entry.message.content);
          if (!text.trim()) continue;
          messages.push({
            id: entry.uuid ?? `user-${messages.length}`,
            projectId: sessionId,
            sender: 'user',
            message: text,
            timestamp: new Date(entry.timestamp ?? Date.now()),
            type: 'message',
          });
        }

        if (entry.type === 'assistant' && entry.message?.content) {
          const text = extractAssistantText(entry.message.content);
          if (!text.trim()) continue;
          messages.push({
            id: entry.uuid ?? `asst-${messages.length}`,
            projectId: sessionId,
            sender: 'agent',
            agentName: 'Claude',
            message: text,
            timestamp: new Date(entry.timestamp ?? Date.now()),
            type: 'message',
          });
        }
      } catch { /* skip malformed lines */ }
    }

    // Return last MAX_MESSAGES — most recent are what matter
    const trimmed = messages.slice(-MAX_MESSAGES);
    const totalCount = messages.length;

    return NextResponse.json({ messages: trimmed, totalCount, sessionId });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
