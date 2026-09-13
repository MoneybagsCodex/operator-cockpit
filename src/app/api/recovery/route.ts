import { NextRequest, NextResponse } from 'next/server';
import { readRecoveryRequests, acknowledgeRecovery } from '@/src/lib/state';

// Phase 1 of the usage-limit resilience feature: detect + notify only.
// There is no launch action here — POST just clears the notification.
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') as 'pending' | 'acknowledged' | 'all' | undefined;
  const requests = readRecoveryRequests(status || 'pending');
  return NextResponse.json(requests);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
  }
  const ok = acknowledgeRecovery(body.id);
  if (!ok) {
    return NextResponse.json({ error: `No pending recovery request found for id "${body.id}"` }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
