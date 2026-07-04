import { NextRequest, NextResponse } from 'next/server';
import { readEvents, writeEvent } from '@/src/lib/state';
import { AgentEvent } from '@/src/types';

export async function GET() {
  const events = readEvents();
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as AgentEvent;

  if (!body.id || !body.agentId || !body.title) {
    return NextResponse.json({ error: 'Missing required fields: id, agentId, title' }, { status: 400 });
  }

  writeEvent({ ...body, timestamp: body.timestamp || new Date() });
  return NextResponse.json({ ok: true, id: body.id }, { status: 201 });
}
