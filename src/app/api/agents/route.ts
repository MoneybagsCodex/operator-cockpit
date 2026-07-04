import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATE_DIR = process.env.OPERATOR_STATE_DIR || path.join(os.homedir(), '.operator-state');
const AGENT_CONFIGS_DIR = path.join(STATE_DIR, 'agent-configs');

export async function GET() {
  try {
    if (!fs.existsSync(AGENT_CONFIGS_DIR)) return NextResponse.json({ configs: [] });
    const configs = fs.readdirSync(AGENT_CONFIGS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(AGENT_CONFIGS_DIR, f), 'utf-8')); } catch { return null; } })
      .filter(Boolean);
    return NextResponse.json({ configs });
  } catch {
    return NextResponse.json({ configs: [] });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, emoji = '🤖', model = 'sonnet', prompt = '', projectName, workDir = '' } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }

  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const projectId = id;

  const config: Record<string, unknown> = {
    id,
    name: name.trim(),
    emoji,
    model,
    projectId,
    projectName: projectName?.trim() || `${emoji} ${name.trim()}`,
    prompt: prompt.trim(),
  };

  if (workDir?.trim()) config.workDir = workDir.trim();

  fs.mkdirSync(AGENT_CONFIGS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(AGENT_CONFIGS_DIR, `${id}.json`),
    JSON.stringify(config, null, 2)
  );

  return NextResponse.json({ ok: true, config });
}
