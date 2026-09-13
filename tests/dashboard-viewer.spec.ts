import { test, expect } from '@playwright/test';

test.describe('Dashboard Viewer', () => {
  test('Dashboard tile appears in sidebar', async ({ page }) => {
    await page.goto('http://localhost:3001');
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    const dashboardButton = page.locator('button:has-text("DASHBOARD")').first();
    await expect(dashboardButton).toBeVisible();
  });

  test('Dashboard expands and shows content', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');

    const dashboardButton = page.locator('button:has-text("DASHBOARD")').first();

    // Click to expand
    await dashboardButton.click();

    // Should see content loading or loaded
    const dashboardContent = page.locator('div:has-text("Global Operations Dashboard"), div:has-text("Loading dashboard")');
    await expect(dashboardContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('Dashboard API returns markdown content', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/dashboard');
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain('Global Operations Dashboard');
  });
});
