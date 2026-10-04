# Approval Queue Integration — Option 3: Pre-Tool-Use Hook

**Status:** ✅ Implemented and tested

This document explains how the operator-cockpit routes Claude Code tool execution through the approval queue system using Claude Code's pre-tool-use hook mechanism.

---

## Overview

When agents run inside the cockpit, every tool execution that could impact the system is intercepted by a pre-tool-use hook before it executes. The hook:

1. **Detects cockpit mode** — checks `COCKPIT_APPROVAL_BRIDGE=1` environment variable
2. **Classifies tool risk** — read-only tools skip approval, write/bash/git tools require it
3. **Creates approval request** — writes to `~/.operator-state/approvals/pending/`
4. **Blocks execution** — waits for approval decision (up to 10 minutes)
5. **Returns decision** — exits with code indicating approval/rejection/timeout
6. **Works with auto-approve** — integrates with cockpit's existing auto-approve toggle

---

## How It Works

### Architecture

```
Claude Code (agent)
    ↓
Tool execution
    ↓
PreToolUse Hook (~/.claude/hooks/pre-tool-use.sh)
    ↓ (if COCKPIT_APPROVAL_BRIDGE=1)
Create approval request
    ↓
Approval Watcher (bridge server, 500ms poll)
    ↓ (if auto-approve enabled)
Auto-approve
    ↓
Return exit code to hook
    ↓
Hook returns to Claude Code
    ↓ (exit 0 = allowed)
Tool executes
```

### Risk Classification

Tools are classified based on their name (case-insensitive matching):

| Risk Level | Tool Examples | Action |
|---|---|---|
| **Low** | Read, List, Grep, Find | Skip approval entirely |
| **Medium** | Write, Edit, Delete, Create | Require approval |
| **High** | Bash, Exec, Shell, Git, Push, Deploy | Require approval + audit trail |

The risk level is included in the approval request so operators can make informed decisions.

### Installation

The hook is automatically installed when the cockpit is set up:

```bash
# 1. Hook script is in the repo
./scripts/pre-tool-use-hook.sh

# 2. Install to Claude Code's hooks directory
cp scripts/pre-tool-use-hook.sh ~/.claude/hooks/pre-tool-use.sh
chmod +x ~/.claude/hooks/pre-tool-use.sh

# 3. Configure Claude Code (in ~/.claude/settings.json)
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/pre-tool-use.sh",
            "shell": "bash"
          }
        ]
      }
    ]
  }
}
```

### Approval Request Format

When a tool is blocked, the hook creates a JSON approval request:

```json
{
  "id": "appr-20261004T010918-213e74",
  "agentId": "cc-session-abc123",
  "projectId": "architecture",
  "status": "pending",
  "action": "Execute shell command: npm run build",
  "rationale": "Tool requires approval before execution",
  "riskLevel": "high",
  "affectedSystems": ["Build system"],
  "expectedOutcome": "Build completes successfully",
  "toolName": "Bash",
  "approveButton": "Allow",
  "rejectButton": "Block",
  "requestChangesButton": "Revise",
  "createdAt": "2026-10-04T01:09:18Z"
}
```

### Exit Codes

The hook returns standard exit codes that Claude Code respects:

```bash
0 → Tool approved, execution allowed
1 → Tool rejected, execution blocked
2 → Needs revision, execution blocked
3 → Timeout (10 min), execution blocked
```

---

## Integration Points

### 1. Bridge Environment

When the bridge spawns an agent, it sets:

```bash
COCKPIT_APPROVAL_BRIDGE=1  # Activates the hook
CLAUDE_SESSION_ID=<uuid>   # Used to attribute approvals to session
OPERATOR_STATE_DIR=$HOME/.operator-state  # Approval queue location
```

### 2. Approval Watcher

The bridge runs a 500ms polling loop that:
- Scans for new approval requests for each session's agent
- Auto-approves if global or agent-specific auto-approve is enabled
- Injects `y\n` or `n\n` into the PTY to answer the prompt

### 3. Dashboard Display

The cockpit dashboard shows:
- Pending approvals in the queue
- Risk level color-coding (low/medium/high)
- Action description + rationale
- Approve/Reject/Revise buttons
- Audit trail of approved/rejected decisions

---

## Testing the Integration

### Standalone Hook Test

Test the hook without a running agent:

```bash
export COCKPIT_APPROVAL_BRIDGE=1
export CLAUDE_SESSION_ID="test-session-$(date +%s)"

# Simulate a tool
echo '{"name": "Bash", "input": "rm -rf /tmp/test"}' | \
  ~/.claude/hooks/pre-tool-use.sh
```

