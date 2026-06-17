import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BRIDGE_URL = process.env.COCKPIT_BRIDGE_URL?.replace('/send', '') || 'http://127.0.0.1:3001';

// POST { agentId?, model } — omit agentId to change all agents
export async function POST(req: NextRequest) {
  const { agentId, model } = await req.json();
  if (!model?.trim()) {
    return NextResponse.json({ error: 'model required' }, { status: 400 });
  }
  try {
    const resp = await fetch(`${BRIDGE_URL}/model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, model }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
