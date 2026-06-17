import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json() as { transcript: string };
    if (!transcript?.trim()) {
      return NextResponse.json({ summary: '' });
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      system: 'You summarize AI agent conversations in one short sentence (under 15 words) describing the TOPIC being discussed — not what was said. Start with what the user and agent are working on. No quotes. No speculation.',
      messages: [{ role: 'user', content: transcript }],
    });

    const summary = (message.content[0] as { text: string }).text.trim();
    return NextResponse.json({ summary });
  } catch (err) {
    console.error('summarize error', err);
    return NextResponse.json({ summary: '' }, { status: 500 });
  }
}
