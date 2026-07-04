import { NextRequest, NextResponse } from 'next/server';
import { sendMessage } from '@/src/lib/chat-backends';
import { appendChat } from '@/src/lib/state';
import { ChatMessage } from '@/src/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Simple in-memory rate limiter: max 10 requests per minute per IP
const rateLimit = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= 10) return true;
  entry.count++;
  return false;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { agentId, message } = await req.json();
  if (!agentId || !message?.trim()) {
    return NextResponse.json({ error: 'agentId and message required' }, { status: 400 });
  }

  // Persist the user's message so it shows in the panel immediately (via SSE).
  try {
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      projectId: agentId,
      sender: 'user',
      message,
      timestamp: new Date(),
      type: 'message',
    };
    appendChat(agentId, userMsg);
  } catch { /* non-fatal */ }

  try {
    const data = await sendMessage(agentId, message);

    // Persist the reply so it renders in the panel (the bridge returns it over HTTP only).
    if (data.ok && data.reply) {
      try {
        const reply: ChatMessage = {
          id: `a-${Date.now()}`,
          projectId: agentId,
          sender: 'agent',
          agentName: agentId,
          message: data.reply,
          timestamp: new Date(),
          type: 'message',
        };
        appendChat(agentId, reply);
      } catch { /* non-fatal */ }
    }

    return NextResponse.json(data, { status: data.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
