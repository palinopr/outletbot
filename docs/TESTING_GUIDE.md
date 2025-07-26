# Testing Guide - Outlet Media Bot

This guide explains how to test the webhook handlers in production to diagnose issues.

## Prerequisites

- **API Key**: `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`
- **Base URL**: `https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app`
- **Test Contact ID**: `54sJIGTtwmR89Qc5JeEt`
- **Test Phone**: `+13054870475`

## Available Test Webhooks

1. **`simple_webhook`** - Basic functionality test (no dependencies)
2. **`debug_webhook`** - Shows environment variables and import status
3. **`webhook_debug_detailed`** - Step-by-step execution logging
4. **`webhook_handler`** - Main production webhook (currently failing)

## How to Test

### 1. Basic Webhook Test (simple_webhook)

Tests if the deployment can handle basic webhook requests without any GHL dependencies.

```bash
curl -X POST https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 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" \
  -d '{
    "assistant_id": "simple_webhook",
    "input": {
      "messages": [{
        "role": "human",
        "content": "{\"phone\": \"+13054870475\", \"message\": \"Hola test\", \"contactId\": \"54sJIGTtwmR89Qc5JeEt\"}"
      }]
    },
    "stream_mode": "values"
  }'
```

**Expected Response**: 
```
"Hola! Simple webhook is working. Your message was received."
```

### 2. Environment Debug Test (debug_webhook)

Shows all environment variables and tests module imports.

```bash
curl -X POST https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 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" \
  -d '{
    "assistant_id": "debug_webhook",
    "input": {
      "messages": [{
        "role": "human",
        "content": "{\"phone\": \"+13054870475\", \"message\": \"test debug\", \"contactId\": \"54sJIGTtwmR89Qc5JeEt\"}"
      }]
    },
    "stream_mode": "values"
  }'
```

**Expected Response**: JSON with:
- `environment`: Shows NODE_ENV and which API keys are set
- `imports`: Shows if GHL service and conversation manager load successfully
- `webhook`: Shows if payload was parsed correctly

### 3. Detailed Debug Test (webhook_debug_detailed)

Shows step-by-step execution to identify exactly where the webhook fails.

```bash
curl -X POST https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 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" \
  -d '{
    "assistant_id": "webhook_debug_detailed",
    "input": {
      "messages": [{
        "role": "human",
        "content": "{\"phone\": \"+13054870475\", \"message\": \"test\", \"contactId\": \"54sJIGTtwmR89Qc5JeEt\"}"
      }]
    },
    "stream_mode": "values"
  }'
```

**Expected Response**: Detailed log showing each step:
- Service initialization
- Webhook parsing
- Conversation fetch
- Exact error location if it fails

### 4. Production Webhook Test (webhook_handler)

The main webhook that should handle real messages (currently failing).

```bash
curl -X POST https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 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" \
  -d '{
    "assistant_id": "webhook_handler",
    "input": {
      "messages": [{
        "role": "human",
        "content": "{\"phone\": \"+13054870475\", \"message\": \"Hola, soy Carlos\", \"contactId\": \"54sJIGTtwmR89Qc5JeEt\"}"
      }]
    },
    "stream_mode": "values"
  }'
```

**Current Response**: Error message in Spanish
**Expected Response**: Bot should process and respond appropriately

## How to Parse Streaming Responses

The API returns streaming responses. To see just the important parts:

### Get Bot Response Only
```bash
curl ... | grep -A2 '"type":"ai"' | grep content
```

### Get Run ID for Tracing
```bash
curl ... | grep run_id | head -1
```

### Get Full Debug Info
```bash
curl ... -N -s 2>&1 | grep -A50 "DEBUG INFO"
```

## Testing Different Scenarios

### Test 1: Environment Check
```bash
# First test simple webhook
# Then test debug webhook
# Compare results to ensure env vars are set
```

### Test 2: Module Loading
```bash
# Run debug_webhook
# Check imports section shows "success" for both modules
```

### Test 3: Step-by-Step Debug
```bash
# Run webhook_debug_detailed
# Look for where it says "DEBUG FAILED at step X"
# Check the debug log to see last successful step
```

## Common Issues and Solutions

### Issue: 404 Not Found
- **Cause**: Wrong URL or webhook not deployed
- **Solution**: Check deployment URL and ensure latest code is deployed

### Issue: 403 Forbidden
- **Cause**: Invalid API key
- **Solution**: Use the correct X-API-Key header

### Issue: No Response
- **Cause**: Timeout or network issue
- **Solution**: Add `-m 30` to curl for 30 second timeout

### Issue: Can't Parse Response
- **Cause**: Streaming format
- **Solution**: Use grep/jq to filter response or save to file

## Local Testing

To test webhooks locally before deployment:

```bash
# 1. Set environment variables
export $(cat .env | xargs)

# 2. Run specific test
node test-webhook-minimal.js
node test-ghl-api-direct.js
node verify-whatsapp-sending.js
```

## Deployment Testing Workflow

1. **Deploy Code**
   ```bash
   git push origin main
   # Wait for deployment in LangGraph dashboard
   ```

2. **Test Basic Functionality**
   ```bash
   # Test simple_webhook first
   # Should return success message
   ```

3. **Check Environment**
   ```bash
   # Test debug_webhook
   # Verify all env vars show as true
   ```

4. **Debug Failures**
   ```bash
   # Test webhook_debug_detailed
   # Find exact failure point
   ```

5. **Verify Fix**
   ```bash
   # After fixing, test webhook_handler
   # Should process messages correctly
   ```

## Reading LangSmith Traces

1. Get the run_id from the response
2. Go to https://smith.langchain.com
3. Search for the run_id
4. Check for:
   - Error messages
   - Child runs (should see tool calls)
   - Duration (timeout issues)
   - Status (success/error)

## Team Debugging Checklist

- [ ] Test simple_webhook - Does basic functionality work?
- [ ] Test debug_webhook - Are all env vars set?
- [ ] Test webhook_debug_detailed - Where exactly does it fail?
- [ ] Check deployment logs - Any startup errors?
- [ ] Verify GHL credentials - Test with test-ghl-api-direct.js
- [ ] Check LangSmith traces - What's the error message?
- [ ] Test locally - Does it work on your machine?

## Contact for Help

If you're stuck:
1. Check PROGRESS_SUMMARY.md for what's been tried
2. Review ERROR_FIXES_SUMMARY.md for known fixes
3. Run the debug webhooks in order
4. Share the exact error output with the team