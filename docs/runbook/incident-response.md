# Incident Response Runbook

**Purpose:** Quick reference for responding to production incidents.

**Keep this near your monitoring system.**

---

## Quick Assessment (First 2 Minutes)

### Q1: Is the service down?
```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
```

**YES → Go to "SERVICE DOWN" section**  
**NO → Go to "PARTIAL OUTAGE" section**

---

## SERVICE DOWN (Complete Outage)

### Immediate Actions (0-2 min)

1. **Confirm it's down**
   ```bash
   curl -v http://localhost:3001/health
   curl -v http://localhost:3002/health
   ```

2. **Check processes**
   ```bash
   pgrep -f "npm run dev"    # Should show PID
   pgrep -f "npm run bridge" # Should show PID
   ```

3. **If processes running but not responding:**
   - Network is the problem, not process death
   - Go to "Restart Services"

4. **If processes not running:**
   - Processes crashed
   - Go to "Restart Services"

### Restart Services (2-5 min)

```bash
# Kill old processes
pkill -f "npm run dev" 2>/dev/null
pkill -f "npm run bridge" 2>/dev/null
sleep 2

# Start fresh
cd /Users/joshuaminton/operator-cockpit
npm run dev > /tmp/dev-server.log 2>&1 &
npm run bridge > /tmp/bridge.log 2>&1 &
sleep 5

# Verify
curl http://localhost:3001/health
curl http://localhost:3002/health
```

### Verify Recovery (5-10 min)

```bash
# Run monitoring checks
./scripts/monitoring-checks.sh

# Check no new errors
tail -20 /tmp/bridge.log
tail -20 /tmp/dev-server.log
```

**If still down → Go to "Deep Diagnosis"**  
**If recovered → Go to "Root Cause Analysis"**

---

## PARTIAL OUTAGE (Services Up, Features Broken)

### Example Symptoms
- Approvals page won't load
- Auto-approve not working
- Terminal output stopped
- UI shows wrong state

### Triage (1-2 min)

1. **Identify affected feature**
   - Terminal/session issue → Check bridge logs
   - Approval/auto-approve issue → Check API response
   - State sync issue → Check browser localStorage

2. **Check recent logs**
   ```bash
   tail -50 /tmp/bridge.log | grep -i error
   tail -50 /tmp/dev-server.log | grep -i error
   ```

3. **Test API directly**
   ```bash
   curl http://localhost:3001/api/approvals | jq .
   curl http://localhost:3002/health | jq .
   ```

### Quick Fixes (2-10 min)

**Problem: Approval queue shows wrong count**
```bash
# Verify API state
curl http://localhost:3001/api/approvals | jq '[.[] | select(.status == "pending")] | length'

# If API is wrong, check file storage
ls ~/.operator-state/approvals/pending/ | wc -l

# If storage is wrong, rebuild from files
# Contact maintainer
```

**Problem: Auto-approve not working**
```bash
# Check setting
curl http://localhost:3001/api/auto-approve | jq '.global'

# Should be true, if false:
curl -X POST http://localhost:3001/api/auto-approve \
  -H "Content-Type: application/json" \
  -d '{"agentId": "global", "enabled": true}'

# Restart bridge to pick up change
pkill -f "npm run bridge"
sleep 1
npm run bridge > /tmp/bridge.log 2>&1 &
```

**Problem: Terminal shows "RECONNECTING"**
```bash
# This is normal if terminal just connected
# Wait 3-5 seconds, should show "LIVE"

# If stuck in RECONNECTING:
# 1. Check bridge is running
pgrep -f "npm run bridge"

# 2. Check WebSocket connection
curl http://localhost:3002/health | jq '.sessions'

# 3. If stuck, restart bridge
pkill -f "npm run bridge"
npm run bridge > /tmp/bridge.log 2>&1 &
```

---

## DEEP DIAGNOSIS (If Quick Fixes Don't Work)

### Step 1: Identify the Layer

**Which layer is broken?**

```bash
# Test API layer
curl http://localhost:3001/api/approvals | jq .
# If this fails → API layer broken

# Test UI layer
curl http://localhost:3001 | grep -o "Operator Cockpit"
# If this fails → UI not serving

# Test Bridge layer
curl http://localhost:3002/health | jq .ok
# If this fails → Bridge not responding

# Test Process layer
ps aux | grep "npm run"
# If nothing → Processes dead
```

### Step 2: Fix the Layer

**If API layer broken:**
```bash
# Check for obvious errors
tail -100 /tmp/dev-server.log | grep -i error | head -5

# Restart just the dev server
pkill -f "npm run dev"
npm run dev > /tmp/dev-server.log 2>&1 &
```

**If UI layer broken:**
```bash
# Rebuild the frontend
npm run build

# Restart dev server
pkill -f "npm run dev"
npm run dev > /tmp/dev-server.log 2>&1 &
```

**If Bridge layer broken:**
```bash
# Check for obvious errors
tail -100 /tmp/bridge.log | grep -i error | head -5

# Restart bridge
pkill -f "npm run bridge"
npm run bridge > /tmp/bridge.log 2>&1 &
```

**If Processes dead:**
```bash
# Make sure no old processes exist
killall node 2>/dev/null || true
sleep 2

# Start fresh
npm run dev > /tmp/dev-server.log 2>&1 &
npm run bridge > /tmp/bridge.log 2>&1 &
```

---

## ROLLBACK (Last Resort)

If nothing works and production is critical:

```bash
# Get previous version
git describe --tags --abbrev=0
# e.g., v1.2.2

# Rollback to previous version
git reset --hard v1.2.2
git push --force origin main

# Rebuild and restart
npm run build
pkill -f "npm run"
npm run dev > /tmp/dev-server.log 2>&1 &
npm run bridge > /tmp/bridge.log 2>&1 &

# Verify
curl http://localhost:3001/health
```

**⚠️ Only do this if incident is critical and you can't fix it in < 10 minutes.**

---

## ROOT CAUSE ANALYSIS (After Recovery)

### During Incident

**Take notes:**
```
Time incident started: __________
First symptom: __________
Actions taken: __________
Time recovered: __________
```

### After Recovery (Next Day)

1. **Identify root cause**
   - What code changed?
   - What test would have caught this?
   - Why did tests not catch it?

2. **Document it**
   - Write a summary (3 paragraphs max)
   - List what went wrong
   - List what would have prevented it

3. **Add a test**
   - Write test that would have caught it
   - Add to E2E or integration test suite
   - Verify it fails with old code
   - Verify it passes with fix

4. **Post-incident**
   - Update DEVELOPMENT.md if new pattern
   - Slack summary to team
   - Create ticket for improvement

---

## Monitoring Dashboard

To keep an eye on health, use:

```bash
# Run continuously during deployments
watch -n 2 ./scripts/monitoring-checks.sh

# Or one-time check
./scripts/monitoring-checks.sh
```

---

## Common Issues & Fixes

| Issue | Symptom | Fix |
|-------|---------|-----|
| Services down | `curl` returns "Connection refused" | `npm run dev & npm run bridge &` |
| API slow | Response time > 2s | Check CPU/disk, restart |
| State mismatch | UI shows different count than API | Reload browser, check localStorage |
| Terminal stuck | "RECONNECTING" forever | Restart bridge |
| Build broken | `npm run build` fails | Check for syntax errors, fix TypeScript |
| Process zombie | `pgrep` returns PID but no response | `kill -9 <PID>`, restart |

---

## Escalation

**If you can't fix it in 15 minutes:**
1. Document what you tried
2. Rollback to previous version
3. Create urgent ticket with findings
4. Contact on-call maintainer

**Never** leave production broken while trying to fix it. Rollback first, diagnose later.
