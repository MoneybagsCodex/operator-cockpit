# Operator Cockpit — Quick Reference Card

## Start Services

```bash
# Option A: Run both (recommended)
npm run dev:all

# Option B: Run separately
# Terminal 1:
npm run dev                    # Dashboard on :3001

# Terminal 2:
npm run bridge                 # Bridge on :3002
```

## Dashboard URL
```
http://localhost:3001
```

## Create Agent

```bash
cat > ~/.operator-state/agent-configs/AGENT_ID.json << 'EOF'
{
  "id": "AGENT_ID",
  "name": "Agent Name",
  "emoji": "🎯",
  "model": "sonnet",
  "projectId": "project",
  "projectName": "Project Name",
  "prompt": "System prompt here"
}
EOF
```

## Emit Event

```bash
npx tsx scripts/emit-event.ts \
  --agent=AGENT_ID \
  --project=project \
  --title="Event title"
```

## State Directory

```
~/.operator-state/
├── agents/              # Agent heartbeats
├── agent-configs/       # Agent definitions
├── chat/                # Conversation logs
├── events/              # Events from agents
├── approvals/
│   ├── pending/         # Waiting for approval
│   ├── approved/        # Agent polls here
│   └── rejected/        # Agent polls here
└── bridge-sessions.json # Session persistence
```

## Common Paths

| Path | Purpose |
|------|---------|
| `~/.operator-state/` | All cockpit state |
| `/tmp/bridge.log` | Bridge server logs |
| `src/bridge/terminal.ts` | Terminal WebSocket logic |
| `tests/dashboard.spec.ts` | Playwright E2E tests |

## Tests

```bash
npx playwright test                    # Run all
npx playwright test --watch            # Watch mode
npx playwright test --ui               # UI mode (interactive)
npx playwright test tests/dashboard.spec.ts --headed  # See browser
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Terminals won't connect | `rm ~/.operator-state/bridge-sessions.json && npm run bridge` |
| Port 3002 in use | `lsof -i :3002 && kill -9 <PID>` |
| Sessions not loading | Create fresh agent via button in header |
| Dashboard not updating | Refresh browser (F5) |
| Claude not found | Install: `npm install -g @anthropic-ai/cli` |

## Terminal Management

| Action | How |
|--------|-----|
| Open terminal | Click ▶ button next to agent in header |
| Close terminal | Click × button on panel |
| Rename terminal | Click edit icon (pencil) on panel |
| View past session | Click session in "Past Sessions" sidebar |

## Approval Flow

1. Agent writes JSON to `~/.operator-state/approvals/pending/`
2. Dashboard shows in **Approval Queue** (left sidebar)
3. Click **Approve** or **Request Changes**
4. Agent polls `approved/` or `rejected/` for decision

## Integration Checklist

- [ ] Dashboard running on :3001
- [ ] Bridge running on :3002
- [ ] Created first agent config
- [ ] Launched terminal for agent
- [ ] Viewed Approval Queue
- [ ] Browsed Past Sessions
- [ ] Ran Playwright tests (19/23 passing)

---

See `SETUP_GUIDE.md` for detailed documentation.
