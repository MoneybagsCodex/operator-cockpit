import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import type { ChatBackendResponse } from './index';

const STATE_DIR = process.env.OPERATOR_STATE_DIR || path.join(process.env.HOME || '~', '.operator-state');
const CHAT_DIR = path.join(STATE_DIR, 'chat');
const AGENT_CONFIGS_DIR = path.join(STATE_DIR, 'agent-configs');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function loadAgentConfig(agentId: string) {
  try {
    const file = path.join(AGENT_CONFIGS_DIR, `${agentId}.json`);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { id: agentId, name: agentId, prompt: '', projectId: agentId };
  }
}

function loadRecentHistory(projectId: string, limit = 20): Array<{ role: 'user' | 'assistant'; content: string }> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const file = path.join(CHAT_DIR, projectId, `${today}.jsonl`);
    if (!fs.existsSync(file)) return [];
    return fs
      .readFileSync(file, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((m: { sender: string }) => m.sender === 'user' || m.sender === 'agent')
      .slice(-limit)
      .map((m: { sender: string; message: string }) => ({
        role: (m.sender === 'agent' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.message,
      }));
  } catch {
    return [];
  }
}

function writeChatMessage(projectId: string, sender: 'user' | 'agent', name: string, message: string) {
  const today = new Date().toISOString().slice(0, 10);
  const dir = path.join(CHAT_DIR, projectId);
  fs.mkdirSync(dir, { recursive: true });
  const entry = JSON.stringify({
    id: `msg-${Date.now()}`,
    projectId,
    sender,
    name,
    message,
    timestamp: new Date().toISOString(),
  });
  fs.appendFileSync(path.join(dir, `${today}.jsonl`), entry + '\n');
}

export async function sendViaAnthropic(agentId: string, message: string): Promise<ChatBackendResponse> {
  const config = loadAgentConfig(agentId);
  const projectId = config.projectId || agentId;
  const history = loadRecentHistory(projectId);

  writeChatMessage(projectId, 'user', 'operator', message);

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history,
    { role: 'user', content: message },
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8096,
    system: config.prompt || `You are ${config.name}, an AI assistant.`,
    messages,
  });

  const reply = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  writeChatMessage(projectId, 'agent', config.name, reply);

  return { ok: true, reply };
}
