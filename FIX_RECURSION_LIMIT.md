# Fix for Recursion Limit Issue

## Problem Analysis

From trace `1f06a7ac-ce88-6245-9ec9-821839cc6091`, the agent hit a recursion limit because:

1. User asked "Q horas tienes?" (What times do you have?)
2. Agent had partial lead info (only name "Jaime")
3. System prompt requires ALL fields before mentioning calendar
4. Agent got stuck trying to extract missing fields from a message that doesn't contain them

## Root Cause

The `extractLeadInfo` tool is being called repeatedly without making progress:
- No extraction attempt limits
- No tracking of which messages have been processed
- No escape condition when extraction fails

## Solution

Add the following safeguards:

### 1. Extraction Attempt Limits
```javascript
// In extractLeadInfo tool
const extractionCount = currentState.extractionCount || 0;
const MAX_EXTRACTION_ATTEMPTS = 3;

if (extractionCount >= MAX_EXTRACTION_ATTEMPTS) {
  return new Command({
    update: {
      messages: [{
        role: "tool",
        content: "Reached max extraction attempts. Proceeding with available info.",
        tool_call_id: toolCallId
      }]
    }
  });
}
```

### 2. Message Processing Tracking
```javascript
// Track which messages have been processed
const processedMessages = currentState.processedMessages || [];
const messageHash = crypto.createHash('md5').update(message).digest('hex');

if (processedMessages.includes(messageHash)) {
  return new Command({
    update: {
      messages: [{
        role: "tool",
        content: "Message already processed. No new info to extract.",
        tool_call_id: toolCallId
      }]
    }
  });
}
```

### 3. Smarter System Prompt
Update the prompt to handle scheduling questions better:

```javascript
const SALES_AGENT_PROMPT = `...
SCHEDULING QUESTIONS:
- If asked about times/scheduling before qualified:
  "Claro! Pero primero necesito conocer un poco más sobre tu negocio para asegurarme de que podemos ayudarte."
- Don't get stuck trying to extract info that isn't there
- After 3 extraction attempts, continue the conversation naturally
...`;
```

### 4. Add Termination Conditions
In the agent state:
```javascript
const AgentStateAnnotation = Annotation.Root({
  // ... existing fields ...
  extractionCount: Annotation({
    reducer: (x, y) => y,
    default: () => 0
  }),
  processedMessages: Annotation({
    reducer: (x, y) => [...new Set([...x, ...y])],
    default: () => []
  }),
  maxExtractionReached: Annotation({
    reducer: (x, y) => y,
    default: () => false
  })
});
```

## Implementation Steps

1. Update `extractLeadInfo` tool to respect extraction limits
2. Add message hash tracking to prevent reprocessing
3. Update system prompt to handle scheduling questions gracefully
4. Add state fields for tracking extraction attempts
5. Test with the exact scenario from the trace

## Expected Outcome

- Agent will try to extract info up to 3 times
- After hitting the limit, it will respond naturally instead of looping
- Scheduling questions will be deflected appropriately
- No more recursion limit errors