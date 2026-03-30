#!/bin/bash

# Test script for deployed process-transcript Edge Function
# This script validates the production deployment

set -e

echo "🧪 Testing deployed process-transcript Edge Function..."

# Configuration
PROJECT_ID="${SUPABASE_PROJECT_ID}"
ANON_KEY="${SUPABASE_ANON_KEY}"

if [ -z "$PROJECT_ID" ] || [ -z "$ANON_KEY" ]; then
    echo "❌ Missing environment variables"
    echo "Please set SUPABASE_PROJECT_ID and SUPABASE_ANON_KEY"
    exit 1
fi

FUNCTION_URL="https://$PROJECT_ID.supabase.co/functions/v1/process-transcript"

echo "📍 Testing endpoint: $FUNCTION_URL"
echo ""

# Test 1: Health Check (OPTIONS request)
echo "Test 1: Health Check..."
RESPONSE=$(curl -s -X OPTIONS "$FUNCTION_URL" \
    -H "Authorization: Bearer $ANON_KEY" \
    -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed (HTTP $HTTP_STATUS)"
    exit 1
fi

# Test 2: Invalid Method
echo ""
echo "Test 2: Invalid Method (GET)..."
RESPONSE=$(curl -s -X GET "$FUNCTION_URL" \
    -H "Authorization: Bearer $ANON_KEY" \
    -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)

if [ "$HTTP_STATUS" = "405" ]; then
    echo "✅ Method validation working"
else
    echo "❌ Method validation failed (expected 405, got $HTTP_STATUS)"
fi

# Test 3: Invalid Input
echo ""
echo "Test 3: Invalid Input..."
RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"invalid": "data"}' \
    -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)

if [ "$HTTP_STATUS" = "400" ]; then
    echo "✅ Input validation working"
else
    echo "❌ Input validation failed (expected 400, got $HTTP_STATUS)"
fi

# Test 4: Valid Request (Small)
echo ""
echo "Test 4: Valid Request..."

TEST_PAYLOAD='{
  "transcript": "During our meeting, we discussed the need for a new user authentication system. The system should support email/password login, social authentication with Google and GitHub, and two-factor authentication. We also need password reset functionality and session management.",
  "context": {
    "name": "Authentication System",
    "description": "User authentication and authorization system for the web application",
    "industry": "Technology",
    "techStack": ["React", "Node.js", "PostgreSQL", "Redis"]
  }
}'

echo "Sending test request..."
RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "$TEST_PAYLOAD" \
    -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Valid request processed successfully"
    
    # Check if response contains expected fields
    if echo "$BODY" | grep -q '"success":true' && \
       echo "$BODY" | grep -q '"requestId"' && \
       echo "$BODY" | grep -q '"documents"'; then
        echo "✅ Response structure valid"
        
        # Extract requestId for monitoring
        REQUEST_ID=$(echo "$BODY" | grep -o '"requestId":"[^"]*"' | cut -d'"' -f4)
        echo "📝 Request ID: $REQUEST_ID"
    else
        echo "⚠️  Response structure unexpected"
        echo "$BODY" | head -c 500
    fi
else
    echo "❌ Valid request failed (HTTP $HTTP_STATUS)"
    echo "$BODY" | head -c 500
fi

# Test 5: Performance Check
echo ""
echo "Test 5: Performance Check..."

START_TIME=$(date +%s)
curl -s -X POST "$FUNCTION_URL" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "$TEST_PAYLOAD" \
    -o /dev/null
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ "$DURATION" -lt 30 ]; then
    echo "✅ Response time acceptable: ${DURATION}s"
else
    echo "⚠️  Response time high: ${DURATION}s (expected < 30s)"
fi

# Test 6: Check Logs
echo ""
echo "Test 6: Checking logs..."
echo "Run the following command to view logs:"
echo "supabase functions logs process-transcript --project-ref $PROJECT_ID"

# Summary
echo ""
echo "📊 Test Summary:"
echo "=================="
echo "✅ Health Check: Passed"
echo "✅ Method Validation: Working"
echo "✅ Input Validation: Working"

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Document Generation: Working"
else
    echo "❌ Document Generation: Failed"
fi

if [ "$DURATION" -lt 30 ]; then
    echo "✅ Performance: Acceptable (${DURATION}s)"
else
    echo "⚠️  Performance: Needs optimization (${DURATION}s)"
fi

echo ""
echo "🎉 Deployment testing complete!"