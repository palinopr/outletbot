#!/bin/bash

echo "🚀 TESTING LIVE WEBHOOK WITH REAL CONTACT"
echo "========================================"
echo ""
echo "Contact: 54sJIGTtwmR89Qc5JeEt"
echo "URL: https://app.gohighlevel.com/v2/location/sHFG9Rw6BdGh6d6bfMqG/contacts/detail/54sJIGTtwmR89Qc5JeEt"
echo ""

# Your webhook URL - update this with your actual deployment URL
WEBHOOK_URL="https://outletbot-[YOUR-ID].us.langgraph.app/webhook/meta-lead"

# Test payload with real contact
PAYLOAD='{
  "phone": "+14085551234",
  "message": "Hola, me interesa información sobre sus servicios de marketing",
  "contactId": "54sJIGTtwmR89Qc5JeEt"
}'

echo "📨 Sending test payload:"
echo "$PAYLOAD" | jq .
echo ""

echo "⏱️  Starting test..."
START_TIME=$(date +%s)

# Send the webhook request
RESPONSE=$(curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -w "\n\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" \
  -m 30 \
  2>/dev/null)

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "📊 RESULTS:"
echo "Duration: ${DURATION} seconds"
echo ""
echo "Response:"
echo "$RESPONSE"
echo ""

# Check if it timed out
if [[ $RESPONSE == *"timeout"* ]] || [[ $DURATION -gt 20 ]]; then
  echo "❌ WEBHOOK TIMED OUT OR SLOW RESPONSE"
  echo "   This should NOT happen with our fixes!"
else
  echo "✅ WEBHOOK RESPONDED WITHIN TIMEOUT"
fi

echo ""
echo "📋 Expected behavior with timeouts:"
echo "- Should respond within 15 seconds max"
echo "- If GHL is down: Fails at 3-5 seconds"
echo "- If OpenAI is slow: Fails at 10 seconds"
echo "- Circuit breaker message if too many failures"