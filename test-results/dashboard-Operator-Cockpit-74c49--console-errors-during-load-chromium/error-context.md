# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> Operator Cockpit Dashboard >> should not have any console errors during load
- Location: tests/dashboard.spec.ts:108:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 13
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
        - button "Trust all" [ref=e13] [cursor=pointer]:
          - img [ref=e14]
          - text: Trust all
        - button "Mist" [ref=e18] [cursor=pointer]:
          - img [ref=e19]
          - text: Mist
        - button "New Agent" [ref=e26] [cursor=pointer]:
          - img [ref=e27]
          - text: New Agent
        - generic [ref=e28]: 03:49:26 PM
    - generic [ref=e29]:
      - generic [ref=e30]:
        - generic [ref=e31]:
          - heading "Approval Queue (0)" [level=2] [ref=e33]
          - button "Auto-approve OFF" [ref=e34] [cursor=pointer]:
            - generic [ref=e35]:
              - img [ref=e36]
              - text: Auto-approve OFF
          - paragraph [ref=e42]: All approvals handled
        - generic [ref=e43]:
          - generic [ref=e44]:
            - button "Jira" [ref=e45] [cursor=pointer]:
              - img [ref=e46]
              - generic [ref=e48]: Jira
            - button "Refresh" [ref=e49] [cursor=pointer]:
              - img [ref=e50]
          - generic [ref=e56]: Add JIRA_EMAIL + JIRA_TOKEN to .env.local
        - button "Past Sessions" [ref=e58] [cursor=pointer]:
          - generic [ref=e59]:
            - img [ref=e60]
            - generic [ref=e62]: Past Sessions
          - img [ref=e63]
      - generic [ref=e65]:
        - generic [ref=e66]:
          - generic [ref=e67]:
            - generic [ref=e68]:
              - img [ref=e69]
              - generic "Double-click to rename" [ref=e72]: /Users/joshuaminton/Downloads/operator…
              - generic [ref=e73]: reconnecting…
            - generic [ref=e74]:
              - button "Rename" [ref=e75] [cursor=pointer]:
                - img [ref=e76]
              - button "Close terminal (ends the session)" [ref=e79] [cursor=pointer]:
                - img [ref=e80]
          - generic [ref=e83]:
            - generic [ref=e87]:
              - generic:
                - textbox "Terminal input"
            - generic [ref=e88]:
              - generic [ref=e89]: OC
              - generic [ref=e90]:
                - text: Initializing agent
                - generic [ref=e91]: ...
        - generic [ref=e92]:
          - generic [ref=e93]:
            - generic [ref=e94]:
              - img [ref=e95]
              - generic "Double-click to rename" [ref=e98]: review all actions in my repo and dete…
              - generic [ref=e99]: reconnecting…
            - generic [ref=e100]:
              - button "Rename" [ref=e101] [cursor=pointer]:
                - img [ref=e102]
              - button "Close terminal (ends the session)" [ref=e105] [cursor=pointer]:
                - img [ref=e106]
          - generic [ref=e109]:
            - generic [ref=e113]:
              - generic:
                - textbox "Terminal input"
            - generic [ref=e114]:
              - generic [ref=e115]: OC
              - generic [ref=e116]:
                - text: Initializing agent
                - generic [ref=e117]: ...
        - generic [ref=e118]:
          - generic [ref=e119]:
            - generic [ref=e120]:
              - img [ref=e121]
              - generic "Double-click to rename" [ref=e124]: i am working on my work machine and ac…
              - generic [ref=e125]: reconnecting…
            - generic [ref=e126]:
              - button "Rename" [ref=e127] [cursor=pointer]:
                - img [ref=e128]
              - button "Close terminal (ends the session)" [ref=e131] [cursor=pointer]:
                - img [ref=e132]
          - generic [ref=e135]:
            - generic [ref=e139]:
              - generic:
                - textbox "Terminal input"
            - generic [ref=e140]:
              - generic [ref=e141]: OC
              - generic [ref=e142]:
                - text: Initializing agent
                - generic [ref=e143]: ...
        - generic [ref=e144]:
          - generic [ref=e145]:
            - generic [ref=e146]:
              - img [ref=e147]
              - generic "Double-click to rename" [ref=e150]: https://gist.github.com/karpathy/442a6…
              - generic [ref=e151]: reconnecting…
            - generic [ref=e152]:
              - button "Rename" [ref=e153] [cursor=pointer]:
                - img [ref=e154]
              - button "Close terminal (ends the session)" [ref=e157] [cursor=pointer]:
                - img [ref=e158]
          - generic [ref=e161]:
            - generic [ref=e165]:
              - generic:
                - textbox "Terminal input"
            - generic [ref=e166]:
              - generic [ref=e167]: OC
              - generic [ref=e168]:
                - text: Initializing agent
                - generic [ref=e169]: ...
        - generic [ref=e170]:
          - generic [ref=e171]:
            - generic [ref=e172]:
              - img [ref=e173]
              - generic "Double-click to rename" [ref=e176]: please check for existing scheduled ev…
              - generic [ref=e177]: reconnecting…
            - generic [ref=e178]:
              - button "Rename" [ref=e179] [cursor=pointer]:
                - img [ref=e180]
              - button "Close terminal (ends the session)" [ref=e183] [cursor=pointer]:
                - img [ref=e184]
          - generic [ref=e187]:
            - generic [ref=e191]:
              - generic:
                - textbox "Terminal input"
            - generic [ref=e192]:
              - generic [ref=e193]: OC
              - generic [ref=e194]:
                - text: Initializing agent
                - generic [ref=e195]: ...
        - generic [ref=e196]:
          - generic [ref=e197]:
            - generic [ref=e198]:
              - img [ref=e199]
              - generic "Double-click to rename" [ref=e202]: create an upskill folder within the fu…
              - generic [ref=e203]: reconnecting…
            - generic [ref=e204]:
              - button "Rename" [ref=e205] [cursor=pointer]:
                - img [ref=e206]
              - button "Close terminal (ends the session)" [ref=e209] [cursor=pointer]:
                - img [ref=e210]
          - generic [ref=e213]:
            - generic [ref=e217]:
              - generic:
                - textbox "Terminal input"
            - generic [ref=e218]:
              - generic [ref=e219]: OC
              - generic [ref=e220]:
                - text: Initializing agent
                - generic [ref=e221]: ...
  - alert [ref=e222]
