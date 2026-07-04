import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATE_DIR = process.env.OPERATOR_STATE_DIR || path.join(os.homedir(), '.operator-state');
const AGENT_CONFIGS_DIR = path.join(STATE_DIR, 'agent-configs');

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const configPath = path.join(AGENT_CONFIGS_DIR, `${params.id}.json`);
  if (!fs.existsSync(configPath)) {
    return NextResponse.json({ error: 'Agent config not found' }, { status: 404 });
  }

  let config: Record<string, string>;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return NextResponse.json({ error: 'Invalid config' }, { status: 500 });
  }

  const workDir = config.workDir || os.homedir();
  const agentId = config.id || params.id;
  const agentName = config.name || agentId;

  // Write a temp PS1 script — avoids all quoting/escaping issues when passing to Start-Process
  const scriptLines = [
    `$env:CLAUDE_SESSION_ID = '${agentId.replace(/'/g, "''")}'`,
    `$env:CLAUDE_AGENT_NAME = '${agentName.replace(/'/g, "''")}'`,
    `$env:OPERATOR_STATE_DIR = '${STATE_DIR.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`,
    `Set-Location '${workDir.replace(/'/g, "''")}'`,
    `Write-Host ""`,
    `Write-Host "  Operator Cockpit  -  Claude Code Session" -ForegroundColor Cyan`,
    `Write-Host "  Agent : ${agentName}" -ForegroundColor White`,
    `Write-Host "  Dir   : ${workDir}" -ForegroundColor DarkGray`,
    `Write-Host ""`,
    `claude --continue`,
  ].join('\r\n');

  const scriptPath = path.join(os.tmpdir(), `cockpit-launch-${agentId}.ps1`);
  fs.writeFileSync(scriptPath, scriptLines, { encoding: 'utf8' });

  // Open a new PowerShell window running the script (detached, don't wait)
  const child = spawn(
    'powershell.exe',
    [
      '-Command',
      `Start-Process powershell.exe -ArgumentList '-ExecutionPolicy','Bypass','-NoExit','-File','${scriptPath.replace(/'/g, "''")}'`,
    ],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();

  return NextResponse.json({ ok: true, agentId, workDir });
}
