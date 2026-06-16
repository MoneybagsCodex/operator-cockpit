import type { ChatBackendResponse } from './index';

const BRIDGE_URL = process.env.COCKPIT_BRIDGE_URL || 'http://127.0.0.1:3001/send';

export async function sendViaBridge(agentId: string, message: string): Promise<ChatBackendResponse> {
  const resp = await fetch(BRIDGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, message }),
    signal: AbortSignal.timeout(120_000),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `Bridge returned ${resp.status}`);
  return data;
}
