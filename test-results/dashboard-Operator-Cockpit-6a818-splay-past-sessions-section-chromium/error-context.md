# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> Operator Cockpit Dashboard >> should display past sessions section
- Location: tests/dashboard.spec.ts:32:7

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]: OC
        - heading "Operator Cockpit" [level=1] [ref=e7]
      - generic [ref=e9]: No projects found under ~/claude/projects
      - generic [ref=e10]:
        - generic [ref=e11]: mock data
        - generic [ref=e12]: ● live
        - button "Mist" [ref=e14] [cursor=pointer]:
          - img [ref=e15]
          - text: Mist
        - button "New Agent" [ref=e22] [cursor=pointer]:
          - img [ref=e23]
          - text: New Agent
        - generic [ref=e24]: 03:48:48 PM
    - generic [ref=e25]:
      - generic [ref=e26]:
        - generic [ref=e27]:
          - heading "Approval Queue (0)" [level=2] [ref=e29]
          - button "Auto-approve OFF" [ref=e30] [cursor=pointer]:
            - generic [ref=e31]:
              - img [ref=e32]
              - text: Auto-approve OFF
          - paragraph [ref=e38]: All approvals handled
        - generic [ref=e39]:
          - generic [ref=e40]:
            - button "Jira" [ref=e41] [cursor=pointer]:
              - img [ref=e42]
              - generic [ref=e44]: Jira
            - button "Refresh" [ref=e45] [cursor=pointer]:
              - img [ref=e46]
          - generic [ref=e52]: Add JIRA_EMAIL + JIRA_TOKEN to .env.local
        - button "Past Sessions" [ref=e54] [cursor=pointer]:
          - generic [ref=e55]:
            - img [ref=e56]
            - generic [ref=e58]: Past Sessions
          - img [ref=e59]
      - generic [ref=e62]: No live sessions. Open one from Past Sessions, the ▶ agent buttons, or a Jira ticket.
  - alert [ref=e63]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Operator Cockpit Dashboard', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.goto('http://localhost:3001');
  6   |     // Wait for the boot splash to disappear and content to load
  7   |     await page.waitForTimeout(3000);
  8   |   });
  9   | 
  10  |   test('should load the dashboard page', async ({ page }) => {
  11  |     const title = await page.title();
  12  |     expect(title).toContain('Operator Cockpit');
  13  |   });
  14  | 
  15  |   test('should display the header with title', async ({ page }) => {
  16  |     const header = page.locator('h1');
  17  |     await expect(header).toContainText('AI Operator Cockpit');
  18  |   });
  19  | 
  20  |   test('should display approval queue section', async ({ page }) => {
  21  |     const approvalSection = page.locator('h2').filter({ hasText: 'Approval Queue' });
  22  |     await expect(approvalSection).toBeVisible();
  23  |   });
  24  | 
  25  |   test('should display JIRA section', async ({ page }) => {
  26  |     const jiraSection = page.locator('h2').filter({ hasText: /JIRA|Sprint/i });
  27  |     // JIRA section may or may not be visible depending on setup
  28  |     const exists = await jiraSection.count() > 0;
  29  |     expect(exists).toBeTruthy();
  30  |   });
  31  | 
  32  |   test('should display past sessions section', async ({ page }) => {
  33  |     const sessionsSection = page.locator('h2').filter({ hasText: /Sessions|Past/i });
  34  |     const exists = await sessionsSection.count() > 0;
> 35  |     expect(exists).toBeTruthy();
      |                    ^ Error: expect(received).toBeTruthy()
  36  |   });
  37  | 
  38  |   test('should render terminal panels in a grid', async ({ page }) => {
  39  |     // Look for terminal panel containers
  40  |     const panels = page.locator('[class*="grid"]').filter({ hasText: /terminal|agent|session/i });
  41  |     const panelCount = await panels.count();
  42  |     // Should have at least the grid structure
  43  |     expect(panelCount).toBeGreaterThanOrEqual(1);
  44  |   });
  45  | 
  46  |   test('should have main content area with flex layout', async ({ page }) => {
  47  |     const mainContent = page.locator('.flex-1');
  48  |     const count = await mainContent.count();
  49  |     // Should have flex containers for layout
  50  |     expect(count).toBeGreaterThan(0);
  51  |   });
  52  | 
  53  |   test('should render with dark theme colors (slate-900)', async ({ page }) => {
  54  |     const darkBg = page.locator('.bg-slate-900');
  55  |     await expect(darkBg).toBeVisible();
  56  |   });
  57  | 
  58  |   test('should have interactive elements (buttons)', async ({ page }) => {
  59  |     const buttons = page.locator('button');
  60  |     const buttonCount = await buttons.count();
  61  |     expect(buttonCount).toBeGreaterThan(0);
  62  |   });
  63  | 
  64  |   test('should have sidebar with width constraint', async ({ page }) => {
  65  |     const sidebar = page.locator('.w-80');
  66  |     const count = await sidebar.count();
  67  |     // Sidebar should have the w-80 class for fixed width
  68  |     expect(count).toBeGreaterThan(0);
  69  |   });
  70  | 
  71  |   test('should render approval items if present', async ({ page }) => {
  72  |     const approvalItems = page.locator('[class*="rounded-lg"][class*="bg-slate"]').filter({ hasText: /approve|reject|decision/i });
  73  |     const count = await approvalItems.count();
  74  |     // May or may not have approvals in mock data, but structure should exist
  75  |     expect(count).toBeGreaterThanOrEqual(0);
  76  |   });
  77  | 
  78  |   test('should have scrollable areas', async ({ page }) => {
  79  |     const scrollableAreas = page.locator('[class*="overflow"]');
  80  |     const count = await scrollableAreas.count();
  81  |     expect(count).toBeGreaterThan(0);
  82  |   });
  83  | 
  84  |   test('should respond to viewport changes', async ({ page }) => {
  85  |     // Check that page is responsive
  86  |     const initialSize = await page.evaluate(() => ({
  87  |       width: window.innerWidth,
  88  |       height: window.innerHeight,
  89  |     }));
  90  | 
  91  |     expect(initialSize.width).toBeGreaterThan(0);
  92  |     expect(initialSize.height).toBeGreaterThan(0);
  93  |   });
  94  | 
  95  |   test('should have proper focus management', async ({ page }) => {
  96  |     const inputs = page.locator('input');
  97  |     const count = await inputs.count();
  98  |     // Dashboard may have input fields for messaging/search
  99  |     expect(count).toBeGreaterThanOrEqual(0);
  100 |   });
  101 | 
  102 |   test('should render text content without errors', async ({ page }) => {
  103 |     // Verify that page has actual text content rendered
  104 |     const bodyText = await page.locator('body').textContent();
  105 |     expect(bodyText?.length).toBeGreaterThan(0);
  106 |   });
  107 | 
  108 |   test('should not have any console errors during load', async ({ page }) => {
  109 |     const errors: string[] = [];
  110 |     page.on('console', (msg) => {
  111 |       if (msg.type() === 'error') {
  112 |         errors.push(msg.text());
  113 |       }
  114 |     });
  115 | 
  116 |     // Reload to capture any errors
  117 |     await page.goto('http://localhost:3001');
  118 |     await page.waitForTimeout(2000);
  119 | 
  120 |     // Filter out expected third-party errors
  121 |     const criticalErrors = errors.filter(e => !e.includes('third-party') && !e.includes('extension'));
  122 |     expect(criticalErrors.length).toBe(0);
  123 |   });
  124 | 
  125 |   test('should have proper HTML structure', async ({ page }) => {
  126 |     // Check for basic HTML structure
  127 |     const html = await page.locator('html').elementHandle();
  128 |     expect(html).not.toBeNull();
  129 | 
  130 |     const body = await page.locator('body').elementHandle();
  131 |     expect(body).not.toBeNull();
  132 |   });
  133 | 
  134 |   test('should load images without errors', async ({ page }) => {
  135 |     const images = page.locator('img');
```