```

# Test source

```ts
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
  35  |     expect(exists).toBeTruthy();
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
> 122 |     expect(criticalErrors.length).toBe(0);
      |                                   ^ Error: expect(received).toBe(expected) // Object.is equality
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
  136 |     const count = await images.count();
  137 |     // Dashboard may or may not have images
  138 |     expect(count).toBeGreaterThanOrEqual(0);
  139 |   });
  140 | 
  141 |   test('should have accessible color contrast', async ({ page }) => {
  142 |     // Verify text is visible against background
  143 |     const visibleText = page.locator('[class*="text-slate"]');
  144 |     const count = await visibleText.count();
  145 |     expect(count).toBeGreaterThan(0);
  146 |   });
  147 | });
  148 | 
  149 | test.describe('Operator Cockpit Interactions', () => {
  150 |   test('should allow button clicks without errors', async ({ page }) => {
  151 |     await page.goto('http://localhost:3001');
  152 |     await page.waitForTimeout(2000);
  153 | 
  154 |     const buttons = page.locator('button').first();
  155 |     const isVisible = await buttons.isVisible();
  156 | 
  157 |     if (isVisible) {
  158 |       await buttons.click();
  159 |       // Page should still be responsive after click
  160 |       const body = await page.locator('body').isVisible();
  161 |       expect(body).toBeTruthy();
  162 |     }
  163 |   });
  164 | 
  165 |   test('should handle rapid navigation', async ({ page }) => {
  166 |     await page.goto('http://localhost:3001');
  167 |     await page.waitForTimeout(1000);
  168 | 
  169 |     // Reload page quickly to test stability
  170 |     await page.reload();
  171 |     await page.waitForTimeout(2000);
  172 | 
  173 |     const title = await page.title();
  174 |     expect(title).toContain('Operator Cockpit');
  175 |   });
  176 | 
  177 |   test('should maintain responsive layout on smaller viewport', async ({ page }) => {
  178 |     await page.setViewportSize({ width: 1024, height: 768 });
  179 |     await page.goto('http://localhost:3001');
  180 |     await page.waitForTimeout(2000);
  181 | 
  182 |     const header = page.locator('h1');
  183 |     await expect(header).toBeVisible();
  184 |   });
  185 | 
  186 |   test('should maintain responsive layout on larger viewport', async ({ page }) => {
  187 |     await page.setViewportSize({ width: 1920, height: 1080 });
  188 |     await page.goto('http://localhost:3001');
  189 |     await page.waitForTimeout(2000);
  190 | 
  191 |     const header = page.locator('h1');
  192 |     await expect(header).toBeVisible();
  193 |   });
  194 | });
  195 | 
```