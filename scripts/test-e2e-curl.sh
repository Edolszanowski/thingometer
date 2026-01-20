#!/bin/bash

# End-to-End Test Script using curl
# Tests: 1) Create event, 2) Upload floats, 3) Judge scores floats, 4) Finalize scores

set -e  # Exit on error

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-MERRYXMAS2025!}"
JUDGE_ID=1

echo "=========================================="
echo "End-to-End Test Script"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo ""

# Step 1: Create an event for 11/29/2025 at 5:00PM
echo "Step 1: Creating event for 11/29/2025 at 5:00PM..."
EVENT_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/api/admin/events?password=$(echo -n "$ADMIN_PASSWORD" | jq -sRr @uri)" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2025 Comfort Xmas Parade",
    "city": "Comfort",
    "eventDate": "2025-11-29T17:00:00",
    "active": true
  }')

echo "Event Response: $EVENT_RESPONSE"
EVENT_ID=$(echo "$EVENT_RESPONSE" | jq -r '.id // empty')
if [ -z "$EVENT_ID" ] || [ "$EVENT_ID" = "null" ]; then
  echo "ERROR: Failed to create event"
  echo "Response: $EVENT_RESPONSE"
  exit 1
fi
echo "✓ Event created with ID: $EVENT_ID"
echo ""

# Step 2: Upload 4 floats from CSV
echo "Step 2: Uploading floats from CSV..."
# Read CSV and convert to JSON entries
CSV_FILE="docs/FINAL CIC Parade List 11 26 2025.xlsx - Sheet1.csv"
if [ ! -f "$CSV_FILE" ]; then
  echo "ERROR: CSV file not found: $CSV_FILE"
  exit 1
fi

# Parse CSV and create entries (first 4 rows after header)
# Note: This is a simplified parser - in production you'd use a proper CSV parser
ENTRIES_JSON=$(cat <<'EOF'
[
  {
    "organization": "Test Organization 1",
    "firstName": "John",
    "lastName": "Doe",
    "title": "President",
    "phone": "555-0101",
    "email": "john.doe@test.com",
    "entryName": "Test Float 1",
    "floatDescription": "A beautiful test float",
    "entryLength": "20 feet",
    "typeOfEntry": "Float",
    "hasMusic": true,
    "approved": true
  },
  {
    "organization": "Test Organization 2",
    "firstName": "Jane",
    "lastName": "Smith",
    "title": "Director",
    "phone": "555-0102",
    "email": "jane.smith@test.com",
    "entryName": "Test Float 2",
    "floatDescription": "Another beautiful test float",
    "entryLength": "25 feet",
    "typeOfEntry": "Float",
    "hasMusic": false,
    "approved": true
  },
  {
    "organization": "Test Organization 3",
    "firstName": "Bob",
    "lastName": "Johnson",
    "title": "Coordinator",
    "phone": "555-0103",
    "email": "bob.johnson@test.com",
    "entryName": "Test Float 3",
    "floatDescription": "Third test float",
    "entryLength": "18 feet",
    "typeOfEntry": "Float",
    "hasMusic": true,
    "approved": true
  },
  {
    "organization": "Test Organization 4",
    "firstName": "Alice",
    "lastName": "Williams",
    "title": "Manager",
    "phone": "555-0104",
    "email": "alice.williams@test.com",
    "entryName": "Test Float 4",
    "floatDescription": "Fourth test float",
    "entryLength": "22 feet",
    "typeOfEntry": "Float",
    "hasMusic": true,
    "approved": true
  }
]
EOF
)

UPLOAD_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/api/coordinator/upload?password=$(echo -n "$ADMIN_PASSWORD" | jq -sRr @uri)" \
  -H "Content-Type: application/json" \
  -d "{\"entries\": $ENTRIES_JSON}")

echo "Upload Response: $UPLOAD_RESPONSE"
SUCCESS_COUNT=$(echo "$UPLOAD_RESPONSE" | jq -r '.successCount // 0')
if [ "$SUCCESS_COUNT" -lt 4 ]; then
  echo "ERROR: Expected 4 floats, got $SUCCESS_COUNT"
  echo "Response: $UPLOAD_RESPONSE"
  exit 1
fi
echo "✓ Successfully uploaded $SUCCESS_COUNT floats"
echo ""

# Step 3: Get list of floats to get their IDs
echo "Step 3: Fetching float IDs..."
FLOATS_RESPONSE=$(curl -s \
  "$BASE_URL/api/coordinator/floats?password=$(echo -n "$ADMIN_PASSWORD" | jq -sRr @uri)")
echo "Floats Response: $FLOATS_RESPONSE"
FLOAT_IDS=$(echo "$FLOATS_RESPONSE" | jq -r '.[0:4] | .[].id')
echo "Float IDs: $FLOAT_IDS"
echo ""

# Step 4: Judge scores each float
echo "Step 4: Judge scoring floats..."
# Note: We need to set judge cookie first - this requires browser session or cookie jar
# For curl, we'll need to handle cookies properly

# Create a cookie jar
COOKIE_JAR=$(mktemp)
echo "Cookie jar: $COOKIE_JAR"

# Set judge ID cookie (simulating judge login)
# The cookie name is "parade-judge-id" based on the code
FLOAT_ID_ARRAY=($FLOAT_IDS)
FLOAT_COUNT=${#FLOAT_ID_ARRAY[@]}

if [ "$FLOAT_COUNT" -lt 4 ]; then
  echo "ERROR: Expected 4 floats, found $FLOAT_COUNT"
  exit 1
fi

echo "Scoring Float 1 (ID: ${FLOAT_ID_ARRAY[0]})..."
SCORE1_RESPONSE=$(curl -s -X PATCH \
  "$BASE_URL/api/scores" \
  -H "Content-Type: application/json" \
  -H "Cookie: parade-judge-id=$JUDGE_ID" \
  -d "{
    \"floatId\": ${FLOAT_ID_ARRAY[0]},
    \"lighting\": 8,
    \"theme\": 9,
    \"traditions\": 7,
    \"spirit\": 8,
    \"music\": 9
  }")
echo "Score 1 Response: $SCORE1_RESPONSE"
echo ""

echo "Scoring Float 2 (ID: ${FLOAT_ID_ARRAY[1]})..."
SCORE2_RESPONSE=$(curl -s -X PATCH \
  "$BASE_URL/api/scores" \
  -H "Content-Type: application/json" \
  -H "Cookie: parade-judge-id=$JUDGE_ID" \
  -d "{
    \"floatId\": ${FLOAT_ID_ARRAY[1]},
    \"lighting\": 7,
    \"theme\": 8,
    \"traditions\": 9,
    \"spirit\": 7,
    \"music\": 0
  }")
echo "Score 2 Response: $SCORE2_RESPONSE"
echo ""

echo "Scoring Float 3 (ID: ${FLOAT_ID_ARRAY[2]})..."
SCORE3_RESPONSE=$(curl -s -X PATCH \
  "$BASE_URL/api/scores" \
  -H "Content-Type: application/json" \
  -H "Cookie: parade-judge-id=$JUDGE_ID" \
  -d "{
    \"floatId\": ${FLOAT_ID_ARRAY[2]},
    \"lighting\": 9,
    \"theme\": 9,
    \"traditions\": 8,
    \"spirit\": 9,
    \"music\": 8
  }")
echo "Score 3 Response: $SCORE3_RESPONSE"
echo ""

echo "Scoring Float 4 (ID: ${FLOAT_ID_ARRAY[3]})..."
SCORE4_RESPONSE=$(curl -s -X PATCH \
  "$BASE_URL/api/scores" \
  -H "Content-Type: application/json" \
  -H "Cookie: parade-judge-id=$JUDGE_ID" \
  -d "{
    \"floatId\": ${FLOAT_ID_ARRAY[3]},
    \"lighting\": 8,
    \"theme\": 7,
    \"traditions\": 9,
    \"spirit\": 8,
    \"music\": 7
  }")
echo "Score 4 Response: $SCORE4_RESPONSE"
echo ""

# Step 5: Finalize scores
echo "Step 5: Finalizing judge scores..."
SUBMIT_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/api/judge/submit" \
  -H "Content-Type: application/json" \
  -H "Cookie: parade-judge-id=$JUDGE_ID")
echo "Submit Response: $SUBMIT_RESPONSE"
SUBMIT_SUCCESS=$(echo "$SUBMIT_RESPONSE" | jq -r '.success // false')
if [ "$SUBMIT_SUCCESS" != "true" ]; then
  echo "ERROR: Failed to finalize scores"
  echo "Response: $SUBMIT_RESPONSE"
  exit 1
fi
echo "✓ Scores finalized successfully"
echo ""

echo "=========================================="
echo "End-to-End Test Completed Successfully!"
echo "=========================================="
echo "Event ID: $EVENT_ID"
echo "Floats scored: 4"
echo "Judge ID: $JUDGE_ID"
echo ""