**Expected output:**
```
⏳ Approval requested: Execute shell command: rm -rf /tmp/test (risk: high)
   ID: appr-20261004T...
   Waiting for cockpit decision...
✅ Tool approved — executing.
```

### Dashboard Test

1. Open cockpit: http://localhost:3001
2. Toggle auto-approve ON/OFF
3. Create test agent
4. Run risky command (e.g., `npm run build`)
5. Observe approval in queue
6. Click Approve/Reject
7. Watch agent proceed or stop

---

## Limitations & Future Work

### Current Behavior

- **Auto-approve is all-or-nothing** — if on, all approvals are auto-approved. No per-tool policies yet.
- **Read-only tools skip approval** — conservative approach to avoid approval fatigue
- **Timeout is fixed** — 10 minutes with 2-second poll interval. Could be configurable.
- **Hook is shell-based** — not language-agnostic, but reliable and simple

### Future Enhancements

- [ ] Per-tool approval policies (e.g., "always block rm -rf", "auto-approve npm install")
- [ ] Risk scoring based on command content (e.g., "rm -rf /" is critical, "rm test.txt" is low)
- [ ] Approval templates and quick decisions
- [ ] Batch approval (e.g., "approve next 5 npm tools")
- [ ] Approval notifications (Slack, email)
- [ ] Audit export (JSON/CSV of approval history)

---

## Design Decisions

### Why Option 3 (Hook-Based)?

This implementation was chosen over alternatives because:

1. **True blocking** — commands don't execute until approved (unlike output parsing)
2. **No CLI modification** — works with Claude Code as-is (unlike native permission mode)
3. **Unified approval system** — all approvals visible in cockpit dashboard (not split between CLI and cockpit)
4. **Backward compatible** — agents without `COCKPIT_APPROVAL_BRIDGE` run normally
5. **Simple & reliable** — shell script, no complex integrations

### Why Shell Script?

The hook is a bash script because:
- Claude Code supports shell hooks natively
- No external dependencies (jq, curl available everywhere)
- Easy to debug (plain text, no compilation)
- Fast execution (<100ms per tool)
- Maintainable by non-Go developers

### Why Poll Instead of Wait?

The hook polls the filesystem instead of waiting because:
- No IPC needed between hook and bridge
- Tolerates bridge restarts (approval decision is durable on disk)
- Simple implementation (no sockets, message queues, or pipes)
- Natural integration with cockpit's existing state store

---

## Troubleshooting

### Hooks not running?

1. Verify `~/.claude/hooks/pre-tool-use.sh` exists and is executable:
   ```bash
   ls -la ~/.claude/hooks/pre-tool-use.sh
   chmod +x ~/.claude/hooks/pre-tool-use.sh
   ```

2. Verify hook is configured in `~/.claude/settings.json`:
   ```bash
   cat ~/.claude/settings.json | grep -A5 PreToolUse
   ```

3. Restart Claude Code (the hook config is loaded at startup)

### Approvals not appearing?

1. Verify `COCKPIT_APPROVAL_BRIDGE=1` is set:
   ```bash
   echo $COCKPIT_APPROVAL_BRIDGE  # should be 1
   ```

2. Verify bridge is running:
   ```bash
   curl http://localhost:3002/health
   ```

3. Check approval state directory:
   ```bash
   ls ~/.operator-state/approvals/
   ```

### Auto-approve not working?

1. Check global auto-approve setting:
   ```bash
   cat ~/.operator-state/auto-approve-settings.json | jq .global
   ```

2. Check approval watcher logs:
   ```bash
   tail -50 /tmp/cockpit-bridge.log | grep approval-bridge
   ```

### Hook timeout?

If a hook times out after 10 minutes:
- Check cockpit bridge is still running (`curl localhost:3002/health`)
- Check approval queue for stuck requests (`ls ~/.operator-state/approvals/pending/`)
- Manually approve or reject the request:
   ```bash
   mv ~/.operator-state/approvals/pending/$ID.json \
      ~/.operator-state/approvals/approved/$ID.json
   ```

---

## Related Files

- `scripts/pre-tool-use-hook.sh` — Hook implementation
- `src/bridge/terminal.ts:331-410` — Approval watcher polling loop
- `src/lib/state.ts` — Approval request/decision management
- `src/app/api/approvals/route.ts` — Approval API endpoints
- `src/components/ApprovalQueue.tsx` — Dashboard UI
- `~/.claude/settings.json` — Hook configuration
- `~/.operator-state/approvals/` — Approval queue state

---

## See Also

- [`ARCHITECTURE.md`](../ARCHITECTURE.md) — System overview
- [`docs/api/approvals.md`](./api/approvals.md) — Approval API reference
- [`docs/adr/002-auto-approve-bridge-level.md`](./adr/002-auto-approve-bridge-level.md) — Auto-approve design decision
