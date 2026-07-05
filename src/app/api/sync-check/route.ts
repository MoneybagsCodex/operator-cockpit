import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SyncCheckResult {
  timestamp: string;
  flags: string[];
  warnings: string[];
  errors: string[];
  reposFile?: { path: string; exists: boolean; stalenessMs?: number };
  dashboardFile?: { path: string; exists: boolean; stalenessMs?: number };
  gitStatus?: { branch: string; remoteUrl?: string };
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(): Promise<NextResponse<SyncCheckResult>> {
  const result: SyncCheckResult = {
    timestamp: new Date().toISOString(),
    flags: [],
    warnings: [],
    errors: [],
  };

  try {
    const home = os.homedir();
    const agentalPersonalPath = path.join(home, 'projects', 'agentic-personal');

    // Check REPOS.md
    const reposPath = path.join(agentalPersonalPath, 'REPOS.md');
    if (fs.existsSync(reposPath)) {
      const stats = fs.statSync(reposPath);
      const ageMs = Date.now() - stats.mtimeMs;
      result.reposFile = { path: reposPath, exists: true, stalenessMs: ageMs };
      if (ageMs > SEVEN_DAYS_MS) {
        result.warnings.push(`REPOS.md is ${Math.floor(ageMs / (24 * 60 * 60 * 1000))} days old`);
      }
    } else {
      result.reposFile = { path: reposPath, exists: false };
      result.errors.push('REPOS.md not found in ~/projects/agentic-personal');
    }

    // Check DASHBOARD.md
    const dashboardPath = path.join(agentalPersonalPath, 'ops', 'DASHBOARD.md');
    if (fs.existsSync(dashboardPath)) {
      const stats = fs.statSync(dashboardPath);
      const ageMs = Date.now() - stats.mtimeMs;
      result.dashboardFile = { path: dashboardPath, exists: true, stalenessMs: ageMs };
      if (ageMs > SEVEN_DAYS_MS) {
        result.warnings.push(`DASHBOARD.md is ${Math.floor(ageMs / (24 * 60 * 60 * 1000))} days old`);
      }
    } else {
      result.dashboardFile = { path: dashboardPath, exists: false };
      result.warnings.push('DASHBOARD.md not found in ~/projects/agentic-personal/ops');
    }

    // Check git status
    if (fs.existsSync(agentalPersonalPath)) {
      try {
        const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: agentalPersonalPath });
        const { stdout: remote } = await execAsync('git config --get remote.origin.url', { cwd: agentalPersonalPath }).catch(() => ({ stdout: '' }));
        result.gitStatus = {
          branch: branch.trim(),
          remoteUrl: remote.trim() || undefined,
        };
      } catch (err) {
        result.warnings.push('Could not read git status from agentic-personal');
      }
    }

    // Detect uncommitted changes to REPOS.md or DASHBOARD.md
    try {
      const { stdout: status } = await execAsync('git status --porcelain', { cwd: agentalPersonalPath });
      if (status.includes('REPOS.md') || status.includes('DASHBOARD.md')) {
        result.flags.push('uncommitted-changes');
      }
    } catch (err) {
      // Ignore
    }

    // Check for unresolved placeholders in key files
    const filesToCheck = [reposPath, dashboardPath];
    for (const filePath of filesToCheck) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes('TODO') || content.includes('FIXME') || content.includes('[PLACEHOLDER]')) {
          result.flags.push('unresolved-placeholders');
          break;
        }
      }
    }
  } catch (err) {
    result.errors.push(`Sync check failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return NextResponse.json(result);
}
