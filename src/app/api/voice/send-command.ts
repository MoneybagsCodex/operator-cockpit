import { NextRequest, NextResponse } from 'next/server';

const VOICE_ORCHESTRATOR_URL = process.env.VOICE_ORCHESTRATOR_URL || 'http://localhost:3003';
const BRIDGE_URL = process.env.COCKPIT_BRIDGE_URL || 'http://localhost:3002';

export async function POST(request: NextRequest) {
  try {
    const { command } = await request.json();

    if (!command) {
      return NextResponse.json(
        { error: 'Command required' },
        { status: 400 }
      );
    }

    // Route command through voice orchestrator
    const response = await fetch(`${VOICE_ORCHESTRATOR_URL}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
      timeout: 5000,
    });

    if (!response.ok) {
      throw new Error('Voice orchestrator error');
    }

    const result = await response.json();

    return NextResponse.json({
      isListening: false,
      transcript: command,
      lastCommand: result.command || command,
      lastOutput: result.output || 'Command executed',
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMsg },
      { status: 503 }
    );
  }
}
