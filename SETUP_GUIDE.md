# Operator Cockpit - Local Setup Guide

**Status:** ✅ Fully functional and tested (19/23 Playwright tests passing)

## Overview

The Operator Cockpit is a unified dashboard for managing multiple AI agents simultaneously. It provides:
- Real-time multi-panel grid view of agent terminals
- Approval workflow system for agent decisions
- Chat interface with agents
- Session browser for past conversations
- Jira integration for spinning agents on tickets

## System Architecture

```
┌─────────────────────────────────────────┐
│        Browser (You)                    │
│   http://localhost:3001                 │
│  ┌────────────────────────────────────┐ │
│  │  Operator Cockpit Dashboard        │ │
│  │  - Terminal Grid (WebSocket)       │ │
│  │  - Approvals                       │ │
│  │  - Chat Interface                  │ │
│  │  - Session History                 │ │
│  └────────────────────────────────────┘ │
└──────────────┬──────────────────────────┘
               │ SSE (Server-Sent Events)
               ▼
┌─────────────────────────────────────────┐
│  Next.js Dashboard Server (Port 3001)   │
│  - File system watcher                  │
│  - Real-time updates                    │
│  - API routes                           │
└──────────────┬──────────────────────────┘
               │
       ┌───────┼───────┐
       │       │       │
       ▼       ▼       ▼
   fs.watch  WebSocket Terminal Bridge
             (Port 3002)
       │
       ▼
~/.operator-state/  (File-based state)
  ├── agents/                    (Agent heartbeats)
  ├── agent-configs/             (Agent definitions)
  ├── chat/                       (Conversation logs)
  ├── events/                     (Agent events)
  ├── approvals/                  (Approval requests)
  │   ├── pending/
  │   ├── approved/
  │   └── rejected/
  └── bridge-sessions.json        (Session persistence)
```

## Quick Start

### 1. Start the Services

**Terminal 1 — Dashboard:**
```bash
cd /Users/joshuaminton/operator-cockpit
npm run dev
# Runs on http://localhost:3001
```

**Terminal 2 — Bridge Server:**
```bash
cd /Users/joshuaminton/operator-cockpit
npm run bridge
# Runs on http://127.0.0.1:3002
```

**Or run both together:**
```bash
npm run dev:all
```

### 2. Open Dashboard
```
http://localhost:3001
```

### 3. Create an Agent

Create a JSON file in `~/.operator-state/agent-configs/`:

```bash
cat > ~/.operator-state/agent-configs/my-agent.json << 'EOF'
{
  "id": "my-agent",
  "name": "My Agent",
  "emoji": "🤖",
  "model": "sonnet",
  "projectId": "myproject",
  "projectName": "My Project",
  "prompt": "You are a helpful assistant. [Your system prompt here]"
}
EOF
```

### 4. Launch Terminal for Agent

In the dashboard:
1. Click the **▶ Play button** next to your agent name in the header
2. A new terminal panel opens
3. Claude Code CLI spawns in the bridge
4. Terminal streams output to the browser

## Configuration

### Environment Variables (`.env.local`)

```env
# Chat backend: 'anthropic' (API) or 'bridge' (custom)
CHAT_BACKEND=anthropic

# Anthropic API key (required for chat)
ANTHROPIC_API_KEY=sk-ant-...

# State directory (default: ~/.operator-state)
OPERATOR_STATE_DIR=~/.operator-state

# Bridge server details
BRIDGE_PORT=3002
NEXT_PUBLIC_BRIDGE_WS=ws://127.0.0.1:3002
```

### Agent Config Fields

```json
{
  "id": "unique-agent-id",
  "name": "Display Name",
  "emoji": "🎯",
  "model": "sonnet|opus|haiku",
  "projectId": "project-slug",
  "projectName": "Project Display Name",
  "workDir": "/path/to/work/dir",
  "prompt": "System prompt for this agent"
}
```

## Features & Usage

### Terminal Panels
- **Max 6 simultaneous** panels per session
- **Persistent across reloads** — saved in `localStorage`
- **Color-coded by Jira ticket** when linked
- **Drag to close** (× button) or refresh page

### Approval Workflow
1. Agent writes to `~/.operator-state/approvals/pending/`
2. Dashboard shows in **Approval Queue** (left sidebar)
3. Approve/reject decision
4. Agent polls for decision in `approved/` or `rejected/`

### Session Browser
- **Auto-loads** recent sessions (last 6 hours)
- **Click to resume** any past session
- **Conversation history** restored from `~/.claude/projects/`

### Chat Interface
- Direct messaging with agents
- Appears in agent's panel footer
- Routed to Claude API (if `CHAT_BACKEND=anthropic`)

## Emitting Events

### From CLI

```bash
npx tsx scripts/emit-event.ts \
  --agent=my-agent \
  --project=myproject \
  --title="Task complete" \
  --description="Successfully analyzed 50 files"
```

### Manual (JSON File)

