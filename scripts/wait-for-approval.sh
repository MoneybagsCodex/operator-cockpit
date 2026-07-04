#!/usr/bin/env bash
# wait-for-approval.sh — write an approval request and block until the operator decides
#
# Usage:
#   wait-for-approval.sh \
#     --action   "Deploy routing trigger update" \
#     --rationale "Adds T2 escalation rule — needed for new queue" \
#     --risk     "medium" \
#     --systems  "CI pipeline, Production DB" \
#     --outcome  "New trigger active, T2 queue receives escalated tickets"
#
# Exit codes:
#   0 = approved   → proceed
#   1 = rejected   → stop
#   2 = needs-revision → stop, read notes
#   3 = timeout    → stop (operator did not respond within --timeout seconds)
#   4 = usage error
#
# Install:
#   cp scripts/wait-for-approval.sh ~/.claude/hooks/wait-for-approval.sh
#   chmod +x ~/.claude/hooks/wait-for-approval.sh

set -euo pipefail

STATE_DIR="${OPERATOR_STATE_DIR:-$HOME/.operator-state}"
PENDING_DIR="$STATE_DIR/approvals/pending"
APPROVED_DIR="$STATE_DIR/approvals/approved"
REJECTED_DIR="$STATE_DIR/approvals/rejected"
REVISION_DIR="$STATE_DIR/approvals/needs-revision"

# ── Argument parsing ─────────────────────────────────────────────────────────

ACTION=""
RATIONALE=""
RISK="medium"
SYSTEMS=""
OUTCOME=""
TIMEOUT="${APPROVAL_TIMEOUT:-600}"   # default 10 min; override via env or --timeout
POLL=2

while [[ $# -gt 0 ]]; do
  case "$1" in
    --action)    ACTION="$2";    shift 2 ;;
    --rationale) RATIONALE="$2"; shift 2 ;;
    --risk)      RISK="$2";      shift 2 ;;
    --systems)   SYSTEMS="$2";   shift 2 ;;
    --outcome)   OUTCOME="$2";   shift 2 ;;
    --timeout)   TIMEOUT="$2";   shift 2 ;;
    *) echo "ERROR: unknown argument: $1" >&2; exit 4 ;;
  esac
done

if [[ -z "$ACTION" ]]; then
  echo "ERROR: --action is required" >&2
  echo "Usage: wait-for-approval.sh --action \"...\" --rationale \"...\" --risk low|medium|high|critical" >&2
  exit 4
fi

# ── ID + metadata ─────────────────────────────────────────────────────────────

SESSION_ID="${CLAUDE_SESSION_ID:-claude-$(echo "$PWD" | (md5sum 2>/dev/null || md5 2>/dev/null) | cut -c1-8)}"
PROJECT_ID=$(git rev-parse --abbrev-ref HEAD 2>/dev/null \
  | tr '/' '-' | tr '[:upper:]' '[:lower:]' \
  || basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
APPROVAL_ID="appr-$(date -u +%Y%m%dT%H%M%S)-$(openssl rand -hex 3 2>/dev/null || echo "000000")"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# ── Sanitize (strip JSON-breaking characters) ─────────────────────────────────

sanitize() { printf '%s' "$1" | tr -cd '[:print:]' | sed 's/\\/\\\\/g; s/"/\\"/g' | cut -c1-300; }
ACTION=$(sanitize "$ACTION")
RATIONALE=$(sanitize "$RATIONALE")
SYSTEMS=$(sanitize "$SYSTEMS")
OUTCOME=$(sanitize "$OUTCOME")
RISK=$(printf '%s' "$RISK" | tr -cd '[:alnum:]-')

# Build JSON array for affectedSystems (comma-separated input → ["a","b"])
if [[ -z "$SYSTEMS" ]]; then
  SYSTEMS_JSON="[]"
else
  SYSTEMS_JSON='["'"$(printf '%s' "$SYSTEMS" | sed 's/,[[:space:]]*/","/g')"'"]'
fi

# ── Write approval request ────────────────────────────────────────────────────

mkdir -p "$PENDING_DIR" "$APPROVED_DIR" "$REJECTED_DIR" "$REVISION_DIR"

cat > "$PENDING_DIR/$APPROVAL_ID.json" <<EOF
{
  "id": "$APPROVAL_ID",
  "agentId": "cc-$SESSION_ID",
  "projectId": "$PROJECT_ID",
  "status": "pending",
  "action": "$ACTION",
  "rationale": "$RATIONALE",
  "riskLevel": "$RISK",
  "affectedSystems": $SYSTEMS_JSON,
  "expectedOutcome": "$OUTCOME",
  "approveButton": "Approve",
  "rejectButton": "Reject",
  "requestChangesButton": "Needs Revision",
  "createdAt": "$NOW"
}
EOF

# ── Echo into chat thread (non-fatal) ─────────────────────────────────────────

{
  CHAT_DIR="$STATE_DIR/chat/$PROJECT_ID"
  mkdir -p "$CHAT_DIR"
  TODAY=$(date -u +%Y-%m-%d)
  printf '%s\n' "{\"id\":\"chat-$APPROVAL_ID\",\"projectId\":\"$PROJECT_ID\",\"sender\":\"system\",\"message\":\"Approval requested\",\"timestamp\":\"$NOW\",\"type\":\"approval-request\",\"approvalId\":\"$APPROVAL_ID\",\"approvalAction\":\"$ACTION\",\"approvalRationale\":\"$RATIONALE\",\"approvalRiskLevel\":\"$RISK\",\"approvalSystems\":$SYSTEMS_JSON,\"approvalOutcome\":\"$OUTCOME\"}" \
    >> "$CHAT_DIR/$TODAY.jsonl"
} || true

echo "" >&2
echo "⏳ Approval requested" >&2
echo "   Action:  $ACTION" >&2
echo "   Risk:    $RISK" >&2
echo "   ID:      $APPROVAL_ID" >&2
echo "   Waiting up to ${TIMEOUT}s — approve in the Operator Cockpit dashboard." >&2
echo "" >&2

# ── Poll for decision ─────────────────────────────────────────────────────────

ELAPSED=0
while [[ $ELAPSED -lt $TIMEOUT ]]; do
  if [[ -f "$APPROVED_DIR/$APPROVAL_ID.json" ]]; then
    echo "✅ Approved — proceeding." >&2
    exit 0
  fi

  if [[ -f "$REJECTED_DIR/$APPROVAL_ID.json" ]]; then
    NOTES=$(sed -n 's/.*"decisionNotes"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
      "$REJECTED_DIR/$APPROVAL_ID.json" | head -1)
    echo "❌ Rejected — stopping." >&2
    [[ -n "$NOTES" ]] && echo "   Notes: $NOTES" >&2
    rm -f "$PENDING_DIR/$APPROVAL_ID.json"
    exit 1
  fi

  if [[ -f "$REVISION_DIR/$APPROVAL_ID.json" ]]; then
    NOTES=$(sed -n 's/.*"decisionNotes"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
      "$REVISION_DIR/$APPROVAL_ID.json" | head -1)
    echo "🔄 Needs revision — stopping." >&2
    [[ -n "$NOTES" ]] && echo "   Notes: $NOTES" >&2
    rm -f "$PENDING_DIR/$APPROVAL_ID.json"
    exit 2
  fi

  sleep "$POLL"
  ELAPSED=$((ELAPSED + POLL))
done

# ── Timeout ───────────────────────────────────────────────────────────────────

echo "⏱  Timed out after ${TIMEOUT}s — no decision received." >&2
rm -f "$PENDING_DIR/$APPROVAL_ID.json"
exit 3
