# ADR-001: Bridge Manages Terminal Sessions

**Date:** 2026-07-19  
**Status:** Accepted  
**Deciders:** System Architecture  

---

## Problem

How should terminal sessions be managed in a multi-terminal cockpit?

**Options:**
1. **UI manages sessions** (React state) → Bridge is stateless
2. **Bridge manages sessions** (Node.js server state) → UI is client to bridge
3. **Hybrid** (UI + Bridge share responsibility)

## Decision

**Bridge manages terminal sessions.**

The bridge server (Node.js on port 3002) is the authoritative owner of terminal state, PTY processes, WebSocket connections, and session data.

---

## Why Bridge (Not UI)

### Bridge is Source of Truth
- Bridge owns the actual PTY processes (child_process)
- Bridge controls WebSocket connections to terminals
- Bridge persists session state to disk
- UI is just a client viewing that state

### Terminal Process Lifecycle
```
Bridge creates PTY
  ↓
Bridge spawns child process (Claude CLI)
  ↓
Bridge reads/writes PTY streams
  ↓
Bridge handles process exit
  ↓
UI is notified of state changes via WebSocket
```

If UI owned this, it would need to:
- Spawn child processes from browser (impossible)
- Manage file descriptors from browser (impossible)
- Persist state across page reloads (inefficient)

### Reliability
- Browser refreshes lose connection → Bridge recovers
- Browser crashes → Bridge keeps processes alive
- Multiple browser tabs can view same session → Bridge is authority
- Network disconnect → Bridge maintains session, UI reconnects

### Security
- Bridge validates all operations
- Bridge enforces permissions
- Bridge logs all actions
- UI cannot bypass bridge (no direct terminal access)

---

## Architecture

```
┌─────────────────────────────────────────┐
│          Browser UI (Port 3001)          │
│  ┌──────────────────────────────────┐   │
│  │  React Components                 │   │
│  │  - TerminalPanel (renders xterm) │   │
│  │  - ApprovalQueue                 │   │
│  │  - SessionList                   │   │
│  └──────────────────────────────────┘   │
│           ↓ WebSocket ↑                  │
│  ┌──────────────────────────────────┐   │
│  │  Store (session state)            │   │
│  │  - terminals[]                    │   │
│  │  - approvals[]                    │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
              ↕ HTTP/WS
┌─────────────────────────────────────────┐
│       Bridge Server (Port 3002)          │
│  ┌──────────────────────────────────┐   │
│  │  Session Manager                  │   │
│  │  - sessions: Map<id, PTYProcess> │   │
│  │  - Spawns Claude CLI processes   │   │
│  │  - Manages WebSocket per session │   │
│  └──────────────────────────────────┘   │
│           ↓ Pipe ↓                       │
│  ┌──────────────────────────────────┐   │
│  │  PTY Processes                    │   │
│  │  - Claude CLI running             │   │
│  │  - Reading from stdin             │   │
│  │  - Writing to stdout              │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Data Flow

**Session Creation:**
```
UI: POST /api/sessions { agentId: "test" }
  ↓
Bridge: Create new PTY
Bridge: Spawn Claude CLI in PTY
Bridge: Emit 'session:created' to UI
  ↓
UI: Receive event, add terminal to state
UI: Render xterm.js terminal
UI: Connect WebSocket to bridge
```

**Terminal I/O:**
```
User types in terminal
  ↓
xterm.js sends keystrokes via WebSocket
  ↓
Bridge receives via WebSocket handler
Bridge: Write keystroke to PTY stdin
Bridge: Read response from PTY stdout
Bridge: Send back via WebSocket
  ↓
xterm.js renders output
```

**Session Persistence:**
```
Bridge: Save session state to ~/.operator-state/sessions/
Bridge: Save PTY output buffer to ~/.operator-state/sessions/[id].jsonl
  ↓
On reload:
Bridge: Restore sessions from disk
Bridge: Reattach to existing PTY processes
  ↓
UI: Connect WebSocket to bridge
UI: Load session data from /api/sessions
UI: Resume terminal where it left off
```

---

## Tradeoffs

| Aspect | Bridge-Managed | UI-Managed |
|--------|---|---|
| **Process Management** | ✅ Possible | ❌ Impossible (browsers can't spawn processes) |
| **Reliability** | ✅ Survives browser crash | ❌ Processes die on browser close |
| **Performance** | ✅ Bridge handles I/O | ⚠️ Browser overhead |
| **Scalability** | ✅ Multiple clients view same session | ❌ Per-client state duplication |
| **Code Complexity** | ⚠️ Client-server sync needed | ✅ Simpler code |
| **Security** | ✅ Server validates operations | ⚠️ Client can bypass checks |

---

## Consequences

### Accepted
- Bridge is more complex (manages processes, state, WebSocket)
- UI/Bridge must stay in sync (generation/epoch system prevents races)
- State persistence requires file system writes
- Multiple clients create challenges (concurrent access)

### Benefits
- Processes survive browser disconnect
- Can have multiple browser tabs view same session
- Terminal sessions are "first-class" (persist independently)
- Bridge can enforce policies (rate limiting, permissions)

---

## Related Decisions

- [[ADR-002: xterm.js for Rendering]] — UI layer for displaying terminals
- [[ADR-004: WebSocket Generation System]] — Prevents race conditions during reconnect
- [[ADR-005: Session Persistence]] — How sessions survive restarts

---

## References

- Implementation: `src/bridge/terminal.ts`
- UI Interface: `src/components/TerminalPanel.tsx`
- API: `GET /api/sessions`, `POST /api/sessions`
- State: `~/.operator-state/sessions/`
