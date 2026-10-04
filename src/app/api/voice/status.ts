import { NextResponse } from 'next/server';

const VOICE_ORCHESTRATOR_URL = process.env.VOICE_ORCHESTRATOR_URL || 'http://localhost:3003';

// In-memory state (will be replaced with proper service in Phase 2)
let voiceState = {
  isListening: false,
  transcript: '',
  lastCommand: '',
  lastOutput: '',
};

export async function GET() {
  try {
    // Query voice orchestrator for current state
    const response = await fetch(`${VOICE_ORCHESTRATOR_URL}/status`, {
      method: 'GET',
      timeout: 2000,
    });

    if (response.ok) {
      const data = await response.json();
      voiceState = { ...voiceState, ...data };
    }
  } catch (error) {
    // Use cached state if service is down
  }

  return NextResponse.json(voiceState);
}
