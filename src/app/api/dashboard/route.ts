import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const dashboardPath = join(process.env.HOME || '', 'projects/agentic-personal/ops/DASHBOARD.md');
    const content = readFileSync(dashboardPath, 'utf-8');
    return new Response(content, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}
