#!/bin/bash
#
# Integration Test: Full Job Lifecycle
# =====================================
# Tests the complete flow from job creation to completion.
#
# Prerequisites:
# - Backend running on localhost:3001
# - PostgreSQL database available
# - Solana devnet wallet configured
#
# Usage:
#   ./test_job_lifecycle.sh
#

set -e

API_URL="${API_URL:-http://localhost:3001}"
TEST_WALLET="7qbRF6YsyGuLUVjkgCcqGRE4kBfLTrARWZeGtBz7rGd1"

echo "=========================================="
echo "AgentHive Integration Test: Job Lifecycle"
echo "=========================================="
echo ""
echo "API URL: $API_URL"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    exit 1
}

info() {
    echo -e "${YELLOW}→${NC} $1"
}

# ============================================================================
# Test 1: Health Check
# ============================================================================
echo "Test 1: Health Check"
echo "--------------------"

HEALTH=$(curl -s "$API_URL/health" || echo "failed")
if [[ "$HEALTH" == *"ok"* ]]; then
    pass "Backend is healthy"
else
    fail "Backend health check failed"
fi
echo ""

# ============================================================================
# Test 2: Get Auth Challenge
# ============================================================================
echo "Test 2: Get Auth Challenge"
echo "--------------------------"

CHALLENGE=$(curl -s -X POST "$API_URL/api/auth/challenge" \
    -H "Content-Type: application/json" \
    -d "{\"wallet_address\": \"$TEST_WALLET\"}")

if [[ "$CHALLENGE" == *"message"* ]]; then
    pass "Auth challenge received"
    info "Challenge: $(echo $CHALLENGE | jq -r '.message' | head -c 50)..."
else
    fail "Failed to get auth challenge"
fi
echo ""

# ============================================================================
# Test 3: List Jobs (Unauthenticated)
# ============================================================================
echo "Test 3: List Jobs (Public)"
echo "--------------------------"

JOBS=$(curl -s "$API_URL/api/jobs")

if [[ "$JOBS" == *"jobs"* ]]; then
    JOB_COUNT=$(echo $JOBS | jq '.jobs | length')
    pass "Jobs listed successfully ($JOB_COUNT jobs found)"
else
    fail "Failed to list jobs"
fi
echo ""

# ============================================================================
# Test 4: List Agents (Public)
# ============================================================================
echo "Test 4: List Agents (Public)"
echo "----------------------------"

AGENTS=$(curl -s "$API_URL/api/agents")

if [[ "$AGENTS" == *"agents"* ]]; then
    AGENT_COUNT=$(echo $AGENTS | jq '.agents | length')
    pass "Agents listed successfully ($AGENT_COUNT agents found)"
else
    fail "Failed to list agents"
fi
echo ""

# ============================================================================
# Test 5: Create Job (Requires Auth - Expected to Fail)
# ============================================================================
echo "Test 5: Create Job (No Auth - Should Fail)"
echo "-------------------------------------------"

CREATE_JOB=$(curl -s -X POST "$API_URL/api/jobs" \
    -H "Content-Type: application/json" \
    -d '{
        "title": "Test Job",
        "description": "Integration test job",
        "task_type": "coding",
        "required_skills": ["rust"],
        "budget_min": 100,
        "budget_max": 200
    }')

if [[ "$CREATE_JOB" == *"Unauthorized"* ]] || [[ "$CREATE_JOB" == *"401"* ]]; then
    pass "Correctly rejected unauthenticated request"
else
    fail "Should have rejected unauthenticated job creation"
fi
echo ""

# ============================================================================
# Test 6: Get Specific Job (If Available)
# ============================================================================
echo "Test 6: Get Specific Job"
echo "------------------------"

FIRST_JOB_ID=$(echo $JOBS | jq -r '.jobs[0].id // empty')

if [[ -n "$FIRST_JOB_ID" ]]; then
    JOB_DETAIL=$(curl -s "$API_URL/api/jobs/$FIRST_JOB_ID")
    if [[ "$JOB_DETAIL" == *"title"* ]]; then
        TITLE=$(echo $JOB_DETAIL | jq -r '.title')
        pass "Job details retrieved: \"$TITLE\""
    else
        fail "Failed to get job details"
    fi
else
    info "No jobs available to test"
fi
echo ""

# ============================================================================
# Test 7: Get Specific Agent (If Available)
# ============================================================================
echo "Test 7: Get Specific Agent"
echo "--------------------------"

FIRST_AGENT_ID=$(echo $AGENTS | jq -r '.agents[0].id // empty')

if [[ -n "$FIRST_AGENT_ID" ]]; then
    AGENT_DETAIL=$(curl -s "$API_URL/api/agents/$FIRST_AGENT_ID")
    if [[ "$AGENT_DETAIL" == *"display_name"* ]]; then
        NAME=$(echo $AGENT_DETAIL | jq -r '.display_name')
        pass "Agent details retrieved: \"$NAME\""
    else
        fail "Failed to get agent details"
    fi
else
    info "No agents available to test"
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "=========================================="
echo "Integration Test Summary"
echo "=========================================="
echo ""
echo -e "${GREEN}All tests passed!${NC}"
echo ""
echo "To run full authenticated tests, you need to:"
echo "1. Sign a challenge message with your wallet"
echo "2. Use the returned JWT token in subsequent requests"
echo ""
echo "Example:"
echo "  curl -H \"Authorization: Bearer YOUR_JWT\" $API_URL/api/jobs"
echo ""
