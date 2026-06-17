import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Maps OpenClaw provider names → cockpit model options
const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  anthropic: [{ value: 'sonnet', label: 'Sonnet' }],
  deepseek:  [{ value: 'deepseek', label: 'DeepSeek' }],
  groq:      [{ value: 'llama', label: 'Llama 4' }],
  together:  [{ value: 'llama', label: 'Llama 4' }, { value: 'qwen', label: 'Qwen 3' }],
  fireworks: [{ value: 'mistral', label: 'Mistral' }],
  moonshot:  [{ value: 'kimi', label: 'Kimi K' }],
};

export async function GET() {
  try {
    const configPath = path.join(process.env.HOME || '~', '.openclaw', 'config', 'openclaw.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const providers: string[] = Object.keys(config?.models?.providers ?? {});

    // Collect model options for configured providers, deduplicate by value
    const seen = new Set<string>();
    const models: { value: string; label: string }[] = [];
    for (const provider of providers) {
      for (const model of PROVIDER_MODELS[provider] ?? []) {
        if (!seen.has(model.value)) {
          seen.add(model.value);
          models.push(model);
        }
      }
    }

    return NextResponse.json(models);
  } catch {
    // Fallback: return sonnet only if config unreadable
    return NextResponse.json([{ value: 'sonnet', label: 'Sonnet' }]);
  }
}
