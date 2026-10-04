#!/usr/bin/env bash
# Claude Code → Operator Cockpit Pre-Tool-Use Hook
# Intercepts tool execution and routes through approval queue when running in cockpit
#
# Installation:
#   cp scripts/pre-tool-use-hook.sh ~/.claude/hooks/pre-tool-use.sh
#   chmod +x ~/.claude/hooks/pre-tool-use.sh
#
# Then add to ~/.claude/settings.json:
#   "hooks": {
#     "preToolUse": "~/.claude/hooks/pre-tool-use.sh"
#   }
#
# This hook reads stdin (tool definition from Claude Code) and decides whether to
# allow the tool or request approval from the cockpit.
#
# Exit codes:
#   0 = tool approved/allowed
#   1 = tool rejected
#   2 = needs revision
#   3 = approval timeout
#
# When NOT in cockpit (COCKPIT_APPROVAL_BRIDGE not set), tool is allowed by default
# (backward compatible with normal Claude Code usage).

set -euo pipefail

# If not running in cockpit, allow tool to proceed
if [[ -z "${COCKPIT_APPROVAL_BRIDGE:-}" ]]; then
  # Normal Claude Code mode (no cockpit) — tools run without approval gate
  exit 0
fi

# We're in cockpit mode — intercept tool execution
STATE_DIR="${OPERATOR_STATE_DIR:-$HOME/.operator-state}"

# Read tool definition from stdin (JSON)
TOOL_DEF=$(cat 2>/dev/null || echo '{}')

# Extract tool name and description
TOOL_NAME=$(printf '%s' "$TOOL_DEF" | sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
TOOL_INPUT=$(printf '%s' "$TOOL_DEF" | sed -n 's/.*"input"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)

# Determine risk level based on tool type (case-insensitive)
RISK="low"
ACTION="Run tool: $TOOL_NAME"
TOOL_LOWER=$(printf '%s' "$TOOL_NAME" | tr '[:upper:]' '[:lower:]')

if [[ "$TOOL_LOWER" == *"bash"* ]] || [[ "$TOOL_LOWER" == *"exec"* ]] || [[ "$TOOL_LOWER" == *"shell"* ]]; then
  RISK="high"
  ACTION="Execute shell command: ${TOOL_INPUT:-$TOOL_NAME}"
elif [[ "$TOOL_LOWER" == *"write"* ]] || [[ "$TOOL_LOWER" == *"edit"* ]] || [[ "$TOOL_LOWER" == *"delete"* ]]; then
  RISK="medium"
  ACTION="Modify file: $TOOL_NAME"
elif [[ "$TOOL_LOWER" == *"git"* ]] || [[ "$TOOL_LOWER" == *"push"* ]] || [[ "$TOOL_LOWER" == *"deploy"* ]]; then
  RISK="high"
  ACTION="Git/deploy operation: $TOOL_NAME"
elif [[ "$TOOL_LOWER" == *"read"* ]] || [[ "$TOOL_LOWER" == *"list"* ]]; then
  RISK="low"
  # Allow read-only tools without approval
  exit 0
fi

# For very low-risk operations, skip approval entirely
if [[ "$RISK" == "low" ]]; then
  exit 0
fi

# Session and project identifiers
SESSION_ID="${CLAUDE_SESSION_ID:-claude-$(echo "$PWD" | (md5sum 2>/dev/null || md5 2>/dev/null) | cut -c1-8)}"
PROJECT_ID=$(git rev-parse --abbrev-ref HEAD 2>/dev/null \
  | tr '/' '-' | tr '[:upper:]' '[:lower:]' \
  || basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

# Generate approval ID
APPROVAL_ID="appr-$(date -u +%Y%m%dT%H%M%S)-$(openssl rand -hex 3 2>/dev/null || echo "000000")"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Sanitize for JSON
ACTION=$(printf '%s' "$ACTION" | tr -cd '[:print:]' | sed 's/\\/\\\\/g; s/"/\\"/g' | cut -c1-300)

# Create approval request
mkdir -p "$STATE_DIR/approvals/pending"

cat > "$STATE_DIR/approvals/pending/$APPROVAL_ID.json" <<EOF
{
  "id": "$APPROVAL_ID",
  "agentId": "cc-$SESSION_ID",
  "projectId": "$PROJECT_ID",
  "status": "pending",
  "action": "$ACTION",
  "rationale": "Tool requires approval before execution",
  "riskLevel": "$RISK",
  "affectedSystems": ["Tool execution"],
  "expectedOutcome": "Tool executes as requested",
  "toolName": "$TOOL_NAME",
  "approveButton": "Allow",
  "rejectButton": "Block",
  "requestChangesButton": "Revise",
  "createdAt": "$NOW"
}
EOF

echo "⏳ Approval requested: $ACTION (risk: $RISK)" >&2
echo "   ID: $APPROVAL_ID" >&2
echo "   Waiting for cockpit decision..." >&2

# Poll for decision (timeout: 10 minutes)
TIMEOUT=600
ELAPSED=0
POLL=2

while [[ $ELAPSED -lt $TIMEOUT ]]; do
  if [[ -f "$STATE_DIR/approvals/approved/$APPROVAL_ID.json" ]]; then
    echo "✅ Tool approved — executing." >&2
    exit 0
  fi

  if [[ -f "$STATE_DIR/approvals/rejected/$APPROVAL_ID.json" ]]; then
    NOTES=$(sed -n 's/.*"decisionNotes"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
      "$STATE_DIR/approvals/rejected/$APPROVAL_ID.json" | head -1)
    echo "❌ Tool blocked by operator." >&2
    [[ -n "$NOTES" ]] && echo "   Notes: $NOTES" >&2
    rm -f "$STATE_DIR/approvals/pending/$APPROVAL_ID.json"
    exit 1
  fi

  if [[ -f "$STATE_DIR/approvals/needs-revision/$APPROVAL_ID.json" ]]; then
    NOTES=$(sed -n 's/.*"decisionNotes"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
      "$STATE_DIR/approvals/needs-revision/$APPROVAL_ID.json" | head -1)
    echo "🔄 Operator requested changes — stopping." >&2
    [[ -n "$NOTES" ]] && echo "   Notes: $NOTES" >&2
    rm -f "$STATE_DIR/approvals/pending/$APPROVAL_ID.json"
    exit 2
  fi

  sleep "$POLL"
  ELAPSED=$((ELAPSED + POLL))
done

# Timeout
echo "⏱  Approval timeout (${TIMEOUT}s) — tool not allowed to execute." >&2
rm -f "$STATE_DIR/approvals/pending/$APPROVAL_ID.json"
exit 3
