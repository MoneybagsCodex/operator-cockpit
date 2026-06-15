import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BRIDGE_URL = process.env.COCKPIT_BRIDGE_URL || 'http://127.0.0.1:3001/send';

export async function POST(req: NextRequest) {
  const { agentId, message } = await req.json();
  if (!agentId || !message?.trim()) {
    return NextResponse.json({ error: 'agentId and message required' }, { status: 400 });
  }

  try {
    const resp = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, message }),
      signal: AbortSignal.timeout(120_000),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
