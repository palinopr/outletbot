# LangGraph Studio Thread Debug Guide
## Thread ID: 448a3b07-a0ba-4f1a-9e6f-757dd81dccfb

## Common Issues to Check in Your Thread

### 1. Module Resolution Errors
Look for errors like:
```
Cannot find module '/deps/outletbot/production-fixes.js'
```
**Fix**: These happen because LangGraph Cloud uses different paths. Check if the thread shows module not found errors.

### 2. Recursion Limit Errors
Look for:
```
Recursion limit of 50 reached
```
**Fix**: We already fixed this by changing tool_choice from "required" to "auto"

### 3. Phone Undefined Errors
Look for:
```
Cannot read properties of undefined (reading 'phone')
```
**Fix**: We added null checks in conversationManager.js

### 4. Tool Call Loops
Check if the agent is calling tools repeatedly:
- `extract_lead_info` called 10+ times
- `send_ghl_message` called multiple times with same content

### 5. State Management Issues
Look for:
- Missing lead information
- Conversation not progressing
- Agent asking same questions repeatedly

## How to Debug Your Thread

### Step 1: Open Thread Details
1. Go to LangGraph Studio
2. Navigate to your thread: `448a3b07-a0ba-4f1a-9e6f-757dd81dccfb`
3. Look at the execution trace

### Step 2: Check for These Patterns

#### A. Infinite Tool Loops
```
→ extract_lead_info
→ extract_lead_info
→ extract_lead_info
... (repeating)
```
**Cause**: tool_choice: "required" forcing tool calls

#### B. Missing State Updates
```
leadInfo: {}
extrationCount: 0
```
**Cause**: State not properly propagating between tools

#### C. Conversation Termination Issues
```
appointmentBooked: true
→ Still sending messages
```
**Cause**: Missing termination conditions

### Step 3: Check Specific Errors

1. **Look at the Error Tab**
   - Module not found errors?
   - Timeout errors?
   - API failures?

2. **Check State Progression**
   - Is leadInfo building up?
   - Is extractionCount incrementing?
   - Are processedMessages being tracked?

3. **Review Tool Calls**
   - Count how many times each tool is called
   - Check if tools are returning proper Command objects
   - Verify tool parameters are correct

## What to Share With Me

To help debug your specific thread, please share:

1. **Error Messages**
   ```
   Copy any red error text from the thread
   ```

2. **Tool Call Sequence**
   ```
   List which tools were called and how many times
   ```

3. **Final State**
   ```
   What does the state look like at the end?
   ```

4. **Conversation Flow**
   ```
   Did it get stuck at a specific step?
   ```

## Quick Fixes Based on Common Issues

### If Stuck in Tool Loop:
```javascript
// Check agents/salesAgent.js
// Ensure tool_choice is "auto" not "required"
const modelWithTools = llm.bindTools(tools, {
  tool_choice: "auto"
});
```

### If Missing Lead Info:
```javascript
// Check if extractionCount is hitting limit
if (extractionCount >= 3) {
  // Should stop extracting
}
```

### If Not Terminating:
```javascript
// Check conditional edges
if (state.appointmentBooked) {
  return END;
}
```

## Production vs Studio Differences

| Aspect | LangGraph Studio | Production |
|--------|-----------------|------------|
| Module Paths | Local paths work | Needs /deps/outletbot/ |
| Environment | Your machine | Containerized |
| Debugging | Full visibility | Limited logs |
| State | In-memory | Persistent |
| Performance | Instant | Cold starts |

## Next Steps

1. **Copy Error Details**: Get the exact error from your thread
2. **Check Tool Sequence**: Count tool calls
3. **Review State**: See what's in the final state
4. **Share Findings**: Post what you find so I can help

## Debug Commands to Run

```bash
# Check if your fixes are applied
grep -n "tool_choice" agents/salesAgent.js

# Verify recursion limit
grep -n "recursionLimit" agents/salesAgent.js

# Check for phone handling
grep -n "phone" services/conversationManager.js
```

Share what you see in the thread and I'll help pinpoint the exact issue!