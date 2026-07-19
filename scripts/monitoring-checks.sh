#!/bin/bash
# Operator Cockpit - Post-Deployment Monitoring
#
# Run this during the first hour after deployment to verify stability.
# Checks for common issues that might indicate a broken deployment.
#
# Usage: ./scripts/monitoring-checks.sh
# Or: watch ./scripts/monitoring-checks.sh (repeat every 2 seconds)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "POST-DEPLOYMENT MONITORING"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# ============================================
# CHECK 1: SERVICE HEALTH
# ============================================
echo "CHECK 1: SERVICE HEALTH"
echo "======================="

DEV_HEALTH=$(curl -s http://localhost:3001/health 2>/dev/null | jq -r '.ok' 2>/dev/null)
if [ "$DEV_HEALTH" = "true" ]; then
  echo -e "${GREEN}✓${NC} Dev server healthy"
else
  echo -e "${RED}✗${NC} Dev server unhealthy or down"
fi

BRIDGE_HEALTH=$(curl -s http://localhost:3002/health 2>/dev/null | jq -r '.ok' 2>/dev/null)
if [ "$BRIDGE_HEALTH" = "true" ]; then
  echo -e "${GREEN}✓${NC} Bridge server healthy"
else
  echo -e "${RED}✗${NC} Bridge server unhealthy or down"
fi

# ============================================
# CHECK 2: RESPONSE TIMES
# ============================================
echo ""
echo "CHECK 2: API RESPONSE TIMES"
echo "============================"

# Measure /api/approvals response time
API_TIME=$(curl -s -w '%{time_total}' -o /dev/null http://localhost:3001/api/approvals 2>/dev/null)
if [ -n "$API_TIME" ]; then
  API_TIME_MS=$(echo "$API_TIME * 1000" | bc | cut -d. -f1)
  if [ "$API_TIME_MS" -lt 1000 ]; then
    echo -e "${GREEN}✓${NC} API response time: ${API_TIME_MS}ms"
  elif [ "$API_TIME_MS" -lt 2000 ]; then
    echo -e "${YELLOW}⚠${NC} API response time slow: ${API_TIME_MS}ms (should be <1000ms)"
  else
    echo -e "${RED}✗${NC} API response time too slow: ${API_TIME_MS}ms"
  fi
else
  echo -e "${RED}✗${NC} Could not measure API response time"
fi

# ============================================
# CHECK 3: ERROR RATE
# ============================================
echo ""
echo "CHECK 3: ERROR RATE (last 100 log lines)"
echo "========================================="

ERROR_COUNT=$(tail -100 /tmp/bridge.log 2>/dev/null | grep -i "error\|ERROR" | wc -l)
if [ "$ERROR_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✓${NC} No errors in logs"
elif [ "$ERROR_COUNT" -lt 5 ]; then
  echo -e "${YELLOW}⚠${NC} $ERROR_COUNT errors (acceptable)"
else
  echo -e "${RED}✗${NC} $ERROR_COUNT errors found - ALERT"
  echo "   First error:"
  tail -100 /tmp/bridge.log 2>/dev/null | grep -i "error\|ERROR" | head -1
fi

# ============================================
# CHECK 4: STATE CONSISTENCY
# ============================================
echo ""
echo "CHECK 4: STATE CONSISTENCY"
echo "=========================="

# Compare UI approval queue count with API count
UI_QUEUE=$(curl -s http://localhost:3001 2>/dev/null | grep -o "APPROVAL QUEUE ([0-9]*)" | grep -o "[0-9]*")
API_QUEUE=$(curl -s http://localhost:3001/api/approvals 2>/dev/null | jq '[.[] | select(.status == "pending")] | length')

if [ -n "$UI_QUEUE" ] && [ -n "$API_QUEUE" ]; then
  if [ "$UI_QUEUE" = "$API_QUEUE" ]; then
    echo -e "${GREEN}✓${NC} UI and API approval counts match ($UI_QUEUE)"
  else
    echo -e "${RED}✗${NC} MISMATCH: UI shows $UI_QUEUE, API has $API_QUEUE (state out of sync!)"
  fi
else
  echo -e "${YELLOW}⚠${NC} Could not compare UI and API state"
fi

# ============================================
# CHECK 5: PROCESS STATUS
# ============================================
echo ""
echo "CHECK 5: PROCESS STATUS"
echo "======================="

BRIDGE_PROC=$(pgrep -f "npm run bridge" | wc -l)
if [ "$BRIDGE_PROC" -gt 0 ]; then
  echo -e "${GREEN}✓${NC} Bridge process running"
else
  echo -e "${RED}✗${NC} Bridge process not running"
fi

DEV_PROC=$(pgrep -f "npm run dev" | wc -l)
if [ "$DEV_PROC" -gt 0 ]; then
  echo -e "${GREEN}✓${NC} Dev server process running"
else
  echo -e "${RED}✗${NC} Dev server process not running"
fi

CLAUDE_PROC=$(pgrep -f "claude --resume" | wc -l)
if [ "$CLAUDE_PROC" -gt 0 ]; then
  echo -e "${GREEN}✓${NC} $CLAUDE_PROC Claude session(s) running"
else
  echo -e "${YELLOW}⚠${NC} No Claude sessions active (may be normal)"
fi

# ============================================
# CHECK 6: DISK SPACE
# ============================================
echo ""
echo "CHECK 6: DISK SPACE"
echo "==================="

DISK_USAGE=$(df ~/.operator-state 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//')
if [ -n "$DISK_USAGE" ]; then
  if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✓${NC} Disk usage: ${DISK_USAGE}%"
  elif [ "$DISK_USAGE" -lt 90 ]; then
    echo -e "${YELLOW}⚠${NC} Disk usage high: ${DISK_USAGE}%"
  else
    echo -e "${RED}✗${NC} Disk usage critical: ${DISK_USAGE}%"
  fi
else
  echo -e "${YELLOW}⚠${NC} Could not check disk usage"
fi

# ============================================
# ALERT SUMMARY
# ============================================
echo ""
echo "=========================================="
echo "ALERT RULES"
echo "=========================================="
echo "🔴 CRITICAL ALERTS (ACTION REQUIRED):"
echo "  - Service health = DOWN"
echo "  - API response time > 2s"
echo "  - Error rate > 10 in 100 logs"
echo "  - State mismatch (UI ≠ API)"
echo "  - Process not running"
echo ""
echo "🟡 WARNINGS (MONITOR CLOSELY):"
echo "  - API response time 1-2s"
echo "  - Error rate 5-10 in 100 logs"
echo "  - Disk usage 80-90%"
echo ""
echo "🟢 OK:"
echo "  - All services responding"
echo "  - Response times < 1s"
echo "  - No errors"
echo "  - State consistent"
echo "  - All processes running"
echo ""
echo "=========================================="
