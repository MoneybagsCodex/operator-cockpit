# Auto-Approve API

## GET /api/auto-approve

Retrieve auto-approve settings for all agents and global.

### Response

**Status:** 200 OK

**Body:**
```json
{
  "global": true,
  "agent-1": false,
  "agent-2": true,
  "test-agent": false
}
```

Each key is an agent ID or "global". Value is boolean: `true` = auto-approve enabled, `false` = disabled.

### Error Responses

**Status:** 500 Internal Server Error
```json
{
  "error": "Failed to read auto-approve settings"
}
```

### Examples

```bash
# Get all auto-approve settings
curl http://localhost:3001/api/auto-approve

# Check if global auto-approve is enabled
curl http://localhost:3001/api/auto-approve | jq '.global'

# Check specific agent
curl http://localhost:3001/api/auto-approve | jq '.["agent-1"]'
```

---

## POST /api/auto-approve

Enable or disable auto-approve for an agent or globally.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| agentId | string | Yes | 'global' for global setting, or specific agent ID |
| enabled | boolean | Yes | true = enable, false = disable |

### Response

**Status:** 200 OK

**Body:**
```json
{
  "ok": true,
  "agentId": "global",
  "enabled": true
}
```

### Error Responses

**Status:** 400 Bad Request
```json
{
  "error": "Missing required fields: agentId, enabled"
}
```

**Status:** 500 Internal Server Error
```json
{
  "error": "Failed to update auto-approve setting"
}
```

### Examples

```bash
# Enable global auto-approve (all agents)
curl -X POST http://localhost:3001/api/auto-approve \
  -H "Content-Type: application/json" \
  -d '{ "agentId": "global", "enabled": true }'

# Disable auto-approve for specific agent
curl -X POST http://localhost:3001/api/auto-approve \
  -H "Content-Type: application/json" \
  -d '{ "agentId": "agent-1", "enabled": false }'

# Enable auto-approve for specific agent
curl -X POST http://localhost:3001/api/auto-approve \
  -H "Content-Type: application/json" \
  -d '{ "agentId": "agent-2", "enabled": true }'
```

---

## How It Works

### UI Flow (Frontend)
1. User opens dashboard
2. `ApprovalQueue` component mounts
3. Component calls `GET /api/auto-approve`
4. Fetches current setting for agent (or global)
5. Displays toggle showing current state
6. User clicks toggle
7. Component calls `POST /api/auto-approve` to update setting
8. Backend persists change
9. Component state updates
10. Toggle displays new state

### Bridge Flow (Backend)
1. Bridge starts, loads auto-approve settings
2. For each session with auto-approve enabled:
   - When new approval created, bridge detects it
   - Bridge calls `GET /api/approvals?status=pending`
   - For each pending approval for that agent:
     - If auto-approve enabled: call `POST /api/approvals/[id]/decide` with `decision: "approved"`
     - Bridge injects 'y\n' into terminal (auto-response)

---

## Storage

Auto-approve settings are stored in `~/.operator-state/auto-approve-settings.json`:

```json
{
  "global": true,
  "agent-1": false,
  "agent-2": true
}
```

Changes are persisted immediately when `POST /api/auto-approve` is called.

---

## Behavior

### When Auto-Approve is Enabled (true)

**For Pending Approvals:**
- Bridge automatically moves approval to "approved" status
- Bridge injects 'y\n' (yes response) into terminal
- Agent continues execution without manual approval
- Approval appears in queue as "approved" (already decided)
- User sees it moved but didn't have to act

**Behavior:**
- All pending approvals for agent are auto-decided
- No user confirmation needed
- Logged for audit trail
- Can be disabled at any time

### When Auto-Approve is Disabled (false)

**For Pending Approvals:**
- Approval stays in "pending" state
- Bridge does NOT auto-decide it
- User must manually approve via UI or API
- Approval waits in queue until decided

---

## Safety Notes

⚠️ **AUTO-APPROVE IS POWERFUL**

Enabling auto-approve means:
- All approvals are automatically granted
- No human review
- Risky commands (git push, delete, deploy) run without confirmation
- Only enable for trusted agents
- Only use in controlled environments

**Recommendation:** Enable only for:
- Local development agents
- Trusted automation pipelines
- When you understand all possible actions

**Never enable for:**
- Production deployment agents (unless explicitly tested)
- Untrusted third-party agents
- Security-sensitive operations

---

## Audit Trail

When auto-approve is used:
1. Approval record includes who auto-approved it
2. Bridge logs show auto-approval
3. Decision timestamp recorded
4. Can be queried for compliance/audit

Example bridge log:
```
[Bridge] Auto-approving approval-001 for agent-1 (auto-approve=true)
[Bridge] Approval moved to approved
[Bridge] Injected 'y\n' into terminal
```
