#!/bin/bash
# Operator Cockpit - Pre-Deployment Checklist
#
# Run this script before deploying to production.
# All checks must pass (exit code 0).
#
# Usage: ./scripts/deployment-checklist.sh
# Exit Code: 0 = all pass, 1 = any failure

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0

echo "=========================================="
echo "PRE-DEPLOYMENT CHECKLIST"
echo "=========================================="
echo ""

# Helper functions
check_pass() {
  local name=$1
  echo -e "${GREEN}✓${NC} $name"
  ((PASS_COUNT++))
}

check_fail() {
  local name=$1
  local reason=$2
  echo -e "${RED}✗${NC} $name"
  if [ -n "$reason" ]; then
    echo "   Reason: $reason"
  fi
  ((FAIL_COUNT++))
}

check_warn() {
  local name=$1
  echo -e "${YELLOW}⚠${NC} $name (manual check required)"
}

# ============================================
# GATE 1: BUILD
# ============================================
echo "GATE 1: BUILD"
echo "============"

if npm run build > /dev/null 2>&1; then
  check_pass "Build succeeds"
else
  check_fail "Build fails" "Run: npm run build"
fi

# ============================================
# GATE 2: SERVERS
# ============================================
echo ""
echo "GATE 2: SERVERS"
echo "==============="

if curl -s http://localhost:3001/health | jq -e '.ok' > /dev/null 2>&1; then
  check_pass "Dev server responding (port 3001)"
else
  check_warn "Dev server not responding (optional - may not be running)"
fi

if curl -s http://localhost:3002/health | jq -e '.ok' > /dev/null 2>&1; then
  check_pass "Bridge server responding (port 3002)"
else
  check_warn "Bridge server not responding (optional - may not be running)"
fi

# ============================================
# GATE 3: TESTS
# ============================================
echo ""
echo "GATE 3: TESTS"
echo "============="

# Count test files
TEST_COUNT=$(find e2e -name "*.spec.ts" 2>/dev/null | wc -l)
if [ "$TEST_COUNT" -gt 0 ]; then
  check_pass "E2E tests exist ($TEST_COUNT files)"
else
  check_fail "No E2E tests found" "Add tests to e2e/ directory"
fi

UNIT_TEST_COUNT=$(find . -name "*.test.ts" -o -name "*.spec.ts" 2>/dev/null | wc -l)
if [ "$UNIT_TEST_COUNT" -gt 0 ]; then
  check_pass "Unit tests exist ($UNIT_TEST_COUNT files)"
else
  check_warn "No unit tests found"
fi

# ============================================
# GATE 4: DOCUMENTATION
# ============================================
echo ""
echo "GATE 4: DOCUMENTATION"
echo "====================="

API_DOC_COUNT=$(find docs/api -name "*.md" 2>/dev/null | wc -l)
if [ "$API_DOC_COUNT" -gt 0 ]; then
  check_pass "API documentation exists ($API_DOC_COUNT files)"
else
  check_fail "No API documentation" "Create docs/api/*.md files"
fi

ADR_COUNT=$(find docs/adr -name "*.md" 2>/dev/null | wc -l)
if [ "$ADR_COUNT" -gt 0 ]; then
  check_pass "Architecture decisions documented ($ADR_COUNT ADRs)"
else
  check_warn "No architecture decision records (recommended)"
fi

if [ -f README.md ]; then
  check_pass "README exists"
else
  check_warn "No README.md found"
fi

# ============================================
# GATE 5: SECURITY
# ============================================
echo ""
echo "GATE 5: SECURITY"
echo "================"

if [ -f .env ]; then
  check_warn ".env exists (should not be committed)"
fi

if grep -q ".env" .gitignore 2>/dev/null; then
  check_pass ".env in .gitignore"
else
  check_fail ".env not in gitignore" "Add .env to .gitignore"
fi

# Check for obvious hardcoded secrets
if grep -r "password.*=\|secret.*=\|token.*=" src --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "://" | grep -v "apiKey" | wc -l | grep -q "^0$"; then
  check_pass "No obvious hardcoded secrets"
else
  check_warn "Possible hardcoded secrets found (review manually)"
fi

# ============================================
# GATE 6: GIT
# ============================================
echo ""
echo "GATE 6: GIT"
echo "==========="

if [ -z "$(git status --porcelain)" ]; then
  check_pass "Git working tree clean"
else
  check_fail "Uncommitted changes" "Commit: git add -A && git commit"
fi

COMMIT_COUNT=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l || echo "0")
if [ "$COMMIT_COUNT" -gt 0 ]; then
  check_pass "Commits ready to push ($COMMIT_COUNT commits)"
else
  check_warn "No commits ahead of main"
fi

# ============================================
# GATE 7: DEPENDENCIES
# ============================================
echo ""
echo "GATE 7: DEPENDENCIES"
echo "===================="

if npm outdated 2>/dev/null | grep -q "Package"; then
  check_warn "Outdated packages exist (review with npm outdated)"
else
  check_pass "Dependencies up to date"
fi

# ============================================
# SUMMARY
# ============================================
echo ""
echo "=========================================="
echo "SUMMARY"
echo "=========================================="
TOTAL=$((PASS_COUNT + FAIL_COUNT))
if [ "$TOTAL" -gt 0 ]; then
  PERCENT=$((PASS_COUNT * 100 / TOTAL))
  echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
  echo -e "${RED}Failed: $FAIL_COUNT${NC}"
  echo "Score: $PERCENT% ($PASS_COUNT/$TOTAL)"
fi
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✓ ALL CHECKS PASSED - READY FOR DEPLOYMENT${NC}"
  exit 0
else
  echo -e "${RED}✗ SOME CHECKS FAILED - DO NOT DEPLOY${NC}"
  echo ""
  echo "Fix the failures above, then re-run this script."
  exit 1
fi
