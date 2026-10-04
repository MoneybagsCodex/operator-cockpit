import { NextRequest, NextResponse } from 'next/server';

const VOICE_ORCHESTRATOR_URL = process.env.VOICE_ORCHESTRATOR_URL || 'http://localhost:3003';

export async function POST(request: NextRequest) {
  try {
    // Tell voice orchestrator to stop listening
    const response = await fetch(`${VOICE_ORCHESTRATOR_URL}/stop`, {
      method: 'POST',
      timeout: 2000,
    });

    if (response.ok) {
      return NextResponse.json({ status: 'stopped' });
    }
  } catch (error) {
    // Service not responding, but treat as success
  }

  return NextResponse.json({ status: 'stopped' });
}
