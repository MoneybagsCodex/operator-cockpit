# AI Operator Cockpit

A real-time monitoring dashboard for running multiple AI agents simultaneously. Replaces the context-switching problem of multiple terminal tabs or chat windows with a unified overhead view.

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## What it does

- **Multi-panel grid** — one panel per agent/project, all visible simultaneously (2×2 or 3×3)
- **Real-time updates** via Server-Sent Events — no polling, no refresh
- **Chat interface** — send messages to agents directly from the cockpit
- **Approval queue** — agents can request decisions; operator approves/rejects with context
- **File-based state** — no database required; agents write JSON to `~/.operator-state/`

## Architecture

```
Browser (you)
  ↕ SSE + HTTP
Next.js cockpit (port 3000)
  ↕ fs.watch
~/.operator-state/          ← shared state directory
  agents/                   ← agent heartbeats
  projects/                 ← project metadata
  chat/{project}/           ← JSONL conversation logs
  events/                   ← agent events
  approvals/pending/        ← approval requests
  agent-configs/            ← agent definitions
  ↑ write from anywhere
Claude Code hooks / custom bridge / any agent
```

State lives in files. Any process that can write a JSON file can emit events. The cockpit watches the directory and pushes changes to the browser via SSE.

## Quick start

```bash
git clone https://github.com/MoneybagsCodex/operator-cockpit
cd operator-cockpit
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm run dev
```

Open `http://localhost:3000`.

## Configuration

Copy `.env.example` to `.env.local` and fill in:

```env
# Required for direct Anthropic chat backend
ANTHROPIC_API_KEY=sk-ant-...

# Chat backend: 'bridge' (default, for custom agent bridge) or 'anthropic' (direct API)
CHAT_BACKEND=anthropic

# Path to shared state directory (default: ~/.operator-state)
OPERATOR_STATE_DIR=~/.operator-state

# Bridge URL if using CHAT_BACKEND=bridge
COCKPIT_BRIDGE_URL=http://127.0.0.1:3001/send
```

## Chat backends

The cockpit ships with two swappable chat backends:

| `CHAT_BACKEND` | Routes to | Use when |
|---|---|---|
| `bridge` (default) | Custom bridge process on port 3001 | Running your own agent process (OpenClaw, LiteLLM, etc.) |
| `anthropic` | Anthropic API directly | Claude Code at work, no bridge needed |

## Adding agents

Create a JSON file in `~/.operator-state/agent-configs/`:

```json
{
  "id": "researcher",
  "name": "Researcher",
  "emoji": "🔬",
  "model": "sonnet",
  "projectId": "research",
  "projectName": "🔬 Research",
  "prompt": "You are a research assistant focused on..."
}
```

Or use the **+ New Agent** button in the cockpit header.

## Claude Code integration (monitor sessions in the cockpit)

Copy the hook script and register it so every Claude Code session appears as a panel:

```bash
cp scripts/cockpit-hook.sh ~/.claude/hooks/cockpit-emit.sh
chmod +x ~/.claude/hooks/cockpit-emit.sh
```

Add to `~/.claude/settings.json`:

```json
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
```

Each Claude Code session will appear as an agent panel, grouped by git branch/project.

## Emitting events from any agent

Write a JSON file to `~/.operator-state/events/`:

```json
{
  "id": "evt-001",
  "agentId": "researcher",
  "projectId": "research",
  "title": "Literature review complete",
  "description": "Found 12 relevant papers",
  "urgency": "low",
  "status": "complete",
  "timestamp": "2026-06-16T10:00:00Z"
}
```

Or use the CLI helper:

```bash
npx tsx scripts/emit-event.ts --agent=researcher --project=research --title="Task done"
```

## Approval flow

Agents request human decisions by writing to `~/.operator-state/approvals/pending/`. The cockpit shows pending approvals with context. When you approve or reject, the cockpit moves the file to the appropriate subdirectory — agents poll for the decision.

## Running persistently (PM2)

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # survive reboots
```

## Docker

```bash
docker compose up -d
```

Mounts `~/.operator-state` into the container so state is shared with the host.

## License

MIT
