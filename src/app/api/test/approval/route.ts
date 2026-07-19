import { NextRequest, NextResponse } from 'next/server';
import { writeApproval } from '@/src/lib/state';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const { agentId = 'test-agent', action = 'npm install' } = await req.json() as { agentId?: string; action?: string };

  const approval = {
    id: `test-${randomUUID()}`,
    agentId,
    action,
    description: `Test approval request: ${action}`,
    rationale: 'Test approval for development',
    affectedSystems: ['test-system'],
    expectedOutcome: 'Action completed successfully',
    riskLevel: 'medium' as const,
    status: 'pending' as const,
    createdAt: new Date(),
    projectId: agentId,
  };

  writeApproval(approval);
  console.log(`[test-approval] Created approval: ${approval.id} for agent ${agentId}`);

  return NextResponse.json({ ok: true, approval });
}
