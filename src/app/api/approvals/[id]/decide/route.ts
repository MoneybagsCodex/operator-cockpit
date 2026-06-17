import { NextRequest, NextResponse } from 'next/server';
import { decideApproval } from '@/src/lib/state';
import { ApprovalStatus } from '@/src/types';
import { logDecision } from '@/src/lib/preferences';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { decision, notes } = await req.json() as { decision: ApprovalStatus; notes?: string };

  if (!decision || !['approved', 'rejected', 'needs-revision'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision. Must be: approved, rejected, needs-revision' }, { status: 400 });
  }

  const updated = decideApproval(params.id, decision, notes);
  if (!updated) {
    return NextResponse.json({ error: `Approval ${params.id} not found` }, { status: 404 });
  }

  // Log to decision history so preferences can be learned
  logDecision({
    id: params.id,
    agentId: updated.agentId,
    riskLevel: updated.riskLevel,
    decision: decision as 'approved' | 'rejected' | 'needs-revision',
    action: updated.action,
    decidedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, approval: updated });
}
