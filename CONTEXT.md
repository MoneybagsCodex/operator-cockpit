# Operator Cockpit — Architecture & Dev Notes

## What This Is
A local dashboard for running and monitoring multiple Claude Code agents at once. Next.js 14 (App Router) on **port 3001**, plus a small bridge server on **port 3002** that spawns/attaches live `claude` terminals over WebSockets.

## Stack / Run
- `npm run dev:all` — starts dashboard (3001) + bridge (3002) via `concurrently` + `tsx`
- `npm run dev` — dashboard only
- `npm run bridge` — bridge only
- `ecosystem.config.js` — PM2 config (dashboard + bridge apps) for persistent running

## ⚠️ Regression Testing — run after any feature change
Small changes here have a habit of silently breaking earlier features. After ANY change, smoke-test:
1. **App loads** — `GET /` is 200 and the browser console has **0 errors** (a bad import → white screen; e.g. a lucide icon that doesn't exist in the installed version).
2. **Color schemes** — after selecting a non-default scheme, `getComputedStyle(document.documentElement).getPropertyValue('--scheme-bg')` equals that scheme's token (live switch AND after reload).
3. **Terminals** — recent sessions auto-open as live terminals (capped at `MAX_SESSIONS`).
4. **Refresh persistence** — open terminals persist to `localStorage['cockpit-terminals']` and restore on reload; with the bridge still running, each reattaches to its live PTY (badge stays **live**, not stuck on `reconnecting…`).
5. **Approvals** — a gated command surfaces a card in the sidebar; approving lets the terminal advance.
6. **Jira tile** (optional) — renders tickets or a clear "token expired" message.

## Known regression traps (don't repeat these)
- **lucide-react icons**: only import icons that exist in the installed version. A missing export is `undefined` → "Element type is invalid" white screen.
- **Default scheme CSS**: default tokens live in a **standalone `:root` block placed FIRST** in `globals.css`. Never merge `:root` into a `[data-scheme="x"]` rule — `:root` always matches `<html>` at equal specificity, so a merged/mid-file `:root` overrides every earlier scheme and breaks switching.
- **Bridge env / "Session not found" on resume**: the spawned `claude --resume` locates conversations via `~/.claude/projects`, resolved from `HOME`. If the bridge is launched from a shell that sets a POSIX `HOME` (e.g. Git Bash: `/c/Users/…`), the Windows `claude` can't resolve it → every resume fails with "Session not found". Fix (in `ptyEnv`, `src/bridge/terminal.ts`): force `env.HOME = env.USERPROFILE = os.homedir()` for every spawned PTY.
- **Reconnect storm / xterm crash**: client reconnect must NOT reset the backoff counter on every `onopen` (a connection that opens-then-drops will hot-loop, hammering the bridge). Reset the counter only after the link stays open (~4s). NEVER call `term.reset()`/`fit()` mid-reconnect — it throws `Cannot read properties of undefined (reading 'dimensions')` inside xterm. After the retry cap, STALL (stop retrying, keep the panel); only self-prune on a genuine session end.
- **Hook stdout**: `PreToolUse` approval hooks must emit the decision with **synchronous `fs.writeSync(1, …)`** then `process.exit(0)`. An async `stdout.write(…, cb)` truncates on exit → the decision is lost → "approved but stuck".
- **Bridge restart**: `src/bridge/*.ts` changes need a full `dev:all` restart (tsx has no hot-reload); React/CSS changes hot-reload. Restarting the bridge wipes its in-memory PTY map — terminals then come back only via `claude --resume` from disk (slower), not instant reattach.

## State Architecture
All state lives at `~/.operator-state/` (override with `OPERATOR_STATE_DIR`):
```
agents/<session-id>.json          # heartbeat files
projects/<session-id>.json        # project registration
approvals/pending|approved|rejected|needs-revision/<id>.json
chat/<projectId>/<YYYY-MM-DD>.jsonl
agent-configs/<id>.json           # registered agent configs
```
State is polled via SSE at `/api/stream`. `src/lib/state.ts` has the read/write functions.

## Key Files
- `src/app/page.tsx` — main dashboard layout; terminal panels; localStorage persistence + auto-open
- `src/components/TerminalPanel.tsx` — xterm.js + WebSocket client; reconnect/stall logic; boot overlay
- `src/components/AgentStatusBar.tsx` — top bar: brand, project launchers, "New Agent", trust-all
- `src/components/ApprovalQueue.tsx` — sidebar approval cards + auto-approve toggle
- `src/components/SprintTickets.tsx` — optional Jira tile
- `src/bridge/terminal.ts` — WebSocket terminal server; spawns/attaches `claude` PTYs; `ptyEnv`
- `src/bridge/server.ts` — bridge HTTP server (chat relay + `/health`)

## Optional Jira integration
Set in `.env.local` (all optional — the tile just shows an error if unset):
```
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_TOKEN=<api-token>
JIRA_PROJECT=PROJ
```
