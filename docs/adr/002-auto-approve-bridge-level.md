# ADR-002: Auto-Approve Logic at Bridge Level

**Date:** 2026-07-19  
**Status:** Accepted  
**Deciders:** Architecture Review  

---

## Problem

How should auto-approve be implemented?

**Options:**
1. **UI-only:** ApprovalQueue auto-decides and sends approval via API
2. **Bridge-level:** Bridge monitors pending approvals and auto-decides them
3. **Both:** UI and Bridge have auto-approve logic

## Decision

**Bridge implements auto-approve monitoring.**

The bridge server monitors active sessions and automatically decides pending approvals when auto-approve is enabled, rather than having the UI make the decision.

---

## Why Bridge (Not UI)

### Bridge is Source of Truth
- Bridge owns terminal session state
- Bridge owns auto-approve setting
- Bridge knows which agent is running
- Bridge can act immediately on behalf of agent

### If UI Did It
```
Problem: Race condition
┌─────────────────────────────────────────┐
│  Browser Tab 1                          │
│  Auto-approve ON                        │
│  → POST /api/approvals/001/decide       │
│  → Approval moves to approved           │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│  Bridge                                 │
│  Doesn't know approval is approved      │
│  Still waiting for manual approval      │
│  Doesn't inject terminal response       │
└─────────────────────────────────────────┘
                ↓
Terminal stuck waiting for input
```

### Bridge Approach (Correct)
```
┌─────────────────────────────────────────┐
│  Bridge                                 │
│  Detects pending approval               │
│  Checks: auto-approve enabled? YES      │
│  → POST /api/approvals/001/decide       │
│  → Moves to approved                    │
│  → Injects 'y\n' into terminal          │
└─────────────────────────────────────────┘
                ↓
Terminal gets response immediately
Agent continues execution
```

### Authority & Consistency
- Bridge is always the authority for auto-approve setting
- Bridge doesn't need to sync with UI
- Multiple browser tabs can't cause conflicts
- Setting persists even if UI goes down

---

## Implementation

### Flow

**1. Bridge Startup**
```typescript
// Load auto-approve settings
const autoApproveSettings = readAutoApproveSettings();
// { global: true, agent-1: false, ... }
```

**2. When Approval Arrives**
```typescript
const approval = readApproval(id);
const isAutoApprovedForAgent = autoApproveSettings[approval.agentId] 
  ?? autoApproveSettings.global;

if (isAutoApprovedForAgent && approval.status === 'pending') {
  // Auto-approve it
  decideApproval(approval.id, 'approved', 'Auto-approved by bridge');
  // Inject response into terminal
  sendToTerminal('y\n');
}
```

**3. Bridge Monitoring Loop**
```typescript
// Periodically check for new pending approvals
setInterval(() => {
  const pendingApprovals = readApprovals('pending');
  for (const approval of pendingApprovals) {
    if (shouldAutoApprove(approval)) {
      decideApproval(approval.id, 'approved', '...');
      sendToTerminal('y\n');
    }
  }
}, 1000);  // Check every second
```

---

## Tradeoffs

| Aspect | Bridge-Level | UI-Level |
|--------|---|---|
| **Authority** | ✅ Single source of truth | ⚠️ Multiple clients possible |
| **Consistency** | ✅ Always in sync | ❌ UI/Bridge can disagree |
| **Latency** | ✅ Immediate (no network) | ⚠️ Network delay |
| **Complexity** | ⚠️ More code in bridge | ✅ Simpler code |
| **Distributed** | ⚠️ Tightly coupled | ✅ Loosely coupled |

---

## Why Not Both?

**If UI also had auto-approve logic:**
- UI decides and calls `/api/approvals/[id]/decide`
- Bridge also sees it pending and tries to decide
- Race condition: both try to move approval at same time
- One succeeds, one fails with "not found"
- Terminal gets response twice (bad)

**Simpler to centralize:** Let bridge own it entirely.

---

## Security Implications

### Auto-Approve is Powerful
When enabled:
- All risky commands (git push, delete, deploy) run without confirmation
- No human review
- Only enable for trusted agents

### Bridge Enforces
- Only auto-approves if setting is enabled
- Only for specific agent or global
- Can be toggled off via API anytime
- Auditable (logged when auto-approved)

### Safe Defaults
- Auto-approve is OFF by default
- Must be explicitly enabled
- Only in development/testing
- Production approvals require manual review

---

## Consequences

### Accepted
- Bridge code is more complex
- Bridge needs access to approval state
- Bridge needs to periodically poll for approvals

### Benefits
- No race conditions
- Terminal response is immediate
- UI doesn't need special logic
- Setting persists across UI restarts

---

## Monitoring & Debugging

**To verify auto-approve is working:**
```bash
# Enable auto-approve
curl -X POST http://localhost:3001/api/auto-approve \
  -d '{"agentId": "global", "enabled": true}'

# Create a pending approval
curl -X POST http://localhost:3001/api/test/approval \
  -d '{"agentId": "test-agent", "action": "test"}'

# Check bridge logs
tail /tmp/bridge.log | grep auto-approve
# Should show: [Bridge] Auto-approving approval-001
```

**If approval is NOT auto-approved:**
1. Check if auto-approve is enabled: `/api/auto-approve`
2. Check if approval is pending: `/api/approvals?status=pending`
3. Check bridge logs: `tail /tmp/bridge.log`
4. Check if bridge is running: `curl http://localhost:3002/health`

---

## Related Decisions

- [[ADR-001: Bridge Manages Sessions]] — Bridge owns terminal state
- Bridge approval polling logic: `src/bridge/terminal.ts`
- Auto-approve API: `/docs/api/auto-approve.md`

---

## References

- Implementation: `src/bridge/terminal.ts` lines 177-207
- API Reference: `GET|POST /api/auto-approve`
- Testing: `e2e/auto-approve.spec.ts`
