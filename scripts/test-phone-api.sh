#!/bin/bash
# =============================================================================
# SG Phone Integration API Test Script
# =============================================================================
# Usage: ./scripts/test-phone-api.sh <API_KEY>
# Example: ./scripts/test-phone-api.sh sgp_abc123...
#
# This script tests all 7 endpoints of the Phone Integration API
# =============================================================================

set -e

# Configuration
BASE_URL="https://wzglfwcftigofbuojeci.supabase.co/functions/v1/phone-integration-api"
API_KEY="${1:-YOUR_API_KEY_HERE}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables to store IDs between tests
CUSTOMER_ID=""
JOB_ID=""
REQUEST_ID=""
MODIFICATION_ID=""

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}=================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=================================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Check if API key was provided
if [ "$API_KEY" = "YOUR_API_KEY_HERE" ]; then
    echo -e "${RED}Error: Please provide your API key as an argument${NC}"
    echo "Usage: ./scripts/test-phone-api.sh <API_KEY>"
    echo "Get your API key from Settings > SG Phone Integration"
    exit 1
fi

print_header "SG Phone Integration API Test Suite"
echo "Base URL: $BASE_URL"
echo "API Key: ${API_KEY:0:12}..."
echo ""

# =============================================================================
# Test 1: Customer Lookup
# =============================================================================
print_header "Test 1: Customer Lookup (POST /lookup-customer)"

