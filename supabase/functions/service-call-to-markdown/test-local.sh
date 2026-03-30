#!/bin/bash

SERVICE_CALL_ID="your-service-call-uuid-here"
SUPABASE_URL="http://localhost:54321"
ANON_KEY="your-anon-key-here"

curl -X POST "${SUPABASE_URL}/functions/v1/service-call-to-markdown" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"${SERVICE_CALL_ID}\"
  }"
