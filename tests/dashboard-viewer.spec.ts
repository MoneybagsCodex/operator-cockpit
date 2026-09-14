import { test, expect } from '@playwright/test';

test.describe('Dashboard Viewer', () => {
  test('Dashboard tile appears in sidebar', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);

    const dashboardButton = page.locator('span:has-text("Dashboard")').first();
    await expect(dashboardButton).toBeVisible();
  });

  test('Dashboard expands and shows content', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);

    // Find the dashboard button by looking for the container with DASHBOARD text
    const dashboardContainer = page.locator('button:has(span:has-text("Dashboard"))').first();

    // Click to expand
    await dashboardContainer.click();
    await page.waitForTimeout(2000);

    // Check that the container now has task content (either "Quick Tasks" or loading indicator)
    const expandedContent = dashboardContainer.locator('xpath=following-sibling::div[1]');
    await expect(expandedContent).toContainText(/Quick Tasks|Loading|Dashboard/i);
  });

  test('Dashboard API returns markdown content', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/dashboard');
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain('Global Operations Dashboard');
  });
});
