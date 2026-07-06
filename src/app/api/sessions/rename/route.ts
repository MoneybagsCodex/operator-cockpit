import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, name } = await req.json();

    if (!sessionId || !name) {
      return NextResponse.json({ error: 'Missing sessionId or name' }, { status: 400 });
    }

    const metadataDir = path.join(os.homedir(), '.operator-state', 'session-metadata');
    fs.mkdirSync(metadataDir, { recursive: true });

    const metadataFile = path.join(metadataDir, `${sessionId}.json`);
    const metadata = { sessionId, name, updatedAt: new Date().toISOString() };

    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    console.log(`[API] Persisted session name: ${sessionId} → ${name}`);

    return NextResponse.json({ ok: true, sessionId, name });
  } catch (err) {
    console.error('[API] Failed to rename session:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
