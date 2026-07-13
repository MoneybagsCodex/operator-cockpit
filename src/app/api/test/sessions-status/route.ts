import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // This is a stub - it just tells the user to check the bridge logs
  // since the bridge has the real session data, not the Next.js API
  return NextResponse.json({
    message: 'Active sessions are tracked in the bridge. Check /tmp/bridge.log for session details.',
    instruction: 'Look for lines like "[terminal] spawned ... agentId=..."',
    example: 'agentId=Test Agent or agentId=cockpit-abc123',
  });
}
