# Deployment Trigger

This file is updated to trigger new deployments when needed.

## Last Update
- Date: $(date)
- Reason: Force new deployment with detailed debug webhook
- Commit: Includes webhook_debug_detailed for production debugging

## Current Debug Tools Available
1. `simple_webhook` - Tests basic functionality
2. `debug_webhook` - Shows environment and imports
3. `webhook_debug_detailed` - Step-by-step execution logging

## Next Steps
After deployment, test with:
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
    }
  }'
```Trigger deployment 1753557252
