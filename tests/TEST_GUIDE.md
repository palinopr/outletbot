# Testing Guide for Outlet Media Bot

This guide explains how to test and debug the complete webhook flow from receiving a webhook to delivering messages via GHL.

## Test Files Overview

### 1. **test-full-flow.js** - Complete End-to-End Test
The main test file that covers the entire flow:
- Webhook validation
- Conversation state management
- Complete conversation sequence
- GHL integration

### 2. **debug-helper.js** - Debug Utilities
Helper functions for detailed logging:
- Colored console output
- Step-by-step execution tracking
- Performance timing
- State inspection

### 3. **test-fixtures.js** - Test Data
Predefined test scenarios and data:
- Contact profiles (new, returning, qualified, etc.)
- Conversation scenarios
- Calendar slots
- Validation test cases

## Running Tests

### Prerequisites

1. **Environment Variables**
```bash
# Required
GHL_API_KEY=your_key
GHL_LOCATION_ID=your_location_id
GHL_CALENDAR_ID=your_calendar_id
OPENAI_API_KEY=your_openai_key

# Optional for enhanced debugging
LANGCHAIN_API_KEY=your_langsmith_key
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT="Outlet Media Bot Testing"

# Test specific
TEST_CONTACT_ID=8eSdb9ZDsXDem9wlED9u  # Or your test contact
TEST_PHONE=+12146669779  # Your test phone number
```

2. **Test Contact Setup**
- Ensure you have a test contact in GHL
- Contact should have WhatsApp enabled
- Clear conversation history for clean tests

### Running Different Tests

#### 1. Full Flow Test
```bash
node tests/test-full-flow.js
```

This runs the complete end-to-end test including:
- Webhook validation
- 7-step conversation flow
- Calendar booking
- GHL message delivery

#### 2. Component Tests
```bash
node tests/test-components.js
```

Tests individual components:
- GHL API connection
- Calendar availability
- Individual tools
- LLM integration

#### 3. Specific Conversation Test
```bash
node tests/test-conversation-logic.js
```

Tests conversation logic without real API calls.

#### 4. Real Webhook Test
```bash
node tests/test-webhook-handler.js
```

Tests the webhook handler with real payloads.

### Debug Options

#### Enable Detailed Logging
```bash
DEBUG=true node tests/test-full-flow.js
```

#### Enable LangSmith Tracing
```bash
LANGCHAIN_TRACING_V2=true node tests/test-full-flow.js
```

#### Monitor Live Conversation
```javascript
import { monitorConversation } from './debug-helper.js';
import ConversationManager from '../services/conversationManager.js';

// Monitor a conversation in real-time
await monitorConversation(conversationManager, 'contact-id', 5000);
```

## Understanding Test Output

### Success Indicators
- ✅ Green checkmarks for passed tests
- Tool execution logs showing correct sequence
- Response validation passing
- GHL message delivery confirmation

### Common Issues and Solutions

#### 1. "Missing required fields" Error
**Cause**: Webhook payload is incomplete
**Solution**: Ensure all required fields (phone, message, contactId) are provided

#### 2. "Cannot fetch slots - missing required information"
**Cause**: Lead not fully qualified before calendar request
**Solution**: Ensure all qualification fields are collected (name, problem, goal, budget, email)

#### 3. "Message send failed"
**Cause**: GHL API issues or invalid contact
**Solution**: 
- Verify GHL API key is valid
- Check contact exists in GHL
- Ensure WhatsApp is enabled for contact

#### 4. "Conversation timeout exceeded"
**Cause**: Agent taking too long to process
**Solution**:
- Check for infinite loops in tool execution
- Verify LLM is responding
- Increase timeout in config

## Debugging Flow Issues

### 1. Enable Stream Logging
```javascript
const stream = await graph.stream(input, {
  streamMode: 'updates',
  recursionLimit: 30
});

for await (const chunk of stream) {
  console.log('Update:', chunk);
}
```

### 2. Inspect Graph State
```javascript
const state = await graph.getState(config);
console.log('Next nodes:', state.next);
console.log('Tasks:', state.tasks);
console.log('Values:', state.values);
```

### 3. Tool Execution Tracking
```javascript
// In your test
if (chunk.webhook_handler?.messages) {
  const lastMsg = chunk.webhook_handler.messages.slice(-1)[0];
  if (lastMsg.tool_calls) {
    console.log('Tools called:', lastMsg.tool_calls.map(tc => tc.name));
  }
}
```

### 4. LangSmith Tracing
When enabled, visit https://smith.langchain.com to see:
- Complete execution trace
- Tool inputs/outputs
- LLM prompts and responses
- Performance metrics

## Test Scenarios

### 1. Happy Path
- New lead provides all information
- Budget qualifies (>$300)
- Books appointment successfully

### 2. Budget Rejection
- Lead provides information
- Budget under $300
- Polite rejection with nurture tag

### 3. Returning Customer
- Existing lead information
- Skips already known fields
- Continues from last state

### 4. Edge Cases
- Mixed languages
- Typos and misspellings
- Multiple info in one message
- Change of mind scenarios

## Performance Benchmarks

Expected timings for a complete flow:
- Webhook validation: <100ms
- Conversation fetch: <500ms (first call), <50ms (cached)
- Tool execution: <1s per tool
- Complete flow: <10s total

## Troubleshooting

### Check Service Health
```javascript
// Test GHL connection
const ghlService = new GHLService(apiKey, locationId);
const testContact = await ghlService.getContact(contactId);

// Test calendar
const slots = await ghlService.getAvailableSlots(calendarId);

// Test messaging
await ghlService.sendSMS(contactId, "Test message");
```

### Verify Webhook Format
```javascript
// Expected webhook format
{
  phone: "+1234567890",
  message: "user message",
  contactId: "ghl-contact-id",
  conversationId: "optional-convo-id"
}
```

### Debug State Management
```javascript
import { debugWebhookExecution } from './tests/debug-helper.js';

// Run with detailed debugging
const finalState = await debugWebhookExecution(graph, input, config);
```

## Best Practices

1. **Clean Test Data**: Clear conversation history between test runs
2. **Use Test Contacts**: Don't test with real customer data
3. **Monitor Rate Limits**: Be aware of API rate limits
4. **Check Logs**: Always check both application and GHL logs
5. **Incremental Testing**: Test components individually before full flow

## Next Steps

After successful testing:
1. Deploy to production
2. Set up monitoring alerts
3. Configure error tracking
4. Implement A/B testing for responses
5. Set up analytics dashboard