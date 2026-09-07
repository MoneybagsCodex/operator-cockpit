# Operator Cockpit

**A local control plane for running, watching, and governing multiple long-lived AI coding agents from one browser tab.**

![Multi-Agent Control Plane](https://img.shields.io/badge/-Multi--Agent%20Control%20Plane-1e3a8a?style=flat-square)
![PTY Abstraction Layer](https://img.shields.io/badge/-PTY%20Abstraction%20Layer-0f766e?style=flat-square)
![Human-in-the-Loop Governance](https://img.shields.io/badge/-Human--in--the--Loop%20Governance-92400e?style=flat-square)
![Next.js 14](https://img.shields.io/badge/-Next.js%2014-000000?style=flat-square)
![TypeScript](https://img.shields.io/badge/-TypeScript-3178c6?style=flat-square)
![node--pty](https://img.shields.io/badge/-node--pty-4c1d95?style=flat-square)

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full system design — process lifecycle, multi-CLI adapter internals, and the approval state machine, with source citations.

---

## The Problem

A normal IDE terminal split assumes one thing that stops being true the
moment you're running several autonomous coding agents in parallel: **the
process is only alive while the tab is**. Close the tab, restart the IDE, or
lose the SSH connection, and every long-running agent conversation dies with
it — you lose scrollback, you lose conversation state, and if the agent was
mid-command, you lose the command.

That's fine for a human typing `npm test`. It falls apart for AI agents that:

- Run for minutes to hours unattended, and need to **survive a browser
  refresh** without restarting their reasoning from scratch.
- Occasionally need to **stop and ask a human** before doing something risky
  (a deploy, a `git push`, a delete) — and that human is watching *N* agents
  at once, not one terminal.
- May run on **different CLI runtimes** (Claude Code today, others
  tomorrow), which a plain `tmux` grid has no concept of.

Operator Cockpit exists to make "many autonomous agents, one operator" a
tractable, observable workflow instead of a pile of orphaned terminal
sessions and unanswered `y/n` prompts.

---

## Key Features

- **Multi-CLI engine support** — Claude Code and Hermes today, behind a
  small engine-resolution layer (`engine: 'claude' | 'hermes'`) so adding a
  third CLI is a config branch, not a rewrite. See [ARCHITECTURE.md §3](ARCHITECTURE.md#3-multi-cli-engine-abstraction).
- **Persistent background sessions** — agent processes run in real PTYs
  owned by a dedicated bridge server and **outlive the browser tab**. A
  stable client-generated session id lets a refreshed tab reattach and
  replay scrollback with zero lost context — including a 10-minute grace
  window that survives brief disconnects entirely. See [ARCHITECTURE.md §2](ARCHITECTURE.md#2-process-lifecycle--pty-management).
- **Centralized Approval Queue** — a directory-backed state machine
  (`pending/ → approved|rejected|needs-revision/`) that any process — a
  shell hook, a REST call — can write into, with per-agent or global
  auto-approve and a confirm-gated "trust everything" mode. See [ARCHITECTURE.md §5](ARCHITECTURE.md#5-human-in-the-loop-safety-system).
- **Live token/error/uptime telemetry** — per-session metrics computed from
  the raw PTY output stream (line count, error-pattern detection, estimated
  token usage) and polled into the UI every 2s, with zero external
  monitoring stack.
- **Real-time dashboard sync** — a single SSE stream (`/api/stream`) backed
  by `fs.watch` pushes scoped diffs (not full re-reads) to every connected
  browser the instant a file changes on disk.
- **Session browser** — every past Claude Code conversation on the machine
  (not just cockpit-launched ones) is discoverable and resumable, read
  straight from Claude Code's own transcript store.
- **No database** — the entire control plane is a flat JSON/JSONL directory
  tree under `~/.operator-state/`. Inspectable with `ls` and `cat`,
  diffable, and trivially portable.

---

## Architecture at a Glance

```
┌───────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                               │
│  ┌────────────────┐   ┌────────────────┐   ┌───────────────────────┐  │
│  │  xterm.js       │   │  ApprovalQueue │   │  useLiveState          │  │
│  │  terminal panel │   │  (sidebar)     │   │  (EventSource client)  │  │
│  └───────┬────────┘   └───────┬────────┘   └───────────┬───────────┘  │
└──────────┼─────────────────────┼─────────────────────────┼────────────┘
           │ WebSocket           │ fetch()                 │ SSE
           ▼                     ▼                          ▼
┌──────────────────────┐  ┌─────────────────────────────────────────────┐
│  BRIDGE (:3002)       │  │  NEXT.JS SERVER (:3000/3001)                │
│  session manager      │  │  /api/approvals  /api/auto-approve          │
│  approval poll loop   │  │  /api/sessions   /api/stream (fs.watch→SSE) │
└──────────┬────────────┘  └───────────────────┬─────────────────────────┘
           │ node-pty.spawn                     │ fs read/write
           ▼                                     ▼
┌──────────────────────┐          ┌──────────────────────────────────────┐
│  AGENT CLI ENGINES    │          │  ~/.operator-state/ (flat-file DB)   │
│  claude  │  hermes    │◄────────►│  approvals/  agents/  chat/          │
│  (full PTY, streaming)│  writes  │  agent-configs/  events/             │
└──────────────────────┘  approval └──────────────────────────────────────┘
                            files
```

Full diagram set (Mermaid, with source-code citations): [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Getting Started

### Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 18+ | `node -v` |
| macOS or Linux | `node-pty` requires a POSIX PTY; Windows is partially supported via `cmd.exe` shimming but not the primary target |
| [Claude Code CLI](https://docs.anthropic.com/claude-code) | `npm install -g @anthropic-ai/claude-code` — the default agent engine |
| Hermes CLI *(optional)* | Only needed if you plan to run `engine: "hermes"` agents |

### Install

```bash
git clone https://github.com/MoneybagsCodex/operator-cockpit.git
cd operator-cockpit
npm install
```

### Configure

```bash
cp .env.example .env.local
```

Minimum viable `.env.local` for local-only use:

```env
CHAT_BACKEND=bridge
BRIDGE_PORT=3002
COCKPIT_BRIDGE_URL=http://127.0.0.1:3002/send
```

To use the direct-API chat backend instead of the CLI bridge, set
`CHAT_BACKEND=anthropic` and `ANTHROPIC_API_KEY=sk-ant-...`. See
[`.env.example`](.env.example) for the full list (Jira integration, API
token auth, custom state directory).

### Run

The dashboard and the bridge are **separate processes** — both must be
running for terminals to work.

```bash
# One command, both processes:
npm run dev:all
```

```bash
# — or two terminals —
npm run bridge   # Terminal 1: bridge server on :3002
npm run dev      # Terminal 2: Next.js dashboard on :3001
```

Open **http://localhost:3001**, click **New Agent**, and launch a terminal.

### Persistent / production run

```bash
npm install -g pm2
pm2 start ecosystem.config.js   # runs both processes, auto-restarts on crash
pm2 save && pm2 startup
```

Or via Docker (`docker compose up -d`) — see [`docker-compose.yml`](docker-compose.yml), which mounts `~/.operator-state` into the container so state survives a rebuild.

### Verify

```bash
curl http://127.0.0.1:3002/health          # bridge is up, lists active sessions
npm run test:e2e                           # Playwright end-to-end suite
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend framework** | Next.js 14 (App Router), React 18, TypeScript | Dashboard UI, API routes |
| **Terminal rendering** | [`@xterm/xterm`](https://xtermjs.org/) + `@xterm/addon-fit` | Renders PTY byte streams as a real terminal in the browser |
| **Styling** | Tailwind CSS | UI |
| **Backend / control plane** | Node.js + [`tsx`](https://github.com/privatenumber/tsx) | Bridge server (`src/bridge/server.ts`) — runs as a standalone process, not inside Next.js |
| **PTY layer** | [`node-pty`](https://github.com/microsoft/node-pty) | Spawns agent CLIs in real pseudo-terminals for full interactive fidelity |
| **Realtime — terminal I/O** | `ws` (WebSocket) | Bidirectional keystroke/output streaming, `/terminal` endpoint on the bridge |
| **Realtime — dashboard state** | Server-Sent Events (`EventSource`) | One-way push of state snapshots/diffs from `/api/stream` |
| **State store** | Flat JSON / JSON Lines files | `~/.operator-state/` — no database; directory structure encodes state (see approval queue) |
| **Direct-API fallback** | [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript) | Optional chat backend that bypasses the CLI entirely |
| **Process orchestration** | PM2 (`ecosystem.config.js`), Docker Compose | Production/persistent deployment |
| **Testing** | Playwright | End-to-end browser tests (`e2e/`) |
| **Supported agent backends** | Claude Code CLI, Hermes CLI | Selected per-agent via `engine` config field |

---

## Project Structure

```
src/
├── app/
│   ├── api/              # REST + SSE endpoints over ~/.operator-state
│   └── page.tsx          # Main dashboard layout
├── bridge/
│   ├── server.ts         # Bridge HTTP server — headless chat relay, /health, /metrics
│   └── terminal.ts       # PTY session manager, WebSocket server, approval-bridge poller
├── components/            # TerminalPanel, ApprovalQueue, SessionBrowser, ...
├── hooks/useLiveState.ts # SSE client → React state
├── lib/
│   ├── state.ts           # Flat-file read/write for all control-plane state
│   ├── watcher.ts          # fs.watch → typed change events
│   └── chat-backends/      # Pluggable headless chat: bridge CLI vs. direct Anthropic API
└── types/index.ts          # Shared domain types (Agent, ApprovalRequest, AgentEvent, ...)

scripts/
├── cockpit-hook.sh          # Claude Code hook: emits heartbeats/events into the state dir
└── wait-for-approval.sh     # Blocking approval-gate script for agent workflows

docs/
├── adr/                     # Architecture Decision Records
├── api/                     # REST endpoint reference
└── runbook/                 # Operational incident-response playbook
```

---

## Testing

```bash
npm run test:e2e          # Playwright suite (e2e/)
npx playwright test --ui  # interactive runner
```

`CLAUDE.md` in this repo enforces a project rule: **no feature ships without
a Playwright test exercising the golden path and edge cases.**

---

## Known Limitations

- Session telemetry (tokens/uptime/errors) is in-memory only on the bridge
  and resets on bridge restart — not yet persisted.
- Hermes does not currently expose an equivalent to Claude's
  `--permission-mode`, so auto-approve routing is Claude-Code-first.
- Windows support works via `cmd.exe` shimming but is not the primary
  target platform for `node-pty`.

## Contributing

Issues and PRs welcome. Please read [`ARCHITECTURE.md`](ARCHITECTURE.md) and
the relevant [ADR](docs/adr/) before touching bridge/terminal internals —
several non-obvious fixes (session-id resolution, trust-prompt race
conditions, transcript-persistence env stripping) are documented inline in
`src/bridge/terminal.ts` precisely because they were each reintroduced once
already.

## License

MIT
