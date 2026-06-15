import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATE_DIR = process.env.OPERATOR_STATE_DIR || path.join(process.env.HOME || '~', '.operator-state');
const AGENT_CONFIGS_DIR = path.join(STATE_DIR, 'agent-configs');

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, emoji = '🤖', model = 'sonnet', prompt = '', projectName } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }

  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const projectId = id;

  const config = {
    id,
    name: name.trim(),
    emoji,
    model,
    projectId,
    projectName: projectName?.trim() || `${emoji} ${name.trim()}`,
    prompt: prompt.trim(),
  };

  fs.mkdirSync(AGENT_CONFIGS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(AGENT_CONFIGS_DIR, `${id}.json`),
    JSON.stringify(config, null, 2)
  );

  return NextResponse.json({ ok: true, config });
}
