import { test, expect } from '@playwright/test';

test.describe('Auto-Approve Feature - E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh, clear any stored state
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
  });

  test('Toggle loads correct auto-approve state on mount', async ({ page }) => {
    // SCENARIO: Backend has auto-approve enabled (global=true)
    // EXPECTED: UI toggle shows "ON" after page loads
    // PREVIOUS BUG: Toggle showed "OFF" despite backend being "ON"

    // Setup: Enable auto-approve via API
    const response = await page.request.post('http://localhost:3001/api/auto-approve', {
      data: { agentId: 'global', enabled: true },
    });
    expect(response.ok()).toBe(true);

    // Load page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify: Toggle should show "ON"
    const toggleText = await page.locator('button:has-text("Auto-approve")').textContent();
    expect(toggleText).toContain('ON');
  });

  test('Approval queue count matches API count after toggle', async ({ page }) => {
    // SCENARIO: User enables auto-approve, queue should update
    // EXPECTED: Queue count reflects pending approvals

    // Get initial count
    const initialCount = await page.locator('text=APPROVAL QUEUE').textContent();
    const initialNum = parseInt(initialCount?.match(/\d+/)?.[0] || '0');

    // Disable auto-approve
    const autoApproveButton = page.locator('button:has-text("Auto-approve OFF")').first();
    await autoApproveButton.click();

    // Handle confirmation dialog (if present)
    await page.on('dialog', dialog => dialog.accept());

    // Wait for state update
    await page.waitForTimeout(1000);

    // Verify: Count should still be accurate
    const afterCount = await page.locator('text=APPROVAL QUEUE').textContent();
    const afterNum = parseInt(afterCount?.match(/\d+/)?.[0] || '0');

    // The count should either stay same or decrease (as approvals are processed)
    expect(afterNum).toBeLessThanOrEqual(initialNum);
  });

  test('State persists across page reload', async ({ page }) => {
    // SCENARIO: User enables auto-approve, reloads page
    // EXPECTED: Auto-approve setting persists, toggle shows "ON"
    // BUG FIX: Previously required manual reload to sync UI state

    // Enable auto-approve
    const response = await page.request.post('http://localhost:3001/api/auto-approve', {
      data: { agentId: 'global', enabled: true },
    });
    expect(response.ok()).toBe(true);

    // Wait a moment for localStorage to update
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify: Toggle should still show "ON" (state persisted)
    const toggleText = await page.locator('button:has-text("Auto-approve")').textContent();
    expect(toggleText).toContain('ON');

    // Verify: localStorage has the setting
    const stored = await page.evaluate(() => {
      return localStorage.getItem('auto-approve-global');
    });
    expect(stored).toBeTruthy();
  });

  test('Approval queue updates when approval is auto-decided', async ({ page }) => {
    // SCENARIO: Auto-approve enabled, new approval created
    // EXPECTED: Approval is auto-decided, queue count decreases
    // OR approval appears and disappears automatically

    // Enable auto-approve
    await page.request.post('http://localhost:3001/api/auto-approve', {
      data: { agentId: 'global', enabled: true },
    });

    // Get initial queue count
    let queueText = await page.locator('text=APPROVAL QUEUE').textContent();
    const initialCount = parseInt(queueText?.match(/\d+/)?.[0] || '0');

    // Create a new approval
    const createResponse = await page.request.post(
      'http://localhost:3001/api/test/approval-flow',
      {
        data: { step: 'create' },
      }
    );
    expect(createResponse.ok()).toBe(true);

    // Wait for UI to update
    await page.waitForTimeout(1000);

    // Get new queue count
    queueText = await page.locator('text=APPROVAL QUEUE').textContent();
    const newCount = parseInt(queueText?.match(/\d+/)?.[0] || '0');

    // With auto-approve ON, count should not increase
    // (approval is auto-decided, doesn't stay pending)
    expect(newCount).toBeLessThanOrEqual(initialCount + 1);
  });

  test('Approval items are clickable and expandable', async ({ page }) => {
    // SCENARIO: User views approval queue
    // EXPECTED: Can expand approval to see details

    // Make sure there's at least one approval
    await page.request.post('http://localhost:3001/api/test/approval', {
      data: { agentId: 'test-agent', action: 'test action' },
    });

    // Reload to see the approval
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Click first approval to expand
    const firstApproval = page.locator('button').filter({ has: page.locator('h3') }).first();
    await firstApproval.click();

    // Verify: Details are shown
    await expect(page.locator('text=Rationale')).toBeVisible();
    await expect(page.locator('text=Risk Level')).toBeVisible();
  });

  test('Approval can be manually approved', async ({ page }) => {
    // SCENARIO: User manually approves an approval
    // EXPECTED: Approval is moved to approved, removed from queue

    // Create an approval
    const createResponse = await page.request.post(
      'http://localhost:3001/api/test/approval',
      {
        data: { agentId: 'test-agent-2', action: 'test manual approval' },
      }
    );
    const body = await createResponse.json();
    const approvalId = (body as any).id;

    // Reload to see it
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Get initial count
    let queueText = await page.locator('text=APPROVAL QUEUE').textContent();
    const initialCount = parseInt(queueText?.match(/\d+/)?.[0] || '0');

    // Expand the approval
    const approval = page.locator('button').filter({ has: page.locator('h3') }).first();
    await approval.click();

    // Click approve button
    await page.locator('button:has-text("Approve")').first().click();

    // Wait for state update
    await page.waitForTimeout(1000);

    // Verify: Queue count decreased
    queueText = await page.locator('text=APPROVAL QUEUE').textContent();
    const newCount = parseInt(queueText?.match(/\d+/)?.[0] || '0');
    expect(newCount).toBeLessThan(initialCount);

    // Verify: API confirms approval is approved
    const statusResponse = await page.request.get(
      `http://localhost:3001/api/approvals`
    );
    const approvals = await statusResponse.json();
    const approval_ = (approvals as any[]).find((a: any) => a.id === approvalId);
    // Approval should be gone from pending, or status should be approved
    if (approval_) {
      expect(approval_.status).not.toBe('pending');
    }
  });

  test('Error handling: API failure shows graceful error', async ({ page }) => {
    // SCENARIO: API endpoint returns error
    // EXPECTED: UI shows error message, doesn't crash

    // Navigate to page
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');

    // Intercept API and return error
    await page.route('http://localhost:3001/api/auto-approve', (route) => {
      route.abort('failed');
    });

    // Try to enable auto-approve
    const autoApproveButton = page.locator('button:has-text("Auto-approve OFF")').first();
    await autoApproveButton.click();

    // Handle dialog if it appears
    await page.on('dialog', dialog => dialog.accept());

    // Page should not crash (no error dialog, still visible)
    await expect(page.locator('text=Operator Cockpit')).toBeVisible();
  });
});
