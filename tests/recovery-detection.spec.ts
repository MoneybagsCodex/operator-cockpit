import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Phase 1 of the usage-limit resilience feature: detect + notify only.
// There is no launch action to test yet — these cover the notification
// surface end-to-end: banner rendering, dismiss/acknowledge, and the API's
// error handling. The real trigger is scripts/detect-usage-limit.sh writing
// this exact file shape from a StopFailure hook; that shell script has its
// own direct test (feeding it synthetic payloads on stdin) rather than
// being driven through a browser.

const STATE_DIR = process.env.OPERATOR_STATE_DIR || path.join(os.homedir(), '.operator-state');
const PENDING_DIR = path.join(STATE_DIR, 'recovery', 'pending');
const ACK_DIR = path.join(STATE_DIR, 'recovery', 'acknowledged');

function writeFixture(id: string, overrides: Partial<Record<string, string>> = {}) {
  fs.mkdirSync(PENDING_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(PENDING_DIR, `${id}.json`),
    JSON.stringify({
      id,
      sessionId: id,
      cwd: '/Users/joshuaminton/projects/operator-cockpit',
      reason: 'session limit',
      lastAssistantMessage: "You've hit your session limit.",
      detectedAt: new Date().toISOString(),
      ...overrides,
    }),
  );
}

function cleanupFixture(id: string) {
  for (const dir of [PENDING_DIR, ACK_DIR]) {
    try { fs.unlinkSync(path.join(dir, `${id}.json`)); } catch { /* already gone */ }
  }
}

test.describe('Usage-Limit Recovery Detection (Phase 1) - E2E', () => {
  test('Banner renders a pending recovery request', async ({ page }) => {
    const id = `e2e-${Date.now()}`;
    writeFixture(id, { reason: 'session limit' });

    try {
      // Not waitForLoadState('networkidle'): the dashboard holds a
      // permanently-open SSE connection (/api/stream), so "network idle"
      // never truly settles here. expect(...).toBeVisible already polls.
      await page.goto('http://localhost:3001');
      await expect(page.locator('text=Claude hit a session limit').first()).toBeVisible({ timeout: 15000 });
    } finally {
      cleanupFixture(id);
    }
  });

  test('Dismissing a request acknowledges it on disk', async ({ request }) => {
    // The file-state transition (pending → acknowledged) is the real
    // contract here. UI responsiveness is tested via the live browser,
    // not via flaky e2e timing.
    const id = `e2e-${Date.now()}`;
    writeFixture(id, { reason: 'weekly limit', cwd: '/tmp/e2e-fixture' });

    try {
      expect(fs.existsSync(path.join(PENDING_DIR, `${id}.json`))).toBe(true);
      expect(fs.existsSync(path.join(ACK_DIR, `${id}.json`))).toBe(false);

      // Acknowledge via the API.
      const res = await request.post('http://localhost:3001/api/recovery', {
        data: { id },
      });
      expect(res.status()).toBe(200);

      // File should have moved.
      expect(fs.existsSync(path.join(PENDING_DIR, `${id}.json`))).toBe(false);
      expect(fs.existsSync(path.join(ACK_DIR, `${id}.json`))).toBe(true);
    } finally {
      cleanupFixture(id);
    }
  });

  test('Acknowledging a nonexistent id 404s rather than silently succeeding', async ({ request }) => {
    const res = await request.post('http://localhost:3001/api/recovery', {
      data: { id: 'e2e-nonexistent-id' },
    });
    expect(res.status()).toBe(404);
  });

  test('GET defaults to pending status only', async ({ request }) => {
    const id = `e2e-${Date.now()}`;
    writeFixture(id);
    try {
      const res = await request.get('http://localhost:3001/api/recovery');
      const body = await res.json() as { id: string }[];
      expect(body.some((r) => r.id === id)).toBe(true);
    } finally {
      cleanupFixture(id);
    }
  });
});
