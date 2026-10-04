import { NextResponse } from 'next/server';

const VOICE_ORCHESTRATOR_URL = process.env.VOICE_ORCHESTRATOR_URL || 'http://localhost:3003';

export async function GET() {
  try {
    // Try to connect to voice orchestrator
    const response = await fetch(`${VOICE_ORCHESTRATOR_URL}/health`, {
      method: 'GET',
      timeout: 2000,
    });

    if (response.ok) {
      return NextResponse.json({ status: 'ok', connected: true });
    }
  } catch (error) {
    // Voice orchestrator not running
  }

  return NextResponse.json({ status: 'offline', connected: false }, { status: 503 });
}
