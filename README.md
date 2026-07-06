# Operator Cockpit

Real-time multi-agent monitoring and management dashboard for Claude AI operations. Spin up agents, monitor live terminal sessions, manage approvals, and coordinate complex workflows—all from a unified web interface.

## Features

- **Live Terminal Sessions** — Embedded pseudo-terminals (PTY) for Claude Code processes with real-time I/O
- **Multi-Agent Coordination** — Spin agents, track sessions, manage dozens of concurrent workflows
- **Approval Queue** — Centralized approval system with auto-approve toggles and decision tracking
- **Session Metrics** — Uptime, token usage estimates, error detection, process IDs
- **Color-Coded Tabs** — Visual distinction between agents via hash-based color assignment
- **Session Persistence** — Resume interrupted conversations and reattach to running processes
- **Fork Sessions** — Spin parallel agents on the same session to work in tandem from different angles
- **Knowledge Base Integration** — Sync with DASHBOARD priorities and MEMORY notes
- **Trust & Safety** — Pre-trust mode, permission controls, disconnect/reconnect resilience

## Architecture

```
Bridge Server (port 3002)
  └─ Node PTY + WebSocket relay
     └─ Claude Code processes (STDIN/STDOUT)

Dev Server (port 3001)
  └─ Next.js UI + API routes
     └─ Connects to Bridge via WebSocket
```

## Getting Started

### Prerequisites

- Node.js 18+
- macOS/Linux (PTY support)
- Claude Code CLI: `npm install -g @anthropic-ai/claude-code`

### Installation

```bash
git clone https://github.com/yourusername/operator-cockpit.git
cd operator-cockpit
npm install
```

### Running Locally

**Terminal 1:**
```bash
npm run bridge
```

**Terminal 2:**
```bash
npm run dev
```

Open http://localhost:3001

## Usage

### Spin an Agent
Click **+ New Agent** → select mode → Launch

### Approve Requests
Approval Queue tile in sidebar → Approve/Reject/Auto-approve

### Monitor Sessions
Each terminal panel shows uptime, tokens, errors, PID

### Resume a Session
Past Sessions browser → click to reconnect

## Project Structure

```
src/
├── app/
│   ├── api/              # Approval, sessions, dashboard endpoints
│   ├── page.tsx          # Main dashboard
│   └── layout.tsx        # Root layout
├── bridge/               # Bridge server (separate process)
│   ├── server.ts         # Express + WebSocket
│   └── terminal.ts       # PTY management
├── components/           # React components
├── hooks/                # useLiveState, custom hooks
└── styles/               # Tailwind + theme
```

## Configuration

Create `.env.local`:
```env
NEXT_PUBLIC_BRIDGE_WS=ws://127.0.0.1:3002
```

API keys sourced from `~/.env` (user-level, never committed).

## Testing

```bash
npm run test:e2e          # Playwright tests
npm run test:e2e:ui       # Interactive UI
```

## Development

- Patch-only edits (Edit tool, no full rewrites)
- Test end-to-end in browser before committing
- See CLAUDE.md for full development rules

## Known Issues

- Terminal state lost on bridge restart (persistent store coming)
- Auto-approval doesn't yet bridge to running agents
- PTY size sync may lag on large resizes

## Future Roadmap

- [ ] Persistent session store (SQLite)
- [ ] Multi-bridge coordination
- [ ] Approval bridge to agents
- [ ] System prompt templates
- [ ] Working directory picker
- [ ] Enhanced fork mode (shared context display, diff view)
- [ ] Docker support
- [ ] Cloud deployment (Vercel/AWS/GCP)

## Contributing

Issues and PRs welcome. Test end-to-end, update docs, keep commits focused.

## License

MIT

---

Built with ❤️ by Josh Minton