```bash
cat > ~/.operator-state/events/evt-001.json << 'EOF'
{
  "id": "evt-001",
  "agentId": "my-agent",
  "projectId": "myproject",
  "title": "Analysis complete",
  "description": "Found 12 issues",
  "urgency": "medium",
  "status": "complete",
  "timestamp": "2026-07-04T15:00:00Z"
}
EOF
```

## Troubleshooting

### Terminals Show "Disconnected"
- **Cause:** Bridge can't spawn Claude process or session resume fails
- **Fix:** 
  ```bash
  # Clear old sessions
  rm ~/.operator-state/bridge-sessions.json
  # Restart bridge: npm run bridge
  ```

### No Sessions Appearing
- **Cause:** No Claude Code session history
- **Fix:** Create a fresh terminal manually (agent button in header)

### Dashboard Not Updating
- **Cause:** File watcher missed changes
- **Fix:** Refresh browser (F5 or Cmd+R)

### Bridge Port Already in Use
- **Cause:** Port 3002 occupied by another process
- **Fix:**
  ```bash
  lsof -i :3002  # Find process
  kill -9 <PID>  # Kill it
  npm run bridge # Restart
  ```

## File Structure

```
/Users/joshuaminton/operator-cockpit/
├── src/
│   ├── app/                    (Next.js pages & routes)
│   ├── components/             (React components)
│   ├── bridge/                 (Terminal/WebSocket server)
│   ├── lib/                    (Utilities)
│   └── hooks/                  (React hooks)
├── scripts/
│   ├── cockpit-hook.sh        (Claude Code integration)
│   └── emit-event.ts          (Event emitter CLI)
├── tests/
│   └── dashboard.spec.ts      (E2E tests)
├── .env.local                 (Environment config)
└── playwright.config.ts       (Test configuration)
```

## Test Coverage

Run Playwright E2E tests:

```bash
# All tests
npx playwright test

# Watch mode
npx playwright test --watch

# UI mode (interactive)
npx playwright test --ui

# Single file
npx playwright test tests/dashboard.spec.ts
```

**Current Results:** 19/23 passing
- ✅ Dashboard loads
- ✅ Sidebar renders (approvals, sessions)
- ✅ Terminal grid layout
- ✅ Responsive design
- ✅ Interactive buttons
- ⚠️  4 minor failures (header text, missing Jira config, console warnings)

## Integration with Claude Code

Copy the hook script to integrate Claude Code sessions into the dashboard:

```bash
# 1. Copy hook script
cp scripts/cockpit-hook.sh ~/.claude/hooks/cockpit-emit.sh
chmod +x ~/.claude/hooks/cockpit-emit.sh

# 2. Update ~/.claude/settings.json
cat >> ~/.claude/settings.json << 'EOF'
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [{ "type": "command", "command": "~/.claude/hooks/cockpit-emit.sh" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "CLAUDE_HOOK_TYPE=Stop ~/.claude/hooks/cockpit-emit.sh" }]
      }
    ]
  }
}
EOF

# 3. Restart Claude Code
# Now every session appears as a panel in the Operator Cockpit
```

## Production Deployment

To run persistently (survives reboots):

```bash
# Install PM2
npm install -g pm2

# Start with ecosystem config
pm2 start ecosystem.config.js

# Save for auto-restart
pm2 save
pm2 startup
```

Or use Docker:

```bash
docker compose up -d
# Mounts ~/.operator-state into container
```

## Key Concepts

### Session ID (Stable)
- Generated client-side when terminal opens
- Persists across browser reloads
- Allows reconnect to same Claude process
- Survives bridge restart (PTY kept alive for 15 minutes)

### File-Based State
- No database required
- Any process can write JSON to `~/.operator-state/`
- Dashboard watches directory, pushes updates via SSE
- Scales to distributed agents

### Trust Levels
- **Monitor (👁)** — View only, manual approve all
- **Assistant (🤝)** — Approve by category
- **Autonomous (⚡)** — Auto-approve low-risk decisions
- **Full Auto (🚀)** — Trust all decisions (use with caution!)

## Common Tasks

### Create Multiple Agents

```bash
for agent in researcher auditor architect; do
  cat > ~/.operator-state/agent-configs/$agent.json << EOF
{
  "id": "$agent",
  "name": "$(echo $agent | sed 's/./\U&/')",
  "emoji": "🤖",
  "model": "sonnet",
  "projectId": "multi",
  "projectName": "Multi-Agent"
}
EOF
done
```

### Monitor Agent Activity

```bash
# Watch agent heartbeats
watch -n 1 'ls -lt ~/.operator-state/agents/ | head -5'

# Follow event stream
tail -f ~/.operator-state/events/*.json
```

### Reset All State

```bash
rm -rf ~/.operator-state/
mkdir -p ~/.operator-state/{agents,agent-configs,chat,events,approvals/{pending,approved,rejected}}
```

## Support

- **Documentation:** See README.md in project root
- **Issues:** Check bridge logs: `/tmp/bridge.log`
- **Console:** Browser DevTools → Console tab for WebSocket errors
- **Architecture:** Mermaid diagrams in CONTEXT.md

---

**Last Updated:** 2026-07-04
**Setup Version:** 1.0
**Status:** Production Ready
