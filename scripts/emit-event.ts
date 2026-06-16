#!/usr/bin/env npx tsx
/**
 * emit-event — write an agent event to the operator state directory
 *
 * Usage (from any Claude Code subagent or agent process):
 *   npx tsx /path/to/scripts/emit-event.ts \
 *     --agent architect-001 \
 *     --agent-name ARCHITECT \
 *     --project consulting-automation \
 *     --type task-progress \
 *     --title "Database schema drafted" \
 *     --description "Created 5 core tables" \
 *     --urgency high
 *
 * Or via Node require (programmatic):
 *   const { emitEvent } = require('./scripts/emit-event');
 *   await emitEvent({ agentId: 'architect-001', ... });
 *
 * State dir is read from OPERATOR_STATE_DIR env var (default: ~/.operator-state)
 * Inside containers: mount host ~/.operator-state to /state and set OPERATOR_STATE_DIR=/state
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const STATE_DIR = process.env.OPERATOR_STATE_DIR || path.join(process.env.HOME || '~', '.operator-state');
const EVENTS_DIR = path.join(STATE_DIR, 'events');

type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';
type AgentEventType = 'task-started' | 'task-progress' | 'approval-needed' | 'blocker-found' | 'waiting-for-input' | 'task-complete' | 'message';

interface EventInput {
  agentId: string;
  agentName: string;
  projectId: string;
  eventType: AgentEventType;
  title: string;
  description: string;
  urgency?: UrgencyLevel;
  relatedFiles?: string[];
}

export function emitEvent(input: EventInput): string {
  fs.mkdirSync(EVENTS_DIR, { recursive: true });

  const id = `evt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const ts = new Date().toISOString();
  const filename = `${ts.replace(/[:.]/g, '-')}-${id}.json`;

  const event = {
    id,
    agentId: input.agentId,
    agentName: input.agentName,
    projectId: input.projectId,
    eventType: input.eventType || 'task-progress',
    title: input.title,
    description: input.description,
    urgency: input.urgency || 'medium',
    timestamp: ts,
    serializedAt: ts,
    source: 'claude-code',
    relatedFiles: input.relatedFiles || [],
  };

  fs.writeFileSync(path.join(EVENTS_DIR, filename), JSON.stringify(event, null, 2));
  return id;
}

// CLI mode
if (require.main === module) {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(`--${flag}`);
    return i !== -1 ? args[i + 1] : undefined;
  };

  const agentId = get('agent');
  const title = get('title');
  const projectId = get('project');

  if (!agentId || !title || !projectId) {
    console.error('Required: --agent, --project, --title');
    process.exit(1);
  }

  const id = emitEvent({
    agentId,
    agentName: get('agent-name') || agentId,
    projectId,
    eventType: (get('type') as AgentEventType) || 'task-progress',
    title,
    description: get('description') || '',
    urgency: (get('urgency') as UrgencyLevel) || 'medium',
    relatedFiles: get('files') ? [get('files')!] : [],
  });

  console.log(`Event emitted: ${id}`);
  console.log(`State dir: ${STATE_DIR}`);
}
