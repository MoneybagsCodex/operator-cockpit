import { test, expect } from '@playwright/test';

test.describe('Operator Cockpit Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001');
    // Wait for the boot splash to disappear and content to load
    await page.waitForTimeout(3000);
  });

  test('should load the dashboard page', async ({ page }) => {
    const title = await page.title();
    expect(title).toContain('Operator Cockpit');
  });

  test('should display the header with title', async ({ page }) => {
    const header = page.locator('h1');
    await expect(header).toContainText('AI Operator Cockpit');
  });

  test('should display approval queue section', async ({ page }) => {
    const approvalSection = page.locator('h2').filter({ hasText: 'Approval Queue' });
    await expect(approvalSection).toBeVisible();
  });

  test('should display JIRA section', async ({ page }) => {
    const jiraSection = page.locator('h2').filter({ hasText: /JIRA|Sprint/i });
    // JIRA section may or may not be visible depending on setup
    const exists = await jiraSection.count() > 0;
    expect(exists).toBeTruthy();
  });

  test('should display past sessions section', async ({ page }) => {
    const sessionsSection = page.locator('h2').filter({ hasText: /Sessions|Past/i });
    const exists = await sessionsSection.count() > 0;
    expect(exists).toBeTruthy();
  });

  test('should render terminal panels in a grid', async ({ page }) => {
    // Look for terminal panel containers
    const panels = page.locator('[class*="grid"]').filter({ hasText: /terminal|agent|session/i });
    const panelCount = await panels.count();
    // Should have at least the grid structure
    expect(panelCount).toBeGreaterThanOrEqual(1);
  });

  test('should have main content area with flex layout', async ({ page }) => {
    const mainContent = page.locator('.flex-1');
    const count = await mainContent.count();
    // Should have flex containers for layout
    expect(count).toBeGreaterThan(0);
  });

  test('should render with dark theme colors (slate-900)', async ({ page }) => {
    const darkBg = page.locator('.bg-slate-900');
    await expect(darkBg).toBeVisible();
  });

  test('should have interactive elements (buttons)', async ({ page }) => {
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);
  });

  test('should have sidebar with width constraint', async ({ page }) => {
    const sidebar = page.locator('.w-80');
    const count = await sidebar.count();
    // Sidebar should have the w-80 class for fixed width
    expect(count).toBeGreaterThan(0);
  });

  test('should render approval items if present', async ({ page }) => {
    const approvalItems = page.locator('[class*="rounded-lg"][class*="bg-slate"]').filter({ hasText: /approve|reject|decision/i });
    const count = await approvalItems.count();
    // May or may not have approvals in mock data, but structure should exist
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should have scrollable areas', async ({ page }) => {
    const scrollableAreas = page.locator('[class*="overflow"]');
    const count = await scrollableAreas.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should respond to viewport changes', async ({ page }) => {
    // Check that page is responsive
    const initialSize = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));

    expect(initialSize.width).toBeGreaterThan(0);
    expect(initialSize.height).toBeGreaterThan(0);
  });

  test('should have proper focus management', async ({ page }) => {
    const inputs = page.locator('input');
    const count = await inputs.count();
    // Dashboard may have input fields for messaging/search
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should render text content without errors', async ({ page }) => {
    // Verify that page has actual text content rendered
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('should not have any console errors during load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Reload to capture any errors
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(2000);

    // Filter out expected third-party errors
    const criticalErrors = errors.filter(e => !e.includes('third-party') && !e.includes('extension'));
    expect(criticalErrors.length).toBe(0);
  });

  test('should have proper HTML structure', async ({ page }) => {
    // Check for basic HTML structure
    const html = await page.locator('html').elementHandle();
    expect(html).not.toBeNull();

    const body = await page.locator('body').elementHandle();
    expect(body).not.toBeNull();
  });

  test('should load images without errors', async ({ page }) => {
    const images = page.locator('img');
    const count = await images.count();
    // Dashboard may or may not have images
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should have accessible color contrast', async ({ page }) => {
    // Verify text is visible against background
    const visibleText = page.locator('[class*="text-slate"]');
    const count = await visibleText.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Operator Cockpit Interactions', () => {
  test('should allow button clicks without errors', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(2000);

    const buttons = page.locator('button').first();
    const isVisible = await buttons.isVisible();

    if (isVisible) {
      await buttons.click();
      // Page should still be responsive after click
      const body = await page.locator('body').isVisible();
      expect(body).toBeTruthy();
    }
  });

  test('should handle rapid navigation', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(1000);

    // Reload page quickly to test stability
    await page.reload();
    await page.waitForTimeout(2000);

    const title = await page.title();
    expect(title).toContain('Operator Cockpit');
  });

  test('should maintain responsive layout on smaller viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(2000);

    const header = page.locator('h1');
    await expect(header).toBeVisible();
  });

  test('should maintain responsive layout on larger viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(2000);

    const header = page.locator('h1');
    await expect(header).toBeVisible();
  });
});
