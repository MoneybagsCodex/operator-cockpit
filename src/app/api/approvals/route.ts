import { NextRequest, NextResponse } from 'next/server';
import { readApprovals, writeApproval } from '@/src/lib/state';
import { ApprovalRequest } from '@/src/types';

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') as 'pending' | 'all' | undefined;
  const approvals = readApprovals(status || 'all');
  return NextResponse.json(approvals);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as ApprovalRequest;

  if (!body.id || !body.agentId || !body.action) {
    return NextResponse.json({ error: 'Missing required fields: id, agentId, action' }, { status: 400 });
  }

  writeApproval({ ...body, status: 'pending', createdAt: body.createdAt || new Date() });
  return NextResponse.json({ ok: true, id: body.id }, { status: 201 });
}
