# Fix: Webhook JSON Parsing Issue

## Problem Identified
In trace `1f06b149-1474-6632-a410-d17d5656da98`, the webhook handler received:
```
HumanMessage content: {"phone": "(305) 487-0475", "message": "Hola", "contactId": "ym8G7K6GSzm8dJDZ6BNo"}
```

Instead of properly parsing this JSON and extracting just "Hola" as the message.

## Root Cause
The LangGraph Platform is passing the entire webhook payload as a HumanMessage content string to the webhook handler, rather than parsing it first.

## Current Behavior (WRONG)
1. API receives webhook: `{"phone": "...", "message": "Hola", "contactId": "..."}`
2. Creates HumanMessage with content = entire JSON string
3. Webhook handler tries to parse JSON from message content
4. No tools are called because the agent sees JSON instead of "Hola"

## Expected Behavior (CORRECT)
1. API receives webhook
2. Parses JSON and extracts fields
3. Creates proper state with contactId, phone, and message
4. Passes just "Hola" as the message content

## Solution

### Option 1: Fix in API Layer (Recommended)
Create/update the API handler to properly parse webhooks:

```javascript
// api/webhook-handler.js or similar
export async function handleWebhook(request) {
  const payload = await request.json();
  
  // Extract fields properly
  const { phone, message, contactId, conversationId } = payload;
  
  // Create proper initial state
  const initialState = {
    messages: [new HumanMessage(message)], // Just the message text
    contactId,
    phone,
    conversationId
  };
  
  // Invoke the webhook handler graph
  const result = await graph.invoke(initialState);
  
  return new Response(JSON.stringify({
    success: true,
    // Don't return the actual response here
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Option 2: Fix in Webhook Handler
Update the webhook handler to handle both cases:

```javascript
// In webhookHandlerNode function
const lastMessage = state.messages[state.messages.length - 1];

// Check if this is the initial webhook message
if (state.messages.length === 1 && typeof lastMessage.content === 'string') {
  try {
    // Try to parse as JSON webhook payload
    const parsed = JSON.parse(lastMessage.content);
    if (parsed.message && parsed.contactId) {
      // This is a webhook payload, extract the actual message
      const { message, contactId, phone } = parsed;
      
      // Update state with extracted values
      state.contactId = contactId;
      state.phone = phone;
      
      // Replace the JSON message with the actual message
      state.messages = [new HumanMessage(message)];
      
      logger.info('Extracted message from webhook payload', {
        originalContent: lastMessage.content.substring(0, 100),
        extractedMessage: message,
        contactId
      });
    }
  } catch (e) {
    // Not JSON, continue normally
  }
}
```

### Option 3: Update LangGraph Deployment Config
Check if the LangGraph platform has a way to configure webhook parsing:

```json
// langgraph.json
{
  "graphs": {
    "webhook_handler": {
      "path": "./agents/webhookHandler.js:graph",
      "webhook": {
        "parseJson": true,
        "messageField": "message",
        "stateMapping": {
          "contactId": "contactId",
          "phone": "phone",
          "message": "messages[0]"
        }
      }
    }
  }
}
```

## Testing the Fix

1. Deploy the fix
2. Send a test webhook:
```bash
curl -X POST https://your-deployment/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "(305) 487-0475",
    "message": "Hola",
    "contactId": "test-contact-id"
  }'
```

3. Verify in LangSmith trace:
   - Messages should show just "Hola" not the JSON
   - Tools should be called (extract_lead_info, send_ghl_message)
   - Customer should receive a response

## Impact
This fix will ensure:
- Webhooks are properly parsed
- Messages contain actual text, not JSON
- Tools are called correctly
- Customers receive responses
- The 100% success rate is maintained in production