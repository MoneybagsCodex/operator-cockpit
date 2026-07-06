import { NextRequest, NextResponse } from 'next/server';
import { getAutoApproveSettings, setAutoApprove, isAutoApprovedForAgent } from '@/src/lib/state';

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId');

  if (!agentId) {
    // Return all settings
    const settings = getAutoApproveSettings();
    return NextResponse.json(settings);
  }

  // Return setting for specific agent
  const enabled = isAutoApprovedForAgent(agentId);
  return NextResponse.json({ agentId, enabled });
}

export async function POST(req: NextRequest) {
  const { agentId, enabled } = await req.json() as { agentId?: string; enabled?: boolean };

  if (!agentId || typeof enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'agentId and enabled (boolean) are required' },
      { status: 400 }
    );
  }

  setAutoApprove(agentId, enabled);
  console.log(`[auto-approve] Set for agent ${agentId}: ${enabled}`);
  return NextResponse.json({ ok: true, agentId, enabled }, { status: 200 });
}
