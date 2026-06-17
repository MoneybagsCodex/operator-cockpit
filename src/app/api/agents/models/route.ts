import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Map env key name → model options. Only models whose key is present + non-empty appear.
const KEY_TO_MODELS: Record<string, { value: string; label: string; submodels?: { value: string; label: string }[] }[]> = {
  ANTHROPIC_API_KEY: [{
    value: 'sonnet',
    label: 'Claude',
    submodels: [
      { value: 'haiku', label: 'Haiku' },
      { value: 'sonnet', label: 'Sonnet' },
      { value: 'opus', label: 'Opus' },
    ],
  }],
  GROQ_API_KEY:      [{ value: 'llama', label: 'Llama 4' }],
  DEEPSEEK_API_KEY:  [{ value: 'deepseek', label: 'DeepSeek' }],
  TOGETHER_API_KEY:  [{ value: 'qwen', label: 'Qwen 3' }],
  MOONSHOT_API_KEY:  [{ value: 'kimi', label: 'Kimi K' }],
  FIREWORKS_API_KEY: [{ value: 'mistral', label: 'Mistral' }],
  MISTRAL_API_KEY:   [{ value: 'mistral', label: 'Mistral' }],
};

function readSetKeys(envPath: string): Set<string> {
  const set = new Set<string>();
  try {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const eqIdx = trimmed.indexOf('=');
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (key && val) set.add(key);
    }
  } catch { /* env file unreadable */ }
  return set;
}

export async function GET() {
  const envPath = path.join(process.env.HOME || '~', '.openclaw', '.env');
  const setKeys = readSetKeys(envPath);

  const seenValues = new Set<string>();
  const models: { value: string; label: string; submodels?: { value: string; label: string }[] }[] = [];

  for (const [keyName, opts] of Object.entries(KEY_TO_MODELS)) {
    if (!setKeys.has(keyName)) continue;
    for (const opt of opts) {
      if (!seenValues.has(opt.value)) {
        seenValues.add(opt.value);
        models.push(opt);
      }
    }
  }

  if (models.length === 0) {
    return NextResponse.json([{ value: 'sonnet', label: 'Claude', submodels: [
      { value: 'haiku', label: 'Haiku' },
      { value: 'sonnet', label: 'Sonnet' },
      { value: 'opus', label: 'Opus' },
    ] }]);
  }

  return NextResponse.json(models);
}
