# Operator Cockpit — Development Rules

## Testing Requirement

**All new features must be tested and refined to success via Playwright before marking as complete.**

This means:
- Write tests for new functionality (e.g., auto-approve toggle, session metrics display, color-coding)
- Run tests locally before committing
- Test the golden path AND edge cases
- Verify no regressions in existing features
- Tests live in `e2e/` directory (Playwright config in `playwright.config.ts`)

Run tests:
```bash
npm run test:e2e
```

## Priority Order

1. **Fix auto-approve feature** (currently in_progress) — approval queue must work end-to-end
2. Color-code terminal tabs by project
3. Add wiki health indicator + sync-check integration
4. Fix system prompt not applying to newly spawned agents
5. Add working directory dropdown to agent creation form
6. Dockerize cockpit for cloud deployment

## Bridge vs Dev Server

- **Bridge** (port 3002) — manages terminal sessions, spawns Claude processes
- **Dev** (port 3000) — serves web UI, handles API routes
- Both must run for cockpit to function: `npm run bridge &` then `npm run dev`

## Code Standards

- Patch-only edits (use Edit tool)
- No full rewrites or silent changes
- Keep changes focused and reviewable