RESPONSE=$(curl -s -X POST "$BASE_URL/lookup-customer" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone": "555-123-4567"}')

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"found"'; then
    print_success "Customer lookup completed"
    
    # Extract customer_id if found
    if echo "$RESPONSE" | grep -q '"found":true'; then
        CUSTOMER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        print_info "Found customer: $CUSTOMER_ID"
    else
        print_info "No customer found with this phone number"
    fi
else
    print_error "Customer lookup failed"
fi

# =============================================================================
# Test 2: List Jobs
# =============================================================================
print_header "Test 2: List Jobs (GET /jobs)"

if [ -n "$CUSTOMER_ID" ]; then
    RESPONSE=$(curl -s -X GET "$BASE_URL/jobs?customer_id=$CUSTOMER_ID" \
      -H "Authorization: Bearer $API_KEY")
else
    RESPONSE=$(curl -s -X GET "$BASE_URL/jobs" \
      -H "Authorization: Bearer $API_KEY")
fi

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"jobs"'; then
    print_success "Jobs list retrieved"
    
    # Extract first job_id if available
    JOB_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$JOB_ID" ]; then
        print_info "First job ID: $JOB_ID"
    else
        print_info "No jobs found"
    fi
else
    print_error "Jobs list failed"
fi

# =============================================================================
# Test 3: Get Job ETA
# =============================================================================
print_header "Test 3: Get Job ETA (GET /jobs/:id/eta)"

if [ -n "$JOB_ID" ]; then
    RESPONSE=$(curl -s -X GET "$BASE_URL/jobs/$JOB_ID/eta" \
      -H "Authorization: Bearer $API_KEY")
    
    echo "Response: $RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"job_id"'; then
        print_success "Job ETA retrieved"
        
        if echo "$RESPONSE" | grep -q '"has_eta":true'; then
            ETA=$(echo "$RESPONSE" | grep -o '"estimated_arrival":"[^"]*"' | cut -d'"' -f4)
            print_info "ETA: $ETA"
        else
            print_info "No ETA available for this job"
        fi
    else
        print_error "Job ETA request failed"
    fi
else
    print_info "Skipping - no job ID available"
fi

# =============================================================================
# Test 4: Check Service Area
# =============================================================================
print_header "Test 4: Check Service Area (POST /check-service-area)"

RESPONSE=$(curl -s -X POST "$BASE_URL/check-service-area" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"address": "123 Main St, Austin, TX 78701"}')

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"in_service_area"'; then
    print_success "Service area check completed"
    
    if echo "$RESPONSE" | grep -q '"in_service_area":true'; then
        print_info "Address IS in service area"
    else
        print_info "Address is NOT in service area"
    fi
else
    print_error "Service area check failed"
fi

# =============================================================================
# Test 5: Create Job Request
# =============================================================================
print_header "Test 5: Create Job Request (POST /requests)"

REQUEST_BODY=$(cat <<EOF
{
  "customer_name": "API Test Customer",
  "customer_phone": "555-999-8888",
  "customer_email": "apitest@example.com",
  "description": "Test service request from shell script - $(date)",
  "service_type": "General Repair",
  "urgency": "routine",
  "preferred_date": "2026-01-15",
  "preferred_time": "morning",
  "address": {
    "line1": "456 Test Ave",
    "city": "Austin",
    "state": "TX",
    "zip": "78702"
  }
}
EOF
)

RESPONSE=$(curl -s -X POST "$BASE_URL/requests" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_BODY")

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"success":true'; then
    print_success "Job request created"
    REQUEST_ID=$(echo "$RESPONSE" | grep -o '"request_id":"[^"]*"' | cut -d'"' -f4)
    print_info "Request ID: $REQUEST_ID"
else
    print_error "Job request creation failed"
fi

# =============================================================================
# Test 6: Create Modification Request
# =============================================================================
print_header "Test 6: Create Modification Request (POST /modifications)"

if [ -n "$JOB_ID" ]; then
    RESPONSE=$(curl -s -X POST "$BASE_URL/modifications" \
      -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"job_id\": \"$JOB_ID\",
        \"modification_type\": \"reschedule\",
        \"reason\": \"Test modification from shell script - $(date)\",
        \"requested_date\": \"2026-01-25\",
        \"time_preference\": \"afternoon\"
      }")
    
    echo "Response: $RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Modification request created"
        MODIFICATION_ID=$(echo "$RESPONSE" | grep -o '"modification_id":"[^"]*"' | cut -d'"' -f4)
        print_info "Modification ID: $MODIFICATION_ID"
    else
        print_error "Modification request creation failed"
    fi
else
    print_info "Skipping - no job ID available for modification"
fi

# =============================================================================
# Test 7: Get Business Config
# =============================================================================
print_header "Test 7: Get Business Config (GET /config)"

RESPONSE=$(curl -s -X GET "$BASE_URL/config" \
  -H "Authorization: Bearer $API_KEY")

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"business_id"'; then
    print_success "Business config retrieved"
    
    BUSINESS_NAME=$(echo "$RESPONSE" | grep -o '"business_name":"[^"]*"' | cut -d'"' -f4)
    print_info "Business: $BUSINESS_NAME"
    
    echo ""
    echo "Permissions:"
    echo "$RESPONSE" | grep -o '"permissions":{[^}]*}' | tr ',' '\n' | while read line; do
        echo "  $line"
    done
else
    print_error "Business config request failed"
fi

# =============================================================================
# Error Tests
# =============================================================================
print_header "Error Tests"

# Test missing auth
echo -e "\n${YELLOW}Testing missing Authorization header...${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/config")
if echo "$RESPONSE" | grep -q '"code":"MISSING_AUTH"'; then
    print_success "Missing auth returns 401 with MISSING_AUTH code"
else
    print_error "Missing auth error handling failed"
fi

# Test invalid key
echo -e "\n${YELLOW}Testing invalid API key...${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/config" \
  -H "Authorization: Bearer sgp_invalid_key_12345")
if echo "$RESPONSE" | grep -q '"code":"INVALID_KEY"'; then
    print_success "Invalid key returns 401 with INVALID_KEY code"
else
    print_error "Invalid key error handling failed"
fi

# =============================================================================
# Summary
# =============================================================================
print_header "Test Summary"

echo ""
echo "Test Results:"
echo "  • Customer Lookup:     Tested"
echo "  • List Jobs:           Tested"
echo "  • Get Job ETA:         $([ -n "$JOB_ID" ] && echo "Tested" || echo "Skipped (no jobs)")"
echo "  • Check Service Area:  Tested"
echo "  • Create Request:      $([ -n "$REQUEST_ID" ] && echo "Created: $REQUEST_ID" || echo "Failed")"
echo "  • Create Modification: $([ -n "$MODIFICATION_ID" ] && echo "Created: $MODIFICATION_ID" || echo "Skipped")"
echo "  • Get Config:          Tested"
echo "  • Error Handling:      Tested"
echo ""
print_info "Check the /requests page to see the created test request"
echo ""
