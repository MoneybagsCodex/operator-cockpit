import { NextRequest, NextResponse } from 'next/server';
import { writeApproval, decideApproval, setAutoApprove, isAutoApprovedForAgent } from '@/src/lib/state';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const { step = 'all' } = await req.json() as { step?: 'create' | 'approve' | 'all' };

  const agentId = 'test-agent-approval-flow';
  const approvalId = `test-${randomUUID()}`;

  const results = [];

  // Step 1: Create test approval
  if (step === 'all' || step === 'create') {
    const approval = {
      id: approvalId,
      agentId,
      action: 'git push',
      description: 'Test approval request for git push',
      riskLevel: 'high' as const,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      projectId: agentId,
    };
    writeApproval(approval);
    console.log(`[test-flow] ✓ Created approval: ${approvalId}`);
    results.push({ step: 'create', status: 'ok', approvalId });
  }

  // Step 2: Enable auto-approve
  if (step === 'all' || step === 'approve') {
    setAutoApprove(agentId, true);
    const isEnabled = isAutoApprovedForAgent(agentId);
    console.log(`[test-flow] ✓ Set auto-approve for ${agentId}: ${isEnabled}`);
    results.push({ step: 'enable-auto-approve', status: 'ok', enabled: isEnabled });

    // Step 3: Approve the request (simulate UI button click)
    const updated = decideApproval(approvalId, 'approved', 'Test auto-approve');
    console.log(`[test-flow] ✓ Moved approval to approved: ${approvalId}`);
    results.push({ step: 'approve', status: 'ok', approval: updated });
  }

  return NextResponse.json({
    ok: true,
    agentId,
    approvalId,
    results,
    message: 'Test approval flow completed. Check bridge logs for approval-bridge output.',
  });
}
