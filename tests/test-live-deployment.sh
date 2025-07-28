#!/bin/bash

# Live deployment test script
echo "🚀 TESTING LIVE DEPLOYMENT"
echo "========================="
echo ""

# Your deployment URL (update this with your actual URL)
DEPLOYMENT_URL="https://outletbot-[your-id].us.langgraph.app/webhook/meta-lead"
CONTACT_ID="54sJIGTtwmR89Qc5JeEt"

echo "📱 Sending test message to webhook..."
echo "Contact ID: $CONTACT_ID"
echo ""

# Test 1: Simple greeting
echo "Test 1: Simple greeting"
curl -X POST "$DEPLOYMENT_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+13054870475",
    "message": "Hola, necesito información",
    "contactId": "'$CONTACT_ID'"
  }' \
  -w "\n\nStatus: %{http_code}\nTime: %{time_total}s\n"

echo ""
echo "✅ Test sent!"
echo ""
echo "🔍 NEXT STEPS:"
echo "1. Check WhatsApp for bot response"
echo "2. Check LangSmith for the trace"
echo "3. Check GHL conversation: https://app.gohighlevel.com/v2/location/sHFG9Rw6BdGh6d6bfMqG/contacts/detail/$CONTACT_ID"
echo ""
echo "📊 Expected behavior:"
echo "- Bot should respond with a greeting in Spanish"
echo "- Bot should ask for your name"
echo "- Response should appear in WhatsApp within 5-10 seconds"