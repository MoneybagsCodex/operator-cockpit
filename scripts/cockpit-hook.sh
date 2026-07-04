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

SESSION_ID="${CLAUDE_SESSION_ID:-claude-$(echo "$PWD" | (md5sum 2>/dev/null || md5 2>/dev/null) | cut -c1-8)}"
PROJECT_ID=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '/' '-' | tr '[:upper:]' '[:lower:]' || basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
PROJECT_NAME=$(basename "$PWD")
# Sanitize user-controlled values to prevent heredoc injection
PROJECT_NAME=$(printf '%s' "$PROJECT_NAME" | tr -cd '[:alnum:] _.-' | cut -c1-64)
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
  # Extract tool_name with sed — no python3 dependency
  TOOL_NAME=$(printf '%s' "$EVENT" | sed -n 's/.*"tool_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
  TOOL_NAME="${TOOL_NAME:-tool}"
  # Sanitize to prevent heredoc injection (strip shell metacharacters, cap length)
  TOOL_NAME=$(printf '%s' "$TOOL_NAME" | tr -cd '[:alnum:] _.-' | cut -c1-64)
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
