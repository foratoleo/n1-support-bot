#!/bin/bash

# API CRUD Endpoints - Curl Test Suite
# Usage: ./api-curl-tests.sh [endpoint] [action]
# Examples:
#   ./api-curl-tests.sh                    # Run all tests
#   ./api-curl-tests.sh projects           # Run all projects tests
#   ./api-curl-tests.sh projects list      # Run specific test

# Configuration
SUPABASE_URL="${SUPABASE_URL:-https://gerxucfvjluujtpwnybt.supabase.co}"
SERVICE_KEY="${SERVICE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlcnh1Y2Z2amx1dWp0cHdueWJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzM0NzIxOSwiZXhwIjoyMDcyOTIzMjE5fQ.IP2KIUWMzqrxzO5KEOv_F5YMdiR82TJcasFWjeVwx9M}"
TEST_PROJECT_ID="${TEST_PROJECT_ID:-bbcf0a19-a21f-4581-9272-bf72c6c757e9}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[PASS]${NC} $1"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_error() {
  echo -e "${RED}[FAIL]${NC} $1"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

log_header() {
  echo ""
  echo -e "${YELLOW}========================================${NC}"
  echo -e "${YELLOW} $1${NC}"
  echo -e "${YELLOW}========================================${NC}"
}

# Generic API call function
api_call() {
  local endpoint=$1
  local payload=$2
  local description=$3

  log_info "Testing: $description"

  response=$(echo "$payload" | curl -sS -X POST \
    "${SUPABASE_URL}/functions/v1/${endpoint}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d @- 2>&1)

  if echo "$response" | grep -q '"success":true'; then
    log_success "$description"
    if [ "$VERBOSE" = "true" ]; then
      echo "$response" | head -c 500
      echo "..."
    fi
    return 0
  else
    log_error "$description"
    echo "Response: $response" | head -c 300
    return 1
  fi
}

# ============================================
# API-PROJECTS Tests
# ============================================
test_projects_list() {
  api_call "api-projects" \
    '{"action": "list", "pagination": {"page": 1, "limit": 5}}' \
    "api-projects LIST (paginated)"
}

test_projects_list_filtered() {
  api_call "api-projects" \
    '{"action": "list", "filters": {"is_active": true}, "pagination": {"page": 1, "limit": 5}}' \
    "api-projects LIST (filtered by is_active)"
}

test_projects_get() {
  api_call "api-projects" \
    "{\"action\": \"get\", \"project_id\": \"${TEST_PROJECT_ID}\"}" \
    "api-projects GET (by ID)"
}

test_projects_create() {
  local timestamp=$(date +%s)
  api_call "api-projects" \
    "{\"action\": \"create\", \"name\": \"Test Project ${timestamp}\", \"description\": \"Automated test project\", \"tags\": [\"test\", \"automated\"]}" \
    "api-projects CREATE"
}

run_projects_tests() {
  log_header "API-PROJECTS Tests"
  test_projects_list
  test_projects_list_filtered
  test_projects_get
  # test_projects_create  # Uncomment to test create
}

# ============================================
# API-TASKS Tests
# ============================================
test_tasks_list() {
  api_call "api-tasks" \
    "{\"action\": \"list\", \"project_id\": \"${TEST_PROJECT_ID}\", \"pagination\": {\"page\": 1, \"limit\": 5}}" \
    "api-tasks LIST (paginated)"
}

test_tasks_list_filtered() {
  api_call "api-tasks" \
    "{\"action\": \"list\", \"project_id\": \"${TEST_PROJECT_ID}\", \"filters\": {\"status\": [\"todo\", \"in_progress\"]}, \"pagination\": {\"page\": 1, \"limit\": 5}}" \
    "api-tasks LIST (filtered by status)"
}

test_tasks_list_sorted() {
  api_call "api-tasks" \
    "{\"action\": \"list\", \"project_id\": \"${TEST_PROJECT_ID}\", \"sort\": {\"field\": \"priority\", \"order\": \"desc\"}, \"pagination\": {\"page\": 1, \"limit\": 5}}" \
    "api-tasks LIST (sorted by priority)"
}

run_tasks_tests() {
  log_header "API-TASKS Tests"
  test_tasks_list
  test_tasks_list_filtered
  test_tasks_list_sorted
}

# ============================================
# API-SPRINTS Tests
# ============================================
test_sprints_list() {
  api_call "api-sprints" \
    "{\"action\": \"list\", \"project_id\": \"${TEST_PROJECT_ID}\", \"pagination\": {\"page\": 1, \"limit\": 5}}" \
    "api-sprints LIST (paginated)"
}

test_sprints_list_filtered() {
  api_call "api-sprints" \
    "{\"action\": \"list\", \"project_id\": \"${TEST_PROJECT_ID}\", \"filters\": {\"status\": [\"active\", \"planning\"]}, \"pagination\": {\"page\": 1, \"limit\": 5}}" \
    "api-sprints LIST (filtered by status)"
}

run_sprints_tests() {
  log_header "API-SPRINTS Tests"
  test_sprints_list
  test_sprints_list_filtered
}

# ============================================
# API-MEETINGS Tests
# ============================================
test_meetings_list() {
  api_call "api-meetings" \
    '{"action": "list", "pagination": {"page": 1, "limit": 5}}' \
    "api-meetings LIST (all meetings)"
}

test_meetings_list_by_project() {
  api_call "api-meetings" \
    "{\"action\": \"list\", \"project_id\": \"${TEST_PROJECT_ID}\", \"pagination\": {\"page\": 1, \"limit\": 5}}" \
    "api-meetings LIST (by project)"
}

test_meetings_list_filtered() {
  api_call "api-meetings" \
    '{"action": "list", "filters": {"is_public": true}, "pagination": {"page": 1, "limit": 5}}' \
    "api-meetings LIST (filtered by is_public)"
}

test_meetings_list_date_range() {
  api_call "api-meetings" \
    '{"action": "list", "filters": {"date_from": "2025-01-01", "date_to": "2025-12-31"}, "pagination": {"page": 1, "limit": 5}}' \
    "api-meetings LIST (date range filter)"
}

run_meetings_tests() {
  log_header "API-MEETINGS Tests"
  test_meetings_list
  test_meetings_list_by_project
  test_meetings_list_filtered
  test_meetings_list_date_range
}

# ============================================
# API-BACKLOG-ITEMS Tests
# ============================================
test_backlog_list() {
  api_call "api-backlog-items" \
    "{\"action\": \"list\", \"project_id\": \"${TEST_PROJECT_ID}\", \"pagination\": {\"page\": 1, \"limit\": 5}}" \
    "api-backlog-items LIST (paginated)"
}

test_backlog_list_filtered() {
  api_call "api-backlog-items" \
    "{\"action\": \"list\", \"project_id\": \"${TEST_PROJECT_ID}\", \"filters\": {\"status\": [\"draft\", \"ready\"]}, \"pagination\": {\"page\": 1, \"limit\": 5}}" \
    "api-backlog-items LIST (filtered by status)"
}

test_backlog_list_sorted() {
  api_call "api-backlog-items" \
    "{\"action\": \"list\", \"project_id\": \"${TEST_PROJECT_ID}\", \"sort\": {\"field\": \"priority\", \"order\": \"desc\"}, \"pagination\": {\"page\": 1, \"limit\": 5}}" \
    "api-backlog-items LIST (sorted by priority)"
}

run_backlog_tests() {
  log_header "API-BACKLOG-ITEMS Tests"
  test_backlog_list
  test_backlog_list_filtered
  test_backlog_list_sorted
}

# ============================================
# API-FEATURES Tests
# ============================================
test_features_list() {
  api_call "api-features" \
    "{\"action\": \"list\", \"project_id\": \"${TEST_PROJECT_ID}\", \"pagination\": {\"page\": 1, \"limit\": 5}}" \
    "api-features LIST (paginated)"
}

test_features_list_filtered() {
  api_call "api-features" \
    "{\"action\": \"list\", \"project_id\": \"${TEST_PROJECT_ID}\", \"filters\": {\"status\": [\"draft\", \"ready\"]}, \"pagination\": {\"page\": 1, \"limit\": 5}}" \
    "api-features LIST (filtered by status)"
}

test_features_list_by_priority() {
  api_call "api-features" \
    "{\"action\": \"list\", \"project_id\": \"${TEST_PROJECT_ID}\", \"filters\": {\"priority\": [\"high\", \"critical\"]}, \"pagination\": {\"page\": 1, \"limit\": 5}}" \
    "api-features LIST (filtered by priority)"
}

test_features_list_sorted() {
  api_call "api-features" \
    "{\"action\": \"list\", \"project_id\": \"${TEST_PROJECT_ID}\", \"sort\": {\"field\": \"story_points\", \"order\": \"desc\"}, \"pagination\": {\"page\": 1, \"limit\": 5}}" \
    "api-features LIST (sorted by story_points)"
}

test_features_create() {
  local timestamp=$(date +%s)
  api_call "api-features" \
    "{\"action\": \"create\", \"project_id\": \"${TEST_PROJECT_ID}\", \"title\": \"Test Feature ${timestamp}\", \"description\": \"Automated test feature\", \"status\": \"draft\", \"priority\": \"high\", \"story_points\": 5, \"tags\": [\"test\", \"automated\"]}" \
    "api-features CREATE"
}

test_features_create_batch() {
  local timestamp=$(date +%s)
  api_call "api-features" \
    "{\"action\": \"create_batch\", \"project_id\": \"${TEST_PROJECT_ID}\", \"items\": [{\"title\": \"Batch Feature A ${timestamp}\", \"status\": \"draft\", \"priority\": \"medium\", \"story_points\": 3}, {\"title\": \"Batch Feature B ${timestamp}\", \"status\": \"ready\", \"priority\": \"high\", \"story_points\": 5}]}" \
    "api-features CREATE_BATCH (2 items)"
}

run_features_tests() {
  log_header "API-FEATURES Tests"
  test_features_list
  test_features_list_filtered
  test_features_list_by_priority
  test_features_list_sorted
  # test_features_create        # Uncomment to test create
  # test_features_create_batch  # Uncomment to test batch create
}

# ============================================
# Main Execution
# ============================================
print_summary() {
  echo ""
  echo -e "${YELLOW}========================================${NC}"
  echo -e "${YELLOW} Test Summary${NC}"
  echo -e "${YELLOW}========================================${NC}"
  echo -e "  ${GREEN}Passed:${NC} $TESTS_PASSED"
  echo -e "  ${RED}Failed:${NC} $TESTS_FAILED"
  echo -e "  Total:  $((TESTS_PASSED + TESTS_FAILED))"
  echo ""

  if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
  else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
  fi
}

run_all_tests() {
  run_projects_tests
  run_tasks_tests
  run_sprints_tests
  run_meetings_tests
  run_backlog_tests
  run_features_tests
  print_summary
}

# Parse arguments
ENDPOINT=${1:-"all"}
ACTION=${2:-""}

case $ENDPOINT in
  "projects")
    if [ -n "$ACTION" ]; then
      test_projects_$ACTION
    else
      run_projects_tests
    fi
    ;;
  "tasks")
    if [ -n "$ACTION" ]; then
      test_tasks_$ACTION
    else
      run_tasks_tests
    fi
    ;;
  "sprints")
    if [ -n "$ACTION" ]; then
      test_sprints_$ACTION
    else
      run_sprints_tests
    fi
    ;;
  "meetings")
    if [ -n "$ACTION" ]; then
      test_meetings_$ACTION
    else
      run_meetings_tests
    fi
    ;;
  "backlog")
    if [ -n "$ACTION" ]; then
      test_backlog_$ACTION
    else
      run_backlog_tests
    fi
    ;;
  "features")
    if [ -n "$ACTION" ]; then
      test_features_$ACTION
    else
      run_features_tests
    fi
    ;;
  "all"|"")
    run_all_tests
    ;;
  *)
    echo "Usage: $0 [endpoint] [action]"
    echo ""
    echo "Endpoints: projects, tasks, sprints, meetings, backlog, features, all"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run all tests"
    echo "  $0 projects           # Run all projects tests"
    echo "  $0 projects list      # Run specific test"
    echo ""
    echo "Environment variables:"
    echo "  SUPABASE_URL    - Supabase project URL"
    echo "  SERVICE_KEY     - Supabase service role key"
    echo "  TEST_PROJECT_ID - Project ID for testing"
    echo "  VERBOSE=true    - Show response details"
    exit 1
    ;;
esac

print_summary
