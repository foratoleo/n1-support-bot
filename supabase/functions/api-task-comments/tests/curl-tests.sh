#!/bin/bash

# =============================================================================
# API Task Comments - Curl Test Scripts
# =============================================================================
# Usage: ./curl-tests.sh
#
# Environment Variables Required:
#   SUPABASE_URL - Your Supabase project URL
#   SUPABASE_ANON_KEY - Your Supabase anon/service key
#   PROJECT_ID - A valid project UUID
#   TASK_ID - A valid task UUID within the project
#   AUTHOR_ID - A valid user UUID for testing
# =============================================================================

# Configuration - Set these or export as environment variables
SUPABASE_URL="${SUPABASE_URL:-https://your-project.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-your-anon-key}"
PROJECT_ID="${PROJECT_ID:-00000000-0000-0000-0000-000000000000}"
TASK_ID="${TASK_ID:-00000000-0000-0000-0000-000000000001}"
AUTHOR_ID="${AUTHOR_ID:-00000000-0000-0000-0000-000000000002}"

ENDPOINT="$SUPABASE_URL/functions/v1/api-task-comments"

echo "=============================================="
echo "API Task Comments - Test Suite"
echo "=============================================="
echo "Endpoint: $ENDPOINT"
echo "Project ID: $PROJECT_ID"
echo "Task ID: $TASK_ID"
echo "Author ID: $AUTHOR_ID"
echo ""

# -----------------------------------------------------------------------------
# Test 1: Create Comment
# -----------------------------------------------------------------------------
echo ">>> Test 1: Create Comment"
echo "Expected: 201 Created with comment object"
echo ""

CREATE_RESPONSE=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{
    "action": "create",
    "project_id": "'"$PROJECT_ID"'",
    "task_id": "'"$TASK_ID"'",
    "author_id": "'"$AUTHOR_ID"'",
    "content": "This is a test comment from curl tests",
    "mentioned_members": []
  }')

echo "$CREATE_RESPONSE" | jq .
echo ""

# Extract comment_id for subsequent tests
COMMENT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.comment.id // empty')

if [ -z "$COMMENT_ID" ]; then
  echo "Warning: Could not extract comment_id from response. Using placeholder."
  COMMENT_ID="00000000-0000-0000-0000-000000000003"
fi

echo "Created Comment ID: $COMMENT_ID"
echo ""

# -----------------------------------------------------------------------------
# Test 2: List Comments
# -----------------------------------------------------------------------------
echo ">>> Test 2: List Comments (default pagination)"
echo "Expected: 200 OK with paginated comments array"
echo ""

curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{
    "action": "list",
    "project_id": "'"$PROJECT_ID"'",
    "task_id": "'"$TASK_ID"'"
  }' | jq .

echo ""

# -----------------------------------------------------------------------------
# Test 3: List Comments with Pagination
# -----------------------------------------------------------------------------
echo ">>> Test 3: List Comments (with pagination and sort)"
echo "Expected: 200 OK with paginated results"
echo ""

curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{
    "action": "list",
    "project_id": "'"$PROJECT_ID"'",
    "task_id": "'"$TASK_ID"'",
    "pagination": {
      "page": 1,
      "limit": 10
    },
    "sort": {
      "field": "created_at",
      "order": "desc"
    }
  }' | jq .

echo ""

# -----------------------------------------------------------------------------
# Test 4: Update Comment (as author)
# -----------------------------------------------------------------------------
echo ">>> Test 4: Update Comment (as author - should succeed)"
echo "Expected: 200 OK with updated comment"
echo ""

curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{
    "action": "update",
    "project_id": "'"$PROJECT_ID"'",
    "comment_id": "'"$COMMENT_ID"'",
    "author_id": "'"$AUTHOR_ID"'",
    "data": {
      "content": "This comment has been updated via curl test"
    }
  }' | jq .

echo ""

# -----------------------------------------------------------------------------
# Test 5: Update Comment (as different author - should fail)
# -----------------------------------------------------------------------------
echo ">>> Test 5: Update Comment (as different author - should fail)"
echo "Expected: 403 Forbidden - Only the author can edit this comment"
echo ""

DIFFERENT_AUTHOR="11111111-1111-1111-1111-111111111111"

curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{
    "action": "update",
    "project_id": "'"$PROJECT_ID"'",
    "comment_id": "'"$COMMENT_ID"'",
    "author_id": "'"$DIFFERENT_AUTHOR"'",
    "data": {
      "content": "Attempting to update someone elses comment"
    }
  }' | jq .

echo ""

# -----------------------------------------------------------------------------
# Test 6: Create Comment with mentions
# -----------------------------------------------------------------------------
echo ">>> Test 6: Create Comment with mentions"
echo "Expected: 201 Created with mentioned_members array"
echo ""

curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{
    "action": "create",
    "project_id": "'"$PROJECT_ID"'",
    "task_id": "'"$TASK_ID"'",
    "author_id": "'"$AUTHOR_ID"'",
    "content": "Hey @user, please check this task",
    "mentioned_members": ["'"$AUTHOR_ID"'"]
  }' | jq .

echo ""

# -----------------------------------------------------------------------------
# Test 7: Validation Error - Missing content
# -----------------------------------------------------------------------------
echo ">>> Test 7: Validation Error (missing content)"
echo "Expected: 400 Bad Request with validation errors"
echo ""

curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{
    "action": "create",
    "project_id": "'"$PROJECT_ID"'",
    "task_id": "'"$TASK_ID"'",
    "author_id": "'"$AUTHOR_ID"'"
  }' | jq .

echo ""

# -----------------------------------------------------------------------------
# Test 8: Not Found - Invalid task
# -----------------------------------------------------------------------------
echo ">>> Test 8: Not Found Error (invalid task_id)"
echo "Expected: 404 Not Found"
echo ""

curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{
    "action": "create",
    "project_id": "'"$PROJECT_ID"'",
    "task_id": "99999999-9999-9999-9999-999999999999",
    "author_id": "'"$AUTHOR_ID"'",
    "content": "This should fail - task does not exist"
  }' | jq .

echo ""

# -----------------------------------------------------------------------------
# Test 9: Method Not Allowed
# -----------------------------------------------------------------------------
echo ">>> Test 9: Method Not Allowed (GET request)"
echo "Expected: 405 Method Not Allowed"
echo ""

curl -s -X GET "$ENDPOINT" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" | jq .

echo ""

echo "=============================================="
echo "Test Suite Complete"
echo "=============================================="
