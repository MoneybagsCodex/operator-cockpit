import fs from 'fs';
import path from 'path';
import { ApprovalRiskLevel, LearnedThreshold } from '@/src/types';

const STATE_DIR = process.env.OPERATOR_STATE_DIR || path.join(process.env.HOME || '~', '.operator-state');
const HISTORY_FILE = path.join(STATE_DIR, 'decision-history.jsonl');
const PREFS_FILE = path.join(STATE_DIR, 'learned-preferences.json');

// Minimum decisions before auto-approve kicks in
const MIN_DECISIONS = 5;
// Confidence required to auto-approve
const AUTO_APPROVE_THRESHOLD = 0.85;
// Only use the most recent N decisions per (agent, risk) pair — recency bias
const WINDOW = 20;

export interface DecisionRecord {
  id: string;
  agentId: string;
  riskLevel: ApprovalRiskLevel;
  decision: 'approved' | 'rejected' | 'needs-revision';
  action: string;
  decidedAt: string;
}

export function logDecision(record: DecisionRecord): void {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.appendFileSync(HISTORY_FILE, JSON.stringify(record) + '\n');
    recomputePreferences();
  } catch { /* non-fatal */ }
}

export function readHistory(): DecisionRecord[] {
  try {
    return fs
      .readFileSync(HISTORY_FILE, 'utf-8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as DecisionRecord);
  } catch {
    return [];
  }
}

export function recomputePreferences(): LearnedThreshold[] {
  const history = readHistory();
  const riskLevels: ApprovalRiskLevel[] = ['low', 'medium', 'high', 'critical'];

  // Group by (agentId, riskLevel), take last WINDOW decisions each
  const grouped: Record<string, DecisionRecord[]> = {};
  for (const r of history) {
    const key = `${r.agentId}::${r.riskLevel}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  const thresholds: LearnedThreshold[] = [];
  for (const [key, records] of Object.entries(grouped)) {
    const [agentId, riskLevel] = key.split('::') as [string, ApprovalRiskLevel];
    const recent = records.slice(-WINDOW);
    const approvals = recent.filter((r) => r.decision === 'approved').length;
    const rejections = recent.filter((r) => r.decision === 'rejected').length;
    const revisions = recent.filter((r) => r.decision === 'needs-revision').length;
    const total = recent.length;
    const confidence = total === 0 ? 0 : approvals / total;
    thresholds.push({
      agentId,
      riskLevel,
      approvals,
      rejections,
      revisions,
      confidence,
      autoApprove: total >= MIN_DECISIONS && confidence >= AUTO_APPROVE_THRESHOLD,
      lastDecision: recent[recent.length - 1]?.decidedAt ?? '',
    });
  }

  try {
    fs.writeFileSync(PREFS_FILE, JSON.stringify(thresholds, null, 2));
  } catch { /* non-fatal */ }

  return thresholds;
}

export function readPreferences(): LearnedThreshold[] {
  try {
    return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf-8')) as LearnedThreshold[];
  } catch {
    return [];
  }
}

// Given an agent's manual trust level, return which risk levels are auto-approved
// before enough decision data exists
const TRUST_BASELINE: Record<string, ApprovalRiskLevel[]> = {
  monitor:    [],
  assistant:  ['low'],
  autonomous: ['low', 'medium'],
  'full-auto': ['low', 'medium', 'high'],
};

export function shouldAutoApprove(
  agentId: string,
  riskLevel: ApprovalRiskLevel,
  trustLevel: string = 'monitor',
  prefs: LearnedThreshold[] = []
): boolean {
  // Learned preference takes precedence if enough data
  const learned = prefs.find((p) => p.agentId === agentId && p.riskLevel === riskLevel);
  if (learned) {
    // If learned says no (confidence dropped), respect that over manual trust level
    return learned.autoApprove;
  }
  // Fall back to manual trust baseline
  return (TRUST_BASELINE[trustLevel] ?? []).includes(riskLevel);
}
