export interface ChatBackendResponse {
  ok: boolean;
  reply?: string;
  error?: string;
}

export type ChatBackend = 'bridge' | 'anthropic';

export function getBackend(): ChatBackend {
  return (process.env.CHAT_BACKEND as ChatBackend) || 'bridge';
}

export async function sendMessage(agentId: string, message: string): Promise<ChatBackendResponse> {
  const backend = getBackend();
  if (backend === 'anthropic') {
    const { sendViaAnthropic } = await import('./anthropic');
    return sendViaAnthropic(agentId, message);
  }
  const { sendViaBridge } = await import('./bridge');
  return sendViaBridge(agentId, message);
}
