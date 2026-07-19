# Approvals API

## GET /api/approvals

Retrieve all approvals (pending, approved, rejected, needs-revision).

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| status | string | No | 'all' | Filter by status: 'pending', 'approved', 'rejected', 'needs-revision', or 'all' |

### Response

**Status:** 200 OK

**Body:**
```json
[
  {
    "id": "approval-test-1",
    "agentId": "test-agent-1",
    "projectId": "operator-cockpit",
    "status": "pending",
    "action": "Run: git push origin main",
    "description": "Push changes to main branch",
    "rationale": "Latest changes ready for production",
    "riskLevel": "high",
    "affectedSystems": ["GitHub", "CI/CD"],
    "expectedOutcome": "Changes pushed to remote",
    "createdAt": "2026-07-19T12:00:00.000Z",
    "decidedAt": "2026-07-19T12:05:00.000Z"
  }
]
```

### Error Responses

**Status:** 500 Internal Server Error
```json
{
  "error": "Failed to read approvals"
}
```

### Examples

```bash
# Get all approvals
curl http://localhost:3001/api/approvals

# Get only pending approvals
curl http://localhost:3001/api/approvals?status=pending

# Get approved approvals
curl http://localhost:3001/api/approvals?status=approved
```

---

## POST /api/approvals

Create a new approval request.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Unique approval identifier |
| agentId | string | Yes | Agent that requested approval |
| action | string | Yes | Action being requested (e.g., "git push") |
| description | string | No | Human-readable description |
| rationale | string | Yes | Why this action is needed |
| riskLevel | string | Yes | 'low', 'medium', 'high', 'critical' |
| affectedSystems | string[] | Yes | Systems that will be impacted |
| expectedOutcome | string | Yes | Expected result if approved |
| projectId | string | Yes | Project this approval belongs to |

### Response

**Status:** 201 Created

**Body:**
```json
{
  "ok": true,
  "id": "approval-test-1"
}
```

### Error Responses

**Status:** 400 Bad Request
```json
{
  "error": "Missing required fields: id, agentId, action"
}
```

**Status:** 500 Internal Server Error
```json
{
  "error": "Failed to create approval"
}
```

### Example

```bash
curl -X POST http://localhost:3001/api/approvals \
  -H "Content-Type: application/json" \
  -d '{
    "id": "approval-001",
    "agentId": "my-agent",
    "action": "Deploy to production",
    "description": "Deploy latest build",
    "rationale": "All tests passed, ready for production",
    "riskLevel": "high",
    "affectedSystems": ["Production API", "Database"],
    "expectedOutcome": "New version live in production",
    "projectId": "operator-cockpit"
  }'
```

---

## POST /api/approvals/[id]/decide

Move an approval from one status to another (decide on it).

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Approval ID to decide on |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| decision | string | Yes | 'approved', 'rejected', or 'needs-revision' |
| notes | string | No | Optional notes about the decision |

### Response

**Status:** 200 OK

**Body:**
```json
{
  "ok": true,
  "approval": {
    "id": "approval-test-1",
    "agentId": "test-agent-1",
    "status": "approved",
    "action": "Run: git push origin main",
    "decidedAt": "2026-07-19T12:05:00.000Z"
  }
}
```

### Error Responses

**Status:** 400 Bad Request
```json
{
  "error": "Invalid decision. Must be: approved, rejected, needs-revision"
}
```

**Status:** 404 Not Found
```json
{
  "error": "Approval approval-test-1 not found"
}
```

**Status:** 500 Internal Server Error
```json
{
  "error": "Failed to update approval"
}
```

### Examples

```bash
# Approve an approval
curl -X POST http://localhost:3001/api/approvals/approval-001/decide \
  -H "Content-Type: application/json" \
  -d '{ "decision": "approved", "notes": "Looks good, approved" }'

# Reject an approval
curl -X POST http://localhost:3001/api/approvals/approval-001/decide \
  -H "Content-Type: application/json" \
  -d '{ "decision": "rejected", "notes": "Need to rebase first" }'

# Request changes
curl -X POST http://localhost:3001/api/approvals/approval-001/decide \
  -H "Content-Type: application/json" \
  -d '{ "decision": "needs-revision", "notes": "Update commit message" }'
```

---

## State Flow

```
CREATE (POST /api/approvals)
  ↓
  status: "pending"
  ↓
DECIDE (POST /api/approvals/[id]/decide)
  ├─ decision: "approved" → status: "approved"
  ├─ decision: "rejected" → status: "rejected"
  └─ decision: "needs-revision" → status: "needs-revision"
```

---

## Storage

Approvals are stored in `~/.operator-state/approvals/` by status:
- `pending/` — Awaiting decision
- `approved/` — Approved approvals
- `rejected/` — Rejected approvals
- `needs-revision/` — Awaiting revision

Each approval is stored as `{id}.json`.

---

## Integration with Auto-Approve

When auto-approve is enabled for an agent:
1. Bridge detects pending approval for that agent
2. Bridge calls `POST /api/approvals/[id]/decide` with `decision: "approved"`
3. Approval moves to approved status automatically
4. Bridge injects auto-response into terminal

See `/docs/adr/003-auto-approve-bridge-level.md` for architecture details.
