#!/bin/bash

# GMASAP API - Complete Authentication Flow Test
# Tests all auth endpoints end-to-end

set -e

# Configuration
API_BASE=${1:-"http://localhost:3000"}
TEST_EMAIL="test-$(date +%s)@gmasap.com"
TEST_PASSWORD="securepassword123"

echo "🧪 Testing GMASAP Auth Flow - $API_BASE"
echo "📧 Test User: $TEST_EMAIL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test result tracking
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function for test assertions
assert_response() {
    local description="$1"
    local expected_status="$2"
    local response_file="$3"
    
    local actual_status=$(jq -r '.statusCode // empty' "$response_file" 2>/dev/null || echo "")
    local response_body=$(cat "$response_file" 2>/dev/null || echo "")
    
    if [[ "$actual_status" == "$expected_status" ]]; then
        echo -e "${GREEN}✅ PASS${NC}: $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: $description"
        echo -e "   Expected status: $expected_status, Got: $actual_status"
        echo -e "   Response: $response_body"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Test 1: User Registration
echo -e "${BLUE}Test 1: User Registration${NC}"
curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"firstName\": \"Test\",
    \"lastName\": \"User\",
    \"role\": \"athlete\"
  }" > register_response.json

assert_response "User registration" "201" "register_response.json"

# Extract tokens from registration
ACCESS_TOKEN=$(jq -r '.data.accessToken // empty' register_response.json)
REFRESH_TOKEN=$(jq -r '.data.refreshToken // empty' register_response.json)
USER_ID=$(jq -r '.data.user.userId // empty' register_response.json)

if [[ -n "$ACCESS_TOKEN" && -n "$REFRESH_TOKEN" ]]; then
    echo -e "${GREEN}✅ PASS${NC}: Tokens generated successfully"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC}: Tokens not generated"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo "Response: $(cat register_response.json)"
fi

echo ""

# Test 2: User Login
echo -e "${BLUE}Test 2: User Login${NC}"
curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }" > login_response.json

assert_response "User login" "200" "login_response.json"

# Update tokens from login
NEW_ACCESS_TOKEN=$(jq -r '.data.accessToken // empty' login_response.json)
if [[ -n "$NEW_ACCESS_TOKEN" ]]; then
    ACCESS_TOKEN="$NEW_ACCESS_TOKEN"
    echo -e "${GREEN}✅ PASS${NC}: Login tokens updated"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC}: Login tokens not generated"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# Test 3: Get Profile (Protected Route)
echo -e "${BLUE}Test 3: Get Profile (Protected)${NC}"
curl -s -X GET "$API_BASE/auth/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN" > profile_response.json

assert_response "Get profile with valid token" "200" "profile_response.json"

# Test 3b: Get Profile Without Token (Should Fail)
echo -e "${BLUE}Test 3b: Get Profile Without Token${NC}"
curl -s -X GET "$API_BASE/auth/profile" > profile_no_token_response.json

assert_response "Get profile without token" "401" "profile_no_token_response.json"

echo ""

# Test 4: Update Profile
echo -e "${BLUE}Test 4: Update Profile${NC}"
curl -s -X PATCH "$API_BASE/auth/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Updated",
    "lastName": "TestUser",
    "bio": "This is my updated bio for testing purposes.",
    "location": "Chapel Hill, NC"
  }' > update_profile_response.json

assert_response "Update profile" "200" "update_profile_response.json"

# Verify the update worked
curl -s -X GET "$API_BASE/auth/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN" > updated_profile_response.json

UPDATED_FIRST_NAME=$(jq -r '.data.user.firstName // empty' updated_profile_response.json)
if [[ "$UPDATED_FIRST_NAME" == "Updated" ]]; then
    echo -e "${GREEN}✅ PASS${NC}: Profile update verified"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC}: Profile update not reflected"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo "Expected firstName: 'Updated', Got: '$UPDATED_FIRST_NAME'"
fi

echo ""

# Test 5: Token Refresh
echo -e "${BLUE}Test 5: Token Refresh${NC}"
curl -s -X POST "$API_BASE/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }" > refresh_response.json

assert_response "Token refresh" "200" "refresh_response.json"

echo ""

# Test 6: Invalid Login Attempt
echo -e "${BLUE}Test 6: Invalid Login Attempt${NC}"
curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"wrongpassword\"
  }" > invalid_login_response.json

assert_response "Invalid login attempt" "401" "invalid_login_response.json"

echo ""

# Test 7: Duplicate Registration
echo -e "${BLUE}Test 7: Duplicate Registration${NC}"
curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"firstName\": \"Duplicate\",
    \"lastName\": \"User\",
    \"role\": \"athlete\"
  }" > duplicate_register_response.json

assert_response "Duplicate registration" "409" "duplicate_register_response.json"

echo ""

# Test 8: Logout
echo -e "${BLUE}Test 8: Logout${NC}"
curl -s -X POST "$API_BASE/auth/logout" \
  -H "Authorization: Bearer $ACCESS_TOKEN" > logout_response.json

assert_response "User logout" "200" "logout_response.json"

echo ""

# Summary
echo -e "${YELLOW}=== Test Summary ===${NC}"
echo -e "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "\n${GREEN}🎉 All tests passed! Auth system is working correctly.${NC}"
    echo ""
    echo -e "${BLUE}Ready for Sprint 1.3: Social Feed Implementation${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please review the issues above.${NC}"
    exit 1
fi

# Cleanup
rm -f *.json 2>/dev/null || true