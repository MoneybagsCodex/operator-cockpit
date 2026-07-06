import { NextRequest, NextResponse } from 'next/server';
import { decideApproval, appendChat } from '@/src/lib/state';
import { ApprovalStatus, ChatMessage } from '@/src/types';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { decision, notes } = await req.json() as { decision: ApprovalStatus; notes?: string };

  console.log(`[Decide] Processing approval: id=${params.id} decision=${decision}`);

  if (!decision || !['approved', 'rejected', 'needs-revision'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision. Must be: approved, rejected, needs-revision' }, { status: 400 });
  }

  const updated = decideApproval(params.id, decision, notes);
  if (!updated) {
    console.error(`[Decide] Approval not found: ${params.id}`);
    return NextResponse.json({ error: `Approval ${params.id} not found` }, { status: 404 });
  }

  console.log(`[Decide] Success: ${params.id} → ${decision}`);

  // Echo the decision back into the chat thread so the conversation has a full audit trail
  const decisionMsg: ChatMessage = {
    id: `dec-${updated.id}-${Date.now()}`,
    projectId: updated.projectId,
    sender: 'system',
    message: `${decision === 'approved' ? 'Approved' : decision === 'rejected' ? 'Rejected' : 'Needs revision'}: ${updated.action}`,
    timestamp: new Date(),
    type: 'approval-decision',
    approvalId: updated.id,
    approvalAction: updated.action,
    approvalDecision: decision,
    approvalNotes: notes,
  };

  try {
    appendChat(updated.projectId, decisionMsg);
  } catch {
    // Non-fatal — decision still stands even if chat write fails
  }

  return NextResponse.json({ ok: true, approval: updated });
}
