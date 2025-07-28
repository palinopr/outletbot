# Production Testing Guide with LangSmith Traces

## Overview
This guide provides step-by-step instructions to test the production fixes and view LangSmith traces to verify:
1. ✅ State persistence (bot remembers information)
2. ✅ Thread continuity (consistent thread_id)
3. ✅ Response caching (cached "hola" responses)

## Changes Summary

### 1. API Handler (`api/langgraph-api.js`)
**Fix**: Thread continuity using conversationId
```javascript
// BEFORE: Each message created new thread
thread_id: contactId

// AFTER: Consistent thread across conversation
const threadId = conversationId || `thread_${contactId}`;
```

### 2. Webhook Handler (`agents/webhookHandler.js`)
**Fixes**: 
- Thread-aware message cache
- State merging for leadInfo
- Cache check after message extraction

```javascript
// NEW: Thread-aware cache
class ThreadAwareMessageCache {
  getKey(threadId, messageHash) {
    return `${threadId}:${messageHash}`;
  }
}

// FIXED: Merge existing lead info
const currentLeadInfo = {
  name: state.leadInfo?.name || conversationState.leadName,
  problem: state.leadInfo?.problem || conversationState.leadProblem,
  // ... etc
};
```

### 3. Sales Agent (`agents/salesAgent.js`)
**Fixes**:
- getCurrentTaskInput helper for state access
- State passing through __pregel_scratchpad

```javascript
// NEW: Helper to find state in various config paths
function getCurrentTaskInput(config) {
  const paths = [
    config?.configurable?.__pregel_scratchpad?.currentTaskInput,
    config?.configurable?.currentTaskInput,
    config?.currentTaskInput,
    config?.state,
    config
  ];
  // ... find and return state
}
```

## Testing Steps

### 1. Deploy to LangGraph Cloud
```bash
# Push changes
git add -A
git commit -m "fix: Enable state persistence and thread continuity"
git push origin main

# Deploy will auto-trigger
```

### 2. Test Scenarios

#### Scenario A: Cache Test (Verify "hola" uses cache)
```
User: hola
Expected: 
- Instant response (< 500ms)
- NO AI tokens used
- Trace shows "CACHED RESPONSE" in logs
- Cost: $0.00
```

#### Scenario B: State Persistence Test
```
User: hola
Bot: ¡Hola! Soy María... ¿Cómo te llamas?
User: Jaime
Bot: [Should remember name and ask about problem]
User: necesito mas clientes
Bot: [Should remember name + problem, ask about goal]
```

#### Scenario C: Calendar Flow Test
```
Complete qualification:
- Name: Jaime
- Problem: necesito mas clientes  
- Goal: crecer mi negocio
- Budget: 500
- Email: test@example.com

Expected: Calendar slots shown with all info retained
```

### 3. LangSmith Trace Analysis

#### Access Traces
1. Go to: https://smith.langchain.com/
2. Find your project/organization
3. Look for traces with these indicators

#### Key Trace Points to Verify

**A. Thread Continuity**
Look for in trace metadata:
```json
{
  "configurable": {
    "thread_id": "conv_ABC123", // Should be SAME across messages
    "__pregel_thread_id": "conv_ABC123"
  }
}
```

**B. Cache Hit**
Search logs for:
```
💨 PRODUCTION CACHE HIT - Greeting
savedTokens: 3822
```

**C. State Persistence**
In tool calls, verify state access:
```
📋 MERGED LEAD INFO
currentLeadInfo: {
  "name": "Jaime",
  "problem": "necesito mas clientes",
  "goal": "crecer mi negocio",
  "budget": "500",
  "email": "test@example.com"
}
```

### 4. Cost Verification

Check trace costs:
- Cached "hola": Should be $0.00 (no tokens)
- Full conversation: Should be < $0.20 (was $5.16)

### 5. Production Monitoring Commands

```bash
# View live logs
langgraph logs outletbot

# Check deployment status
langgraph status outletbot

# View recent traces
curl https://api.smith.langchain.com/runs \
  -H "x-api-key: $LANGSMITH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

### 6. Debug Checklist

✅ **Thread ID Consistency**
- [ ] Same thread_id across all messages in conversation
- [ ] Thread_id format: `conv_XXX` or `thread_contactId`

✅ **Cache Working**
- [ ] "hola" responses < 500ms
- [ ] Log shows "CACHED RESPONSE"
- [ ] No OpenAI API calls for greetings

✅ **State Persistence**
- [ ] Bot remembers name after collection
- [ ] Bot remembers all fields when showing calendar
- [ ] No repeated questions

✅ **Cost Reduction**
- [ ] Simple messages cost $0.00-$0.01
- [ ] Full conversations < $0.20
- [ ] No 29 tool call loops

## Trace Examples

### Good Trace (Fixed)
```
Thread: conv_ABC123
1. Human: hola → Cache hit → $0.00
2. Human: Jaime → Extract + Remember → $0.02
3. Human: necesito clientes → Extract + Update → $0.02
4. [Bot shows calendar with ALL info retained]
Total: ~$0.10
```

### Bad Trace (Before Fix)
```
Thread changes each message:
1. Thread: contact_XYZ → "hola" → $0.05 (no cache)
2. Thread: contact_XYZ_2 → "Jaime" → Forgets context → $0.05
3. Thread: contact_XYZ_3 → Asks name again → $0.05
Total: $5.16 (29 tool calls)
```

## Common Issues & Solutions

1. **Still asking repeated questions**
   - Check: Thread ID changing between messages
   - Fix: Ensure conversationId passed in webhook

2. **Cache not working**
   - Check: Message extraction before cache check
   - Fix: Verify getCachedResponse called with plain text

3. **Calendar shows "missing info"**
   - Check: getCurrentTaskInput finding state
   - Fix: Verify __pregel_scratchpad path

## Success Metrics

- 🎯 Cache hit rate > 90% for greetings
- 💰 Cost per conversation < $0.20
- 🧠 Zero repeated questions
- ⚡ Response time < 2s (cached < 500ms)
- 🔄 Consistent thread_id throughout conversation

## Report Issues

If traces show problems:
1. Copy trace ID
2. Note the issue pattern
3. Check logs for error messages
4. Share in deployment channel

## Next Steps

After verification:
1. Monitor for 24 hours
2. Check cost dashboard
3. Review user satisfaction
4. Scale if metrics are good