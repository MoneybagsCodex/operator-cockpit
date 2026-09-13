import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import Anthropic from '@anthropic-ai/sdk';

const execAsync = promisify(exec);
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
// Keyed by a hash of the exact diff text — the same unchanged commit/diff
// should never re-spend a Haiku call across repeated fetches (page loads,
// clicking "Sync", KnowledgeSyncPanel's own mount). Module-scope Map persists
// for the life of the dev/prod server process; cheap enough not to need more.
const summaryCache = new Map<string, string[]>();

interface FileChange {
  type: 'changed' | 'added' | 'removed';
  before?: string; // 'changed' only — the old line
  after?: string;  // 'changed' or 'added' — the new line
  text?: string;   // 'removed' only — the line that's gone
}

interface FileSyncInfo {
  file: string; // display name, e.g. 'REPOS.md'
  source: 'uncommitted' | 'commit' | 'none';
  commitMessage?: string;
  commitDate?: string;
  changes: FileChange[];
  truncated: boolean; // more changes exist than shown
  summary?: string[]; // plain-English bullets from Haiku; absent if unavailable — UI falls back to `changes`
}

interface SyncCheckResult {
  timestamp: string;
  flags: string[];
  warnings: string[];
  errors: string[];
  reposFile?: { path: string; exists: boolean; stalenessMs?: number };
  dashboardFile?: { path: string; exists: boolean; stalenessMs?: number };
  gitStatus?: { branch: string; remoteUrl?: string };
  fileChanges?: FileSyncInfo[];
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CHANGES_PER_FILE = 6;
const MAX_LINE_LEN = 140;
const DIFF_CONTEXT = 24; // chars of unchanged text kept around the actual divergence point

const truncateLine = (s: string) => (s.length > MAX_LINE_LEN ? s.slice(0, MAX_LINE_LEN - 1) + '…' : s);

// A 'changed' pair is usually one long markdown table row with a small edit
// buried in the middle (e.g. one path segment changed) — truncating both
// sides from the start, as truncateLine does, cuts them off before the edit
// and makes before/after render identically. Instead, find the real point of
// divergence (common prefix/suffix) and window around just that.
function windowOnDivergence(before: string, after: string): [string, string] {
  if (before === after) return [truncateLine(before), truncateLine(after)];
  const minLen = Math.min(before.length, after.length);
  let prefixLen = 0;
  while (prefixLen < minLen && before[prefixLen] === after[prefixLen]) prefixLen++;
  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    before[before.length - 1 - suffixLen] === after[after.length - 1 - suffixLen]
  ) suffixLen++;

  const start = Math.max(0, prefixLen - DIFF_CONTEXT);
  const window = (s: string) => {
    const end = Math.min(s.length - suffixLen + DIFF_CONTEXT, s.length);
    return (start > 0 ? '…' : '') + s.slice(start, end) + (end < s.length ? '…' : '');
  };
  return [window(before), window(after)];
}

// Parse unified diff body (no file-header lines) into human-readable changes.
// A hunk with an equal count of removed/added lines reads as N "changed" pairs
// (matches most real edits — an old value replaced with a new one) rather than
// a wall of separate + / - lines that are actually the same edit twice.
function parseDiffToChanges(diffText: string): FileChange[] {
  const changes: FileChange[] = [];
  const lines = diffText.split('\n');
  let removedBuf: string[] = [];
  let addedBuf: string[] = [];

  const flush = () => {
    const n = Math.min(removedBuf.length, addedBuf.length);
    for (let i = 0; i < n; i++) {
      const [before, after] = windowOnDivergence(removedBuf[i], addedBuf[i]);
      changes.push({ type: 'changed', before, after });
    }
    for (let i = n; i < removedBuf.length; i++) changes.push({ type: 'removed', text: truncateLine(removedBuf[i]) });
    for (let i = n; i < addedBuf.length; i++) changes.push({ type: 'added', after: truncateLine(addedBuf[i]) });
    removedBuf = [];
    addedBuf = [];
  };

  for (const line of lines) {
    if (line.startsWith('+++') || line.startsWith('---')) continue; // file headers, not content
    if (line.startsWith('@@')) { flush(); continue; } // new hunk — don't pair across hunks
    if (line.startsWith('+')) { addedBuf.push(line.slice(1).trim()); continue; }
    if (line.startsWith('-')) { removedBuf.push(line.slice(1).trim()); continue; }
    flush(); // context line — ends any run of +/- lines
  }
  flush();
  return changes.filter((c) => (c.before || c.after || c.text || '').length > 0);
}

// Plain-English bullet summary of a raw diff, via Haiku — the cheapest model,
// on a short prompt with a small output cap, and cached by exact diff content
// so the same commit/diff is never re-summarized on a later fetch. Returns
// undefined (not a thrown error) on any failure — the caller falls back to
// the raw line-level `changes` display, never blocking the rest of the check.
async function summarizeDiff(displayName: string, diffText: string): Promise<string[] | undefined> {
  if (!anthropic || !diffText.trim()) return undefined;
  const cacheKey = crypto.createHash('sha1').update(`${displayName}:${diffText}`).digest('hex');
  const cached = summaryCache.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: 'You summarize git diffs of a personal knowledge-base file into short plain-English bullet points. '
        + 'Output ONLY 2-4 bullet points, each starting with "- ", no preamble, no markdown headers, no closing remarks. '
        + 'Describe what changed and why it likely matters, not the raw text edits.',
      messages: [{ role: 'user', content: `File: ${displayName}\n\nDiff:\n${diffText.slice(0, 4000)}` }],
    });
    const text = response.content.filter((b) => b.type === 'text').map((b) => (b as { type: 'text'; text: string }).text).join('');
    const bullets = text.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim());
    if (bullets.length === 0) return undefined;
    summaryCache.set(cacheKey, bullets);
    return bullets;
  } catch (err) {
    console.error(`[sync-check] Haiku summary failed for ${displayName}:`, err instanceof Error ? err.message : err);
    return undefined;
  }
}

// What changed in this file, and where it came from: uncommitted edits (the
// most current, actionable signal) if any exist, else the most recent commit
// that touched it (still real history, clearly labeled as already-synced).
async function getFileChanges(cwd: string, relPath: string, displayName: string): Promise<FileSyncInfo> {
  try {
    const { stdout: uncommittedDiff } = await execAsync(`git diff -- "${relPath}"`, { cwd });
    if (uncommittedDiff.trim()) {
      const all = parseDiffToChanges(uncommittedDiff);
      const summary = await summarizeDiff(displayName, uncommittedDiff);
      return { file: displayName, source: 'uncommitted', changes: all.slice(0, MAX_CHANGES_PER_FILE), truncated: all.length > MAX_CHANGES_PER_FILE, summary };
    }
  } catch { /* not a git repo, or git unavailable — fall through */ }

  try {
    const { stdout: logLine } = await execAsync(`git log -1 --format=%H%x1f%s%x1f%ad --date=short -- "${relPath}"`, { cwd });
    const [hash, subject, date] = logLine.trim().split('\x1f');
    if (!hash) return { file: displayName, source: 'none', changes: [], truncated: false };
    const { stdout: commitDiff } = await execAsync(`git show ${hash} -- "${relPath}"`, { cwd });
    const all = parseDiffToChanges(commitDiff);
    const summary = await summarizeDiff(displayName, commitDiff);
    return {
      file: displayName,
      source: 'commit',
      commitMessage: subject,
      commitDate: date,
      changes: all.slice(0, MAX_CHANGES_PER_FILE),
      truncated: all.length > MAX_CHANGES_PER_FILE,
      summary,
    };
  } catch {
    return { file: displayName, source: 'none', changes: [], truncated: false };
  }
}

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

    // What actually changed, and where — real diff content, not just staleness.
    if (fs.existsSync(agentalPersonalPath)) {
      result.fileChanges = await Promise.all([
        getFileChanges(agentalPersonalPath, 'REPOS.md', 'REPOS.md'),
        getFileChanges(agentalPersonalPath, 'ops/DASHBOARD.md', 'DASHBOARD.md'),
      ]);
    }
  } catch (err) {
    result.errors.push(`Sync check failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return NextResponse.json(result);
}
