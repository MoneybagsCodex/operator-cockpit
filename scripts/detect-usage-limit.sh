#!/usr/bin/env bash
# detect-usage-limit.sh — Claude Code StopFailure hook (matcher: rate_limit)
#
# Phase 1 of the usage-limit resilience feature: DETECT AND NOTIFY ONLY.
# This script never launches anything, never calls any API, never touches
# the network. It reads the hook's JSON payload from stdin, decides whether
# this looks like a genuine subscription/usage-limit stop (as opposed to a
# transient rate_limit that Claude Code's own retry/backoff already mostly
# filters out before StopFailure ever fires), and if so writes ONE small
# local JSON file into the cockpit's state tree. The dashboard picks it up
# and shows a notification. That's the entire scope of Phase 1.
#
# Install:
#   cp scripts/detect-usage-limit.sh ~/.claude/hooks/detect-usage-limit.sh
#   chmod +x ~/.claude/hooks/detect-usage-limit.sh
# Then register it under StopFailure / matcher "rate_limit" in
# ~/.claude/settings.json (see docs/adr/003-usage-limit-recovery-detection.md).
#
# Exit code is always 0 — a hook script must never block or fail the turn
# it's reacting to; StopFailure has already stopped things by the time this
# runs.

set -uo pipefail

STATE_DIR="${OPERATOR_STATE_DIR:-$HOME/.operator-state}"
PENDING_DIR="$STATE_DIR/recovery/pending"
mkdir -p "$PENDING_DIR"

PAYLOAD=$(cat 2>/dev/null || echo '{}')

extract() {
  # Pull one top-level string field out of the JSON payload without a
  # dependency on jq. Deliberately tolerant: transcript/error field names
  # and shapes are the part of this payload most likely to drift.
  printf '%s' "$PAYLOAD" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" | head -1
}

SESSION_ID=$(extract session_id)
CWD=$(extract cwd)
TRANSCRIPT_PATH=$(extract transcript_path)
LAST_ASSISTANT_MESSAGE=$(extract last_assistant_message)
ERROR_TEXT=$(extract error)

# A real subscription/usage-limit stop, not a transient blip Claude Code's
# own retry logic already absorbed. This phrase list is the actual
# hard/soft distinction (the StopFailure matcher alone only says
# "rate_limit", which does not by itself guarantee this won't clear in
# seconds) — see the architecture evaluation for why.
COMBINED="$LAST_ASSISTANT_MESSAGE $ERROR_TEXT"
if ! printf '%s' "$COMBINED" | grep -qiE \
  "session limit|weekly limit|opus limit|sonnet limit|credit balance is too low|usage limit"; then
  exit 0
fi

if [[ -z "$SESSION_ID" ]]; then
  # No session id, nothing to key deduplication on — fail safe, do nothing.
  exit 0
fi

# One request per Claude session id — a flapping/looping StopFailure for the
# same session must not spam the dashboard with duplicate notifications.
OUT_FILE="$PENDING_DIR/$SESSION_ID.json"
if [[ -f "$OUT_FILE" ]]; then
  exit 0
fi

REASON=$(printf '%s' "$COMBINED" | grep -oiE \
  "session limit|weekly limit|opus limit|sonnet limit|credit balance is too low|usage limit" | head -1)

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\n'
}

cat > "$OUT_FILE" <<EOF
{
  "id": "$(json_escape "$SESSION_ID")",
  "sessionId": "$(json_escape "$SESSION_ID")",
  "cwd": "$(json_escape "$CWD")",
  "reason": "$(json_escape "$REASON")",
  "lastAssistantMessage": "$(json_escape "$LAST_ASSISTANT_MESSAGE")",
  "transcriptPath": "$(json_escape "$TRANSCRIPT_PATH")",
  "detectedAt": "$NOW"
}
EOF

exit 0
