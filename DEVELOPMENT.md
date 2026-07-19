# Development Standards — Operator Cockpit

**Reference:** See `/Users/joshuaminton/CLAUDE.md` for global development rules.

**Effective Date:** 2026-07-19  
**Last Updated:** 2026-07-19

---

## Core Principle

**No feature is complete until BOTH backend AND frontend are verified as stable in a single test pass.**

Separating backend validation from frontend validation is how production bugs slip through. Every change must be tested end-to-end before marking as done.

---

## 1. Integrated Testing Requirement

### Before Marking Any Feature Complete

- ✅ **Backend API** works (test with curl/Postman/API client)
- ✅ **Frontend UI** correctly displays backend state (visual inspection)
- ✅ **State sync** between UI and backend (reload, navigate, refresh)
- ✅ **User interactions** trigger backend correctly (click buttons, see results)
- ✅ **Error states** handled gracefully in both layers

**Example: Auto-Approve Feature Failure**

We validated:
- ✅ Backend: Approvals moved from pending → approved
- ✅ Backend: API endpoints working
- ❌ **Frontend: Toggle UI showed "OFF" when backend said "ON"** ← CAUGHT IN NEXT REVIEW

This shouldn't have made it past initial verification. The fix should have been in the same session, not discovered by the user later.

**Fix:** After backend testing, **immediately** test the UI in a browser. Don't move on.

---

## 2. Systems Integrity Checks

Before any deployment or major change, run these checks in order:

### Level 1: Build Integrity
```bash
npm run build 2>&1 | grep -E "error|fail" && echo "FAIL" || echo "PASS"
```
- TypeScript compilation must pass
- No warnings in build output
- **Action:** Fix all compilation errors before proceeding

### Level 2: Server Health
```bash
# Both servers must respond
curl -s http://localhost:3001/health >/dev/null && echo "Dev OK" || echo "Dev FAIL"
curl -s http://localhost:3002/health >/dev/null && echo "Bridge OK" || echo "Bridge FAIL"
```
- Dev server (port 3001) responds
- Bridge server (port 3002) responds
- **Action:** Restart servers if either fails

### Level 3: State Consistency
```bash
# Example: Check if approval queue count matches API
UI_QUEUE=$(curl -s http://localhost:3001 | grep -o "APPROVAL QUEUE ([0-9])" | grep -o "[0-9]")
API_PENDING=$(curl -s http://localhost:3001/api/approvals | jq '[.[] | select(.status == "pending")] | length')
[ "$UI_QUEUE" = "$API_PENDING" ] && echo "PASS" || echo "FAIL: UI shows $UI_QUEUE, API has $API_PENDING"
```
- Frontend displays match backend state
- No stale cached data in UI
- **Action:** Reload page and verify state syncs

### Level 4: User Interaction
- Click buttons, see expected results
- Forms submit and receive responses
- State changes persist across page reloads
- **Action:** Manual testing in browser required

---

## 3. Regression Test Suite Requirement

Every feature change requires a regression suite. **No exceptions.**

### When to Run
- Before marking any task complete
- Before pushing to remote
- Before deployment
- After any infrastructure change (server restart, config change, etc.)

### Structure
```bash
# Location: scripts/regression-tests.sh
# Usage: ./scripts/regression-tests.sh

# Must include:
# 1. Build test
# 2. Server health checks
# 3. Core feature tests (all critical paths)
# 4. UI state verification
# 5. Integration tests (backend + UI together)
# 6. Persistence tests (data survives reload)

# Exit code: 0 = all pass, 1 = any failure
```

### Approval Queue Regression Suite (Example)
```bash
#!/bin/bash
echo "=== Approval Queue Regression Tests ==="

# Test 1: Create approval
RESP=$(curl -s -X POST http://localhost:3001/api/approvals/[id]/decide \
  -H "Content-Type: application/json" \
  -d '{"decision": "approved"}')
STATUS=$(echo $RESP | jq -r '.approval.status')
[ "$STATUS" = "approved" ] && echo "✓ Create approval" || echo "✗ Create approval"

# Test 2: UI displays queue count
UI_COUNT=$(curl -s http://localhost:3001 | grep -o "APPROVAL QUEUE ([0-9]*)" | grep -o "[0-9]*")
API_COUNT=$(curl -s http://localhost:3001/api/approvals | jq '[.[] | select(.status == "pending")] | length')
[ "$UI_COUNT" = "$API_COUNT" ] && echo "✓ Queue count synced" || echo "✗ Queue count mismatch"

# Test 3: Toggle state persists
curl -s http://localhost:3001 | grep -q "Auto-approve ON" && echo "✓ Toggle ON" || echo "✗ Toggle OFF"

# Add more tests...
```

---

## 4. Bottom-Up Building (Never Top-Down)

### The Rule

**Build from the database/API layer UP to the UI. Never build UI first and hope the backend exists.**

### Why
- APIs define the contract
- Frontend depends on backend stability
- Building UI before backend creates assumptions
- Testing catches mismatches early

### The Process

1. **Define the API** (endpoint, request/response schema)
2. **Implement the API endpoint** (database → response)
3. **Test the API** (curl, verify status codes, verify data)
4. **Test state persistence** (restart server, data still there)
5. **Build the UI component** (now you know what data you'll receive)
6. **Test UI with real API** (not mocks)
7. **Test state sync** (UI reflects what API says)
8. **Test interactions** (user actions hit API, UI updates)

### Example: Auto-Approve Feature (How It Should Have Gone)

**Step 1-3: Backend First**
- ✅ Define `/api/auto-approve` endpoint (GET/POST)
- ✅ Implement state persistence (file or DB)
- ✅ Test with curl: `curl http://localhost:3001/api/auto-approve`

**Step 4-5: API Integration in Bridge**
- ✅ Bridge reads auto-approve setting
- ✅ Bridge auto-decides approvals
- ✅ Test: Bridge logs show auto-approve logic firing

**Step 6-8: UI Component**
- ✅ ApprovalQueue fetches setting on mount
- ✅ Toggle displays correct state
- ✅ Toggle changes persist
- ✅ Auto-approve in UI works end-to-end

**Only then** mark complete. Not before.

---

## 5. Pre-Deployment Checklist

Before pushing any code:

- [ ] Build passes (`npm run build`)
- [ ] No TypeScript errors
- [ ] Dev server starts without errors
- [ ] Bridge server starts without errors
- [ ] All regression tests pass
- [ ] Manual browser testing completed
- [ ] Backend state verified
- [ ] Frontend state verified
- [ ] State sync verified (reload test)
- [ ] User interactions tested (click, submit, etc.)
- [ ] Error cases tested
- [ ] No console errors in browser
- [ ] Git status clean (all changes committed)
- [ ] Commit message is descriptive

---

## 6. Lessons Learned (This Session)

### What Went Wrong

1. **Assumed backend worked, skipped full frontend verification**
   - Backend: ✅ Approvals moved from pending → approved
   - Frontend: ❌ Toggle showed "OFF" when it should show "ON"
   - Result: User discovered the bug after I marked it complete

2. **Documented a workaround instead of fixing it**
   - Marked as "known limitation" instead of debugging
   - Should have added: "Investigate why UI state doesn't sync"
   - Instead I said: "Reload the page to see correct state"

3. **Didn't test the complete user journey**
   - I tested: curl requests, API state, approval counts
   - I didn't test: User opens UI, sees correct toggle state, clicks buttons, sees updates
   - **This is backwards.** UI is what users see. If UI is wrong, the feature is broken.

4. **Separated backend and frontend testing into different phases**
   - Backend testing: ✅ Done thoroughly
   - Frontend testing: ❌ Skipped / deferred
   - Correct approach: Test together as one system

### What to Do Next Time

1. **After backend is working, immediately test in browser**
   - Don't mark backend complete
   - Don't move on to next task
   - Test UI right away in same session

2. **If UI doesn't match backend state, fix immediately**
   - Don't document as limitation
   - Don't defer to next session
   - Debug and fix in the same iteration

3. **For any feature touching both backend and frontend:**
   - Build backend first (API + persistence)
   - Test backend thoroughly
   - Build frontend (UI + interactions)
   - Test frontend + backend together
   - **Only then** mark complete

4. **State sync is not optional**
   - UI state must reflect backend state
   - Reload test is mandatory
   - If UI shows different data after reload, it's broken

---

## 7. Common Anti-Patterns (Do Not Repeat)

### ❌ Waterfall Backend → Frontend (This Session)
```
Backend: ✅ Complete, working, tested
         ↓
Frontend: ❌ Incomplete, has bugs, not tested
         ↓
Mark "Complete" with a caveat: "Front-end state sync issue"

Result: User discovers bug
```

### ✅ Integrated Backend ↔ Frontend (Correct)
```
Backend API: ✅ Define, implement, test
   ↓
Backend Persistence: ✅ Verify state survives restart
   ↓
Frontend Component: ✅ Build to match API contract
   ↓
Frontend + Backend: ✅ Test together (real API, real UI)
   ↓
State Sync: ✅ Verify reload preserves state
   ↓
Mark Complete: ✅ Only when both layers verified
```

### ❌ Accepting Workarounds Instead of Fixing
```
Bug: Toggle shows "OFF" when backend says "ON"
Response: "Workaround: Reload the page"
Result: User experience sucks, bug survives to production
```

### ✅ Fix Root Cause
```
Bug: Toggle shows "OFF" when backend says "ON"
Investigation: Component doesn't fetch setting on mount
Fix: Add useEffect to load from API
Result: Feature works as designed
```

---

## 8. Quality Gates (Must Pass)

| Gate | Check | Failure Action |
|------|-------|-----------------|
| Build | `npm run build` exits 0 | STOP, fix TypeScript |
| Servers | Both ports responding | STOP, restart servers |
| State | Backend state correct | STOP, verify API working |
| UI | Frontend displays correct state | STOP, debug component |
| Sync | State persists on reload | STOP, check persistence layer |
| Interaction | User actions work end-to-end | STOP, test in browser |
| Tests | All regression tests pass | STOP, debug failing test |
| Git | All changes committed | STOP, stage and commit |

**No gate can be skipped.** No "known limitations" at any stage. No "we'll fix it later."

---

## 9. Documentation Requirements

### For Every Feature
1. **How to test it** (manual steps in browser)
2. **What regression tests cover it** (automated checks)
3. **What backend/frontend components it touches** (dependency map)
4. **How to verify state persistence** (reload test)
5. **Error cases and how they're handled** (edge case testing)

### For Every Bug Fix
1. **Root cause** (not symptom)
2. **Why it wasn't caught earlier** (testing gap)
3. **How to prevent it next time** (added test)

---

## 10. Integration with Global CLAUDE.md

This DEVELOPMENT.md extends `/Users/joshuaminton/CLAUDE.md` with Operator Cockpit-specific standards.

**When in conflict:** 
- If CLAUDE.md says "do X" and DEVELOPMENT.md says "do Y", use CLAUDE.md
- If DEVELOPMENT.md is more strict, use DEVELOPMENT.md
- Update DEVELOPMENT.md if a new principle emerges that applies globally

**Both files must stay in sync.** Any update to development philosophy should be reflected in both.

---

## 11. Debugging Toolkit & Inspection Checklist

When a feature seems broken, inspect at all layers before assuming it's broken:

### Layer 1: Backend API
```bash
# Test the endpoint directly
curl -s http://localhost:3001/api/auto-approve | jq .

# Check response status
curl -w "\nStatus: %{http_code}\n" http://localhost:3001/api/auto-approve

# Check server logs
tail -50 /tmp/dev-server.log
tail -50 /tmp/bridge.log
```

### Layer 2: Browser Console
Open DevTools (F12) → Console tab. Look for:
- `[ApprovalQueue]` logs (component state)
- `[AutoApprove]` logs (feature logic)
- Any red errors or yellow warnings
- **Filter by component name** to isolate issues

### Layer 3: Network Tab
Open DevTools → Network tab. For each API call:
- Request: Is it going to the right endpoint?
- Response: Is status 200? Is data correct?
- Timing: Is the call slow? Does it hang?

**Example:** Auto-approve toggle not syncing
- Open Network tab
- Click toggle
- Look for POST to `/api/auto-approve`
- Check response contains `{"global": true}`
- If response shows `false`, backend didn't save it

### Layer 4: Storage/State
Open DevTools → Storage tab:
- **localStorage** — Session persistence (reload test)
- Check keys: `operator-cockpit:*`
- Verify data survives page reload

### Layer 5: React DevTools
Install React DevTools browser extension:
- Inspect component state (`autoApprove` should be `true`)
- Check if component is re-rendering when expected
- Verify props match what you expect

### Example: Toggle Debugging Flowchart
```
Toggle shows "OFF" but API says global=true?

1. Check console for [ApprovalQueue] logs
   → If no logs, component didn't mount properly
   → If logs show fetching... false, API returned wrong value

2. Check Network tab for GET /api/auto-approve
   → If response is {"global": false}, backend state is wrong
   → If response is {"global": true}, component didn't parse it

3. Check React DevTools
   → If autoApprove state = false, useEffect didn't run
   → If autoApprove state = true, UI rendering is wrong

4. Check localStorage
   → If no entries, data isn't persisting

This narrows it down to exactly which layer failed.
```

---

## 12. Error Handling Standards

Every feature must handle failure gracefully:

### API Call Failures
```typescript
// ❌ Bad: Silent failure
const response = await fetch('/api/auto-approve');
setAutoApprove(response.json().global);

// ✅ Good: Handle errors, log them
const response = await fetch('/api/auto-approve');
if (!response.ok) {
  console.error(`[AutoApprove] API error: ${response.status}`);
  setAutoApprove(false); // Safe default
  return;
}
try {
  const data = await response.json();
  setAutoApprove(data.global ?? false);
} catch (err) {
  console.error(`[AutoApprove] Parse error:`, err);
  setAutoApprove(false);
}
```

### Network Failures
```typescript
// ❌ Bad: No timeout, no retry
await fetch('/api/auto-approve');

// ✅ Good: Timeout, retry, fallback
const fetchWithTimeout = async (url, timeout = 5000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`[AutoApprove] Network error:`, err);
    return null; // Return null on failure, caller handles it
  }
};
```

### Component Defaults
- If API call fails, component should have a safe default state
- Don't leave UI in a broken state
- Log errors so they can be debugged

---

## 13. Contract Definition (Before Coding)

Before building any feature, document the API contract:

### API Contract Template
```markdown
## Auto-Approve Setting

### GET /api/auto-approve
Returns the current auto-approve settings

**Response:**
```json
{
  "global": true,                    // Global auto-approve enabled
  "test-agent": true,                // Per-agent override
  "cockpit-agent": false
}
```

**Error Cases:**
- 500: Server error reading settings
- Response: `{"error": "Failed to read settings"}`

### POST /api/auto-approve
Set auto-approve for an agent

**Request:**
```json
{
  "agentId": "global",               // Or specific agent ID
  "enabled": true
}
```

**Response:**
```json
{
  "ok": true,
  "agentId": "global",
  "enabled": true
}
```

**Error Cases:**
- 400: Missing required fields
- 500: Server error writing settings
```

**Why this matters:** Before building UI, you know:
1. Exact response schema
2. Error cases to handle
3. Which fields are required
4. What defaults to use if API fails

No guessing. No surprises.

---

## 14. State Inspection Protocol

When state doesn't match between backend and frontend:

### Step 1: Verify Backend State
```bash
# Get raw API response
curl -s http://localhost:3001/api/auto-approve | jq .

# Get file system state (if persistent)
cat ~/.operator-state/auto-approve-settings.json

# Check bridge state (if cached)
curl -s http://localhost:3002/metrics | jq '.auto_approve'
```

### Step 2: Verify Frontend State
```javascript
// In browser console:
// Get component state
document.querySelector('[data-testid="auto-approve-toggle"]').textContent

// Get stored state
localStorage.getItem('operator-cockpit:auto-approve')

// Check React state (with React DevTools)
// Components → ApprovalQueue → Props / State
```

### Step 3: Verify Sync
```bash
# Fetch API state
API_STATE=$(curl -s http://localhost:3001/api/auto-approve | jq '.global')
echo "API: $API_STATE"

# Check what UI shows
UI_STATE=$(curl -s http://localhost:3001 | grep -o "Auto-approve ON\|Auto-approve OFF")
echo "UI: $UI_STATE"

# If different, component didn't call useEffect or parsing failed
```

---

## 15. Performance Baseline

Before considering a feature "complete," establish performance baseline:

```bash
# Measure API response time
time curl http://localhost:3001/api/auto-approve > /dev/null

# Measure page load time
curl -s http://localhost:3001 | wc -c
```

If any API call takes >1 second or page size >1MB, investigate.

---

## 16. Breaking Changes Protocol

When changing an API contract:

1. **Document the change** — old schema → new schema
2. **Plan the migration** — how do old clients handle new response?
3. **Add version header** — `X-API-Version: 2` to indicate breaking change
4. **Deprecate gradually** — old and new endpoints can coexist
5. **Update all clients** — frontend must handle new schema before deploying backend

Example: If approval API changes from `{"status": "pending"}` to `{"state": "pending"}`:
- Add new field: `{"status": "pending", "state": "pending"}`
- Update UI to read `state` field
- Migrate data and remove old field
- Only then is the change backward-compatible

**Never deploy a breaking change where old UI talks to new API** without verifying they're compatible.

---

## Summary

**The Non-Negotiable Rule:**

> No feature is complete until you have verified in a single test session that:
> 1. Backend API works (test with curl)
> 2. Frontend displays correct data (visual inspection in browser)
> 3. Frontend state syncs with backend (reload test)
> 4. User interactions work end-to-end (click buttons, see results)

**Apply this to every pull request, every deployment, every change.**

Anything less is incomplete work.

---

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-19 | Initial version: Capture lessons from auto-approve feature debugging | Claude Code |

