# Production Cache Fix

## Issue
The production deployment is using the `sales_agent` graph directly, bypassing the `webhook_handler` that contains the caching logic.

## Current Flow (BROKEN)
```
WhatsApp → LangGraph → sales_agent → AI processing (NO CACHE)
```

## Expected Flow (FIXED)
```
WhatsApp → LangGraph → webhook_handler → Check Cache → sales_agent (if needed)
```

## Solution

### Option 1: Update LangGraph Deployment (RECOMMENDED)
In the LangGraph Cloud deployment settings, change the graph from `sales_agent` to `webhook_handler`:

```bash
# Current (WRONG)
graph: sales_agent

# Fixed (CORRECT)  
graph: webhook_handler
```

### Option 2: Add Cache to Sales Agent
Move the cache logic into the sales agent itself:

```javascript
// In salesAgent.js, before processing
const cachedResponse = getCachedResponse(message, { leadInfo });
if (cachedResponse) {
  return { messages: [new AIMessage(cachedResponse)], cached: true };
}
```

## Verification
After deployment, test with "hola" and verify:
1. LangSmith shows "CACHED RESPONSE" 
2. No extract_lead_info tool call
3. Processing time < 500ms
4. Cost = $0.00