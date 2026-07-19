# Development Standards — Operator Cockpit

**Reference:** See `/Users/joshuaminton/CLAUDE.md` for global development rules.

---

## ⚡ One-Page Quick Reference (START HERE)

### The Core Rule
**No feature is complete until BOTH backend AND frontend are verified in a single test pass.**

### Before You Start
1. Read the API contract (Section 2)
2. Build backend first, then UI (Section 3)
3. Never mark done without passing all 8 gates (Section 4)

### Pre-Deployment Checklist (All Must Pass)
| Gate | What to Check | Fail Action |
|------|---------------|-------------|
| Build | `npm run build` exits 0, no TS errors | Stop, fix |
| Servers | `curl localhost:3001` + `curl localhost:3002` respond | Stop, restart |
| API State | `curl /api/approvals` returns correct data | Stop, verify API |
| UI Display | Page shows correct state (visual check) | Stop, debug component |
| State Sync | Reload page, state persists, matches API | Stop, verify storage |
| Interactions | Click buttons, see updates in real-time | Stop, test in browser |
| Tests | Run `npm run test:e2e`, all pass | Stop, fix tests |
| Git | `git status` clean, all committed | Stop, stage & commit |

### Testing Requirements

| Test Type | When | Example |
|-----------|------|---------|
| **Unit** | Every function/component | `decideApproval()` returns correct status |
| **Integration** | API + UI together | ApprovalQueue fetches and displays setting |
| **E2E** | Full user journey | User clicks toggle → approval auto-decides → queue updates |

### Debugging Order (When Something Breaks)

```
1. API Working?
   ├─ curl http://localhost:3001/api/approvals
   └─ Check response status and data

2. UI Renders Data?
   ├─ Browser DevTools → Console
   ├─ Check for errors, Component logs
   └─ Inspect DOM for expected elements

3. State Syncs?
   ├─ Browser DevTools → Storage
   ├─ Check localStorage has data
   └─ Reload page, verify state persists

4. User Actions Work?
   ├─ Click button, watch Network tab
   ├─ Check API call goes to right endpoint
   └─ Verify response matches what UI expects

STOP at first failure, investigate there.
```

### Deployment (Safe Order)
1. All 8 gates pass ✅
2. Merge to main
3. Tag: `git tag v1.2.3 && git push origin v1.2.3`
4. CI runs full test suite
5. Deploy to staging, smoke test
6. If OK, deploy to prod
7. Watch logs for 1 hour
8. If broken, see Incident Response (Section 9)

### If Production Breaks
1. **Is it critical?** Yes → Rollback immediately. No → Investigate.
2. **To rollback:** `git reset --hard <previous-tag> && git push --force && npm run build && npm run dev`
3. **Root cause:** What changed? Why didn't tests catch it?
4. **Prevention:** Add test case, update this doc if new pattern.

---

## 1. API Contract Definition (Before Coding)

**You must document the API contract BEFORE building the UI.**

```markdown
## [Feature Name]

**Endpoint:** GET/POST /api/endpoint

**Request:**
```json
{ "field": "value", "required": true }
```

**Response:**
```json
{ "ok": true, "data": { "status": "pending" } }
```

**Error Cases:**
- 400: Missing required field (example)
- 500: Server error reading data (example)
```

Why: Eliminates guessing about response schema. UI knows exactly what to expect.

---

## 2. Development Workflow (Bottom-Up Only)

### ❌ Do NOT Do This (Top-Down)
```
UI component (assume API exists)
    ↓
Hope API matches
    ↓
Find bugs in production
```

### ✅ Do This (Bottom-Up)
```
1. Define API contract (document first)
2. Implement API endpoint (database → response)
3. Test API with curl (verify status, data)
4. Build UI to match API response
5. Test UI + API together (real API, not mocks)
6. Test state sync (reload, localStorage)
7. Mark complete (after all gates pass)
```

---

## 3. Quality Gates (8-Point Gate — All Required)

| # | Gate | Verification Command | Pass Criteria |
|---|------|----------------------|---------------|
| 1 | **Build** | `npm run build 2>&1 \| grep error` | No errors |
| 2 | **Dev Server** | `curl -s http://localhost:3001/health` | Status 200 |
| 3 | **Bridge** | `curl -s http://localhost:3002/health` | Status 200 |
| 4 | **API State** | `curl -s http://localhost:3001/api/approvals \| jq .` | Correct data |
| 5 | **UI Display** | Open browser, visual check | Shows correct state |
| 6 | **State Sync** | Reload page, state preserved | Matches before reload |
| 7 | **Tests Pass** | `npm run test:e2e` | Exit code 0 |
| 8 | **Git Clean** | `git status` | No uncommitted changes |

**Stop at first failure. Do not proceed until fixed.**

---

## 4. Code Review Checklist (Before Merge)

| Item | Check |
|------|-------|
| Build | ✅ `npm run build` passes, no TS errors |
| Tests | ✅ New tests added + all pass |
| API Contract | ✅ Frontend uses API exactly as documented |
| Error Handling | ✅ All errors logged, user sees message |
| State Sync | ✅ UI matches API after reload |
| Console | ✅ No errors in DevTools console |
| Performance | ✅ No new slowdowns, API calls <1s |
| Security | ✅ No hardcoded secrets, input validated |
| Docs | ✅ API/feature docs updated if changed |
| Backwards Compat | ✅ Old clients can still use API |

**Send back if any fail. Do not merge.**

---

## 5. Testing (Unit / Integration / E2E)

### Unit Tests (Most)
```typescript
// Test single function
test('decideApproval moves approval to approved', () => {
  const result = decideApproval('id-1', 'approved');
  expect(result.status).toBe('approved');
});
```

### Integration Tests (Some)
```typescript
// Test API + Component together
test('ApprovalQueue fetches and displays auto-approve setting', async () => {
  render(<ApprovalQueue />);
  await waitFor(() => expect(screen.getByText(/Auto-approve ON/)));
});
```

### E2E Tests (Few, But Critical)
```bash
# Real browser, real journey
1. Navigate to UI
2. Click button
3. See expected result
```

**Pyramid:** Many unit tests, fewer integration, very few E2E. Each layer builds confidence in the one below.

---

## 6. Debugging Flowchart

```
Feature seems broken?

├─ API returns wrong data?
│  ├─ Check curl: curl http://localhost:3001/api/endpoint | jq .
│  ├─ Check database: cat ~/.operator-state/data.json
│  ├─ Check bridge logs: tail -50 /tmp/bridge.log
│  └─ Fix backend
│
├─ API returns correct data but UI shows wrong?
│  ├─ Check browser console: DevTools → Console tab
│  ├─ Check network: DevTools → Network tab → check request/response
│  ├─ Check React state: React DevTools → Props/State
│  ├─ Check localStorage: DevTools → Storage → localStorage
│  └─ Fix component logic
│
├─ UI shows correct on first load but wrong after reload?
│  ├─ Check localStorage: DevTools → Storage
│  ├─ Check if data persists: localStorage.getItem('key')
│  ├─ Check API on reload: Network tab → watch requests
│  └─ Fix persistence layer
│
└─ User clicks button but nothing happens?
   ├─ Check network: DevTools → Network tab, click button
   ├─ Check if API call fires: Should see POST to /api/...
   ├─ Check response: Should see 200, correct data
   ├─ Check if UI updates: Watch component re-render
   └─ Fix interaction handler
```

**Key Rule:** Start at the lowest layer (API), verify it works, then move up. Don't debug the UI if the API is wrong.

---

## 7. Deployment (Step-by-Step)

### Pre-Deploy Checks (Same Commit)
- All 8 gates pass ✅
- Code review complete ✅
- Tests passing ✅
- No console errors ✅

### Deploy Steps (In Order)
| Step | Command | Wait For | Verify |
|------|---------|----------|--------|
| 1 | Merge PR | CI passes | Green checkmark |
| 2 | Tag release | — | `git tag v1.2.3` created |
| 3 | Push tag | CI runs | Build succeeds |
| 4 | Deploy staging | — | Run `npm run build && npm start` |
| 5 | Smoke test staging | — | Key features work |
| 6 | Deploy prod | — | Same as staging |
| 7 | Health check | — | `/health` endpoint responds |
| 8 | Monitor logs | 1 hour | No spike in errors |

### If Deploy Breaks
- **< 5 min diagnosis → keep investigating**
- **> 5 min to fix → rollback immediately**

### Rollback (Emergency)
```bash
git reset --hard <previous-tag>  # e.g., v1.2.2
git push --force origin main
npm run build && npm run dev
# Verify: curl localhost:3001/health
```

---

## 8. Security Checklist (Before Production)

| Item | Check |
|------|-------|
| Secrets | ❌ No API keys, passwords in code |
| Input | ✅ All user input validated |
| XSS | ✅ No unsanitized HTML rendering |
| Auth | ✅ Endpoints check permissions |
| Errors | ✅ Error messages don't leak internals |
| Logging | ✅ Don't log passwords or tokens |
| SQL | ✅ Parameterized queries only (if DB used) |
| CORS | ✅ Don't allow all origins |

---

## 9. Incident Response (When It Breaks)

```
PRODUCTION INCIDENT

IMMEDIATE (0-5 min)
├─ Confirm: Is it really broken? (not just flaky)
├─ Assess: How many users? Critical or minor?
├─ Decide: Fix or rollback?
│  ├─ Can you fix it in <5 min? → Fix it
│  └─ Will it take >5 min? → Rollback (don't debug in prod)
└─ Communicate: Post to Slack #incidents "Service down, rolling back..."

STABILIZE (5-15 min)
├─ Execute rollback (see Section 7)
├─ Verify service is back (curl health check)
└─ Confirm users can use feature again

ROOT CAUSE (15-60 min)
├─ What changed? (git log)
├─ Why didn't tests catch it? (test gap)
├─ Document findings
└─ Create ticket to prevent next time

PREVENTION (Next Day)
├─ Add test case for what broke
├─ Update DEVELOPMENT.md if new pattern
├─ Deploy fix
└─ Post incident summary in Slack
```

---

## 10. Monitoring (Watch Post-Deployment)

**First Hour After Deploy:**
- [ ] `/health` endpoint responds
- [ ] No spike in error rate (check logs)
- [ ] API response times normal (<1s)
- [ ] No new console errors
- [ ] Database queries performing

**Set Alerts:**
- Error rate > 10/hour → Slack alert
- Response time > 2s → Warning log
- API down > 2min → Page on-call
- State mismatch detected → Immediate alert

---

## 11. Documentation (What to Write)

| Doc | When | Example |
|-----|------|---------|
| **API Docs** | Feature has API | GET /api/auto-approve response schema |
| **Feature Docs** | User-facing feature | How to use auto-approve, limitations |
| **ADR** | Important decision | Why we chose bridge-level auto-approve |
| **Test Docs** | Complex tests | What each test covers, why it's needed |

**Format:** What does it do? How to use? Limitations? When/when NOT to use?

---

## 12. Architecture Decision Records (ADR)

When making important decisions, document them:

```markdown
# ADR-001: Auto-Approve at Bridge Level

**Decision:** Implement auto-approve in bridge, not UI

**Why:**
- Bridge is source of truth for auto-approve setting
- Prevents race conditions if UI and bridge disagree

**Tradeoff:**
- Slightly slower (network latency)
- But more reliable

**Alternatives Considered:**
- UI-only approval (simpler, but bridge wouldn't know about it)

**Date:** 2026-07-19
**Status:** Accepted
```

Store in `docs/adr/` so future developers understand *why* code is structured this way.

---

## 13. Dependencies (Keep Systems Healthy)

| Action | When | How |
|--------|------|-----|
| **Security updates** | Immediately | `npm update`, test, commit |
| **Minor updates** | Next sprint | Same |
| **Major updates (X.0)** | Plan ahead | Read changelog, test extensively |
| **Ignore** | Outdated package | Only if it's not used |

**Never:** Update dependencies right before release. Update, test, then release.

---

## 14. Lessons from This Session

### What Went Wrong
- Marked backend "complete" before testing UI
- Documented toggle state issue as "known limitation" instead of fixing
- Separated testing into phases (backend, then frontend)
- Didn't verify both layers together before marking done

### What We Learned
- UI state sync is not optional
- "Works" and "proven to work" are different
- Reload test is mandatory (if UI claims to persist state)
- One bug caught too late = need external standards
- This document exists because Claude Code doesn't enforce standards

### How We Fixed It
- Integrated backend + frontend testing in one session
- Added state sync verification (localStorage, reload)
- Created 8-point gate (can't proceed without all passing)
- Documented standards so they survive across sessions

---

## 15. Integration with Global CLAUDE.md

This DEVELOPMENT.md extends `/Users/joshuaminton/CLAUDE.md` with Operator Cockpit-specific standards.

**Each project repo MUST have a DEVELOPMENT.md** that covers:
- Integrated testing (backend + frontend together)
- Quality gates (what must pass)
- Deployment procedure (step-by-step)
- Incident response (what to do if broken)
- Debugging flowchart (where to look)

---

## Summary

**The Non-Negotiable Rule:**

> No feature is complete until you have verified in a single test session that:
> 1. Backend API works (curl test)
> 2. Frontend displays correct data (visual inspection)
> 3. Frontend state syncs with backend (reload test)
> 4. User interactions work end-to-end (browser testing)
> 5. All tests pass (regression suite)

**Apply the 8-Point Gate to every pull request.**

This is the standard. No exceptions.

---

## Revision History

| Date | Change |
|------|--------|
| 2026-07-19 | Initial version: Comprehensive development standards |
| 2026-07-19 | Restructured: Condensed to quick-reference format with tables and flowcharts |

