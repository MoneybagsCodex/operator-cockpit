import { NextRequest, NextResponse } from 'next/server';
import { sendMessage } from '@/src/lib/chat-backends';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { agentId, message } = await req.json();
  if (!agentId || !message?.trim()) {
    return NextResponse.json({ error: 'agentId and message required' }, { status: 400 });
  }
  try {
    const data = await sendMessage(agentId, message);
    return NextResponse.json(data, { status: data.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
