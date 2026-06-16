#!/usr/bin/env bash
# Claude Code → Operator Cockpit hook
# Writes session heartbeats and events to ~/.operator-state/ so the cockpit
# can display all active Claude Code sessions as agent panels.
#
# Setup:
#   cp scripts/cockpit-hook.sh ~/.claude/hooks/cockpit-emit.sh
#   chmod +x ~/.claude/hooks/cockpit-emit.sh
# Then add to ~/.claude/settings.json hooks (see docs/agent-integration.md)

set -euo pipefail

STATE_DIR="${OPERATOR_STATE_DIR:-$HOME/.operator-state}"
AGENTS_DIR="$STATE_DIR/agents"
EVENTS_DIR="$STATE_DIR/events"

SESSION_ID="${CLAUDE_SESSION_ID:-claude-$(echo "$PWD" | md5 | cut -c1-8)}"
PROJECT_ID=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '/' '-' | tr '[:upper:]' '[:lower:]' || basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
PROJECT_NAME=$(basename "$PWD")
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

mkdir -p "$AGENTS_DIR" "$EVENTS_DIR" "$STATE_DIR/projects"

HOOK_TYPE="${CLAUDE_HOOK_TYPE:-PostToolUse}"

# Always update heartbeat
cat > "$AGENTS_DIR/cc-$SESSION_ID.json" <<EOF
{
  "id": "cc-$SESSION_ID",
  "name": "Claude Code",
  "type": "claude-code",
  "status": "$([ "$HOOK_TYPE" = "Stop" ] && echo "idle" || echo "working")",
  "lastHeartbeat": "$NOW",
  "projectId": "$PROJECT_ID",
  "confidenceLevel": null
}
EOF

# Write project metadata once
if [ ! -f "$STATE_DIR/projects/$PROJECT_ID.json" ]; then
  cat > "$STATE_DIR/projects/$PROJECT_ID.json" <<EOF
{
  "id": "$PROJECT_ID",
  "name": "$PROJECT_NAME",
  "priority": 5,
  "status": "active",
  "assignedAgent": "cc-$SESSION_ID",
  "latestUpdate": "$NOW",
  "blockers": [],
  "pendingApprovalsCount": 0
}
EOF
fi

# On PostToolUse: emit a lightweight event
if [ "$HOOK_TYPE" = "PostToolUse" ]; then
  EVENT=$(cat 2>/dev/null || echo '{}')
  TOOL_NAME=$(echo "$EVENT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_name','tool'))" 2>/dev/null || echo "tool")
  EVENT_ID="cc-$(date -u +%Y%m%dT%H%M%S)-$(openssl rand -hex 3 2>/dev/null || echo 000000)"
  cat > "$EVENTS_DIR/$EVENT_ID.json" <<EOF
{
  "id": "$EVENT_ID",
  "agentId": "cc-$SESSION_ID",
  "projectId": "$PROJECT_ID",
  "title": "$TOOL_NAME",
  "description": "Tool used in $PROJECT_NAME",
  "urgency": "low",
  "status": "complete",
  "timestamp": "$NOW",
  "source": "claude-code"
}
EOF
fi

exit 0
