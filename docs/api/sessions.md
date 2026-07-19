# Sessions API

## GET /api/sessions

Retrieve all active terminal sessions.

### Response

**Status:** 200 OK

**Body:**
```json
{
  "sessions": [
    {
      "id": "session-001",
      "agentId": "test-agent",
      "status": "live",
      "createdAt": "2026-07-19T12:00:00.000Z",
      "uptime": "1m 23s",
      "lines": 42,
      "tokens": 1234,
      "processId": 12345,
      "buffer": ["line 1", "line 2", ...]
    }
  ]
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique session identifier |
| agentId | string | Agent running in this session |
| status | string | 'live', 'paused', 'reconnecting' |
| createdAt | ISO string | When session was created |
| uptime | string | How long session has been running |
| lines | number | Lines of output generated |
| tokens | number | Estimated tokens consumed |
| processId | number | PID of Claude process |
| buffer | string[] | Recent output lines (last 50) |

### Examples

```bash
# Get all sessions
curl http://localhost:3001/api/sessions

# Get session count
curl http://localhost:3001/api/sessions | jq '.sessions | length'

# Get most recent session
curl http://localhost:3001/api/sessions | jq '.sessions[-1]'
```

---

## POST /api/sessions

Create a new terminal session.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| agentId | string | Yes | Agent to run in this session |
| workingDirectory | string | No | Starting directory (default: ~) |

### Response

**Status:** 201 Created

**Body:**
```json
{
  "ok": true,
  "session": {
    "id": "session-001",
    "agentId": "test-agent",
    "status": "live",
    "createdAt": "2026-07-19T12:00:00.000Z"
  }
}
```

### Error Responses

**Status:** 400 Bad Request
```json
{
  "error": "Missing required field: agentId"
}
```

**Status:** 500 Internal Server Error
```json
{
  "error": "Failed to create session"
}
```

### Example

```bash
curl -X POST http://localhost:3001/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "my-agent",
    "workingDirectory": "/Users/josh/projects"
  }'
```

---

## GET /api/sessions/[id]

Get details for a specific session.

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Session ID |

### Response

**Status:** 200 OK

**Body:**
```json
{
  "id": "session-001",
  "agentId": "test-agent",
  "status": "live",
  "createdAt": "2026-07-19T12:00:00.000Z",
  "uptime": "1m 23s",
  "lines": 42,
  "tokens": 1234,
  "processId": 12345,
  "buffer": ["line 1", "line 2", ...],
  "metadata": {
    "workingDirectory": "/Users/josh",
    "shell": "bash",
    "columns": 80,
    "rows": 24
  }
}
```

### Error Responses

**Status:** 404 Not Found
```json
{
  "error": "Session session-001 not found"
}
```

### Example

```bash
curl http://localhost:3001/api/sessions/session-001 | jq .
```

---

## POST /api/sessions/[id]/send

Send input (keystroke) to a session.

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Session ID to send to |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| message | string | Yes | Input to send (e.g., 'y' for yes) |

### Response

**Status:** 200 OK

**Body:**
```json
{
  "ok": true,
  "lines": 45
}
```

### Error Responses

**Status:** 404 Not Found
```json
{
  "error": "Session not found"
}
```

**Status:** 500 Internal Server Error
```json
{
  "error": "Failed to send to session"
}
```

### Examples

```bash
# Send 'y' (yes response)
curl -X POST http://localhost:3001/api/sessions/session-001/send \
  -H "Content-Type: application/json" \
  -d '{ "message": "y" }'

# Send command with newline
curl -X POST http://localhost:3001/api/sessions/session-001/send \
  -H "Content-Type: application/json" \
  -d '{ "message": "git status\n" }'

# Send Ctrl+C
curl -X POST http://localhost:3001/api/sessions/session-001/send \
  -H "Content-Type: application/json" \
  -d '{ "message": "" }'
```

---

## DELETE /api/sessions/[id]

End a session (kill the process).

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Session ID to close |

### Response

**Status:** 200 OK

**Body:**
```json
{
  "ok": true,
  "message": "Session closed"
}
```

### Error Responses

**Status:** 404 Not Found
```json
{
  "error": "Session not found"
}
```

### Example

```bash
curl -X DELETE http://localhost:3001/api/sessions/session-001
```

---

## WebSocket Connection

Each session has a WebSocket endpoint for real-time communication.

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3002/sessions/session-001');

ws.onmessage = (event) => {
  // Received output from terminal
  console.log(event.data);
};

ws.send('y');  // Send input
```

### Message Format

**From server (output):**
```json
{
  "type": "output",
  "data": "line of text\n",
  "lineCount": 45
}
```

**From client (input):**
```
y
```

---

## State Transitions

```
CREATE (POST /api/sessions)
  ↓
  status: "live" (Claude process running)
  ↓
  User can: SEND (/send), GET (/api/sessions/[id])
  ↓
DELETE (DELETE /api/sessions/[id])
  ↓
  Process killed, session ended
```

---

## Persistence

Session state is persisted to disk in `~/.operator-state/sessions/`:

```
~/.operator-state/sessions/
├── session-001.json       (metadata)
└── session-001.jsonl      (output log, one line per message)
```

On bridge restart, sessions are restored from disk and reattached to running processes.

---

## See Also

- [Terminal I/O Architecture](../adr/001-bridge-manages-sessions.md)
- TerminalPanel component: `src/components/TerminalPanel.tsx`
- Bridge implementation: `src/bridge/terminal.ts`
