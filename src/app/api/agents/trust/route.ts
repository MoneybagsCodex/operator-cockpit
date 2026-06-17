import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATE_DIR = process.env.OPERATOR_STATE_DIR || path.join(process.env.HOME || '~', '.operator-state');
const AGENT_CONFIGS_DIR = path.join(STATE_DIR, 'agent-configs');
const AGENTS_DIR = path.join(STATE_DIR, 'agents');

const VALID_LEVELS = ['monitor', 'assistant', 'autonomous', 'full-auto'];

// POST { agentId?, trustLevel } — omit agentId to update all
export async function POST(req: NextRequest) {
  const { agentId, trustLevel } = await req.json();
  if (!trustLevel || !VALID_LEVELS.includes(trustLevel)) {
    return NextResponse.json({ error: `trustLevel must be one of: ${VALID_LEVELS.join(', ')}` }, { status: 400 });
  }

  const updateFile = (filePath: string) => {
    if (!fs.existsSync(filePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      data.trustLevel = trustLevel;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch { /* skip */ }
  };

  try {
    if (agentId) {
      updateFile(path.join(AGENT_CONFIGS_DIR, `${agentId}.json`));
      updateFile(path.join(AGENTS_DIR, `${agentId}.json`));
    } else {
      for (const dir of [AGENT_CONFIGS_DIR, AGENTS_DIR]) {
        if (!fs.existsSync(dir)) continue;
        for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
          updateFile(path.join(dir, f));
        }
      }
    }
    return NextResponse.json({ ok: true, trustLevel, agentId: agentId ?? 'all' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
