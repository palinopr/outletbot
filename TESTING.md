# Testing Guide - Outlet Media Bot

This guide explains how to test the bot, where all test files are located, and what environment variables are needed.

## 📁 Test File Locations

### Main Test Suite - `/tests/`
```
tests/
├── test-components.js         # Main component test suite (89% pass rate)
├── test-webhook.js           # Webhook endpoint testing
├── test-full-flow.js         # Complete conversation flow test
├── test-conversation-flow.js # Step-by-step conversation test
├── test-7-step-flow.js       # Full 7-step qualification flow
├── test-returning-customer.js # Test returning customer scenarios
├── test-post-appointment.js  # Post-appointment behavior
├── test-context-preservation.js # Context maintenance tests
├── test-conversation-logic.js # Conversation state logic
├── test-conversation-notes.js # GHL notes integration
├── test-custom-field-update.js # Custom field updates
├── test-real-webhook-flow.js # Real webhook simulation
├── test-webhook-validation.js # Webhook payload validation
├── test-fixtures.js          # Test data and fixtures
├── test-setup.js             # Test configuration
├── README.md                 # Test documentation
├── TEST_GUIDE.md            # Detailed testing guide
├── TEST_RESULTS_100_PERCENT.json # Latest test results
├── test-components-results.json  # Component test output
├── run-comprehensive-test.sh    # Run all tests script
├── run-whatsapp-test.sh        # WhatsApp integration test
├── test-langgraph-dev.sh       # LangGraph dev environment test
├── test-live-deployment.sh     # Live deployment test
└── test-live-webhook-curl.sh   # Webhook curl commands
```

### Debug Tools - `/tests/debug/`
```
tests/debug/
├── analyze-agent-performance.js # Agent performance analysis
├── debug-duplicate-messages.js  # Duplicate message debugging
├── debug-tool-calls.js         # Tool call debugging
└── debug-helper.js             # Debug utilities
```

### Trace Analysis - `/traces/`
```
traces/
├── tools/
│   ├── trace-viewer.js         # View specific traces
│   ├── debug-trace.js          # Debug trace issues
│   ├── trace-analysis-summary.js # Analyze trace summaries
│   └── check-trace.sh          # Quick trace checks
└── analysis/                   # Saved trace analyses
```

## 🔑 Environment Variables Required

Create a `.env` file in the root directory with:

```bash
# OpenAI API Key (Required)
OPENAI_API_KEY=sk-...

# GoHighLevel API Keys (Required)
GHL_API_KEY=your-ghl-api-key
GHL_LOCATION_ID=your-location-id
GHL_CALENDAR_ID=your-calendar-id

# LangSmith (Optional - for tracing)
LANGSMITH_API_KEY=your-langsmith-key
LANGSMITH_PROJECT=outlet-media-bot

# Environment (Optional)
NODE_ENV=development
LOG_LEVEL=info

# Feature Flags (Optional)
SKIP_ENV_VALIDATION=true  # For testing without all env vars
```

## 🧪 How to Run Tests

### 1. Run Main Test Suite
```bash
# Run all component tests (recommended)
npm test
# or
node tests/test-components.js

# Expected output: 89% success rate (8/9 tests passing)
```

### 2. Test Specific Flows

**Test Full Conversation Flow:**
```bash
node tests/test-full-flow.js
```

**Test Webhook Integration:**
```bash
node tests/test-webhook.js
```

**Test 7-Step Qualification:**
```bash
node tests/test-7-step-flow.js
```

**Test with Real GHL Contact:**
```bash
node tests/test-real-webhook-flow.js
```

### 3. Debug Issues

**Debug Tool Calls:**
```bash
node tests/debug/debug-tool-calls.js
```

**Analyze Performance:**
```bash
node tests/debug/analyze-agent-performance.js
```

**Debug Duplicate Messages:**
```bash
node tests/debug/debug-duplicate-messages.js
```

### 4. Trace Analysis

**View Specific Trace:**
```bash
node traces/tools/trace-viewer.js <trace-id>
# Example:
node traces/tools/trace-viewer.js 1f06b3bc-8e5a-6d3d-aa19-f423acb8dc3c
```

**Debug Trace Issues:**
```bash
node traces/tools/debug-trace.js <trace-id>
```

### 5. Run Test Scripts

**Run Comprehensive Test Suite:**
```bash
cd tests && ./run-comprehensive-test.sh
```

**Test WhatsApp Integration:**
```bash
cd tests && ./run-whatsapp-test.sh
```

**Test LangGraph Development:**
```bash
cd tests && ./test-langgraph-dev.sh
```

**Test Live Deployment:**
```bash
cd tests && ./test-live-deployment.sh
```

**Test Webhook with cURL:**
```bash
cd tests && ./test-live-webhook-curl.sh
```

## 🧮 Test Scenarios Covered

### 1. **Basic Greeting**
- User says "Hola"
- Bot introduces itself as María
- Asks for user's name

### 2. **Complete Qualification Flow**
1. Greeting → Ask name
2. Get name → Ask problem
3. Get problem → Ask goal
4. Get goal → Ask budget
5. Budget ≥ $300 → Ask email
6. Get email → Show calendar
7. Select time → Book appointment

### 3. **Budget Scenarios**
- Under budget (<$300) → Polite decline + nurture tag
- Qualified (≥$300) → Continue to email/calendar
- "Sí" confirmation → Extracts budget from context

### 4. **Returning Customer**
- Has existing data in GHL
- Bot recognizes and doesn't repeat questions
- Continues from where left off

### 5. **Edge Cases**
- Multiple rapid messages
- Invalid inputs
- Missing required fields
- Timeout handling
- Error recovery

## 📊 Test Results Format

Tests output detailed results showing:
- ✅ Passed tests with descriptions
- ❌ Failed tests with error details  
- 📊 Performance metrics (API calls, duration)
- 🔍 Tool call analysis
- 💬 Message flow visualization

## 🐛 Common Test Issues

### 1. **Environment Variables**
```bash
# If you see: "Missing required environment variables"
# Make sure .env file exists and contains all required keys

# To skip validation during testing:
SKIP_ENV_VALIDATION=true node tests/test-components.js
```

### 2. **GHL API Errors**
```bash
# If you see: "GHL API request failed"
# Check:
- GHL_API_KEY is valid
- GHL_LOCATION_ID is correct
- API quota not exceeded
```

### 3. **OpenAI Errors**
```bash
# If you see: "OpenAI API error"
# Check:
- OPENAI_API_KEY is valid
- Not hitting rate limits
- Model name is correct (gpt-4)
```

## 🔧 Development Testing

When developing new features:

1. **Unit Test Individual Tools:**
```javascript
// Test a specific tool
const result = await extractLeadInfo.invoke({
  message: "Mi nombre es Juan"
});
```

2. **Test State Management:**
```javascript
// Test state updates
const state = {
  messages: [new HumanMessage("Hola")],
  leadInfo: {},
  contactId: "test-123"
};
const result = await salesAgent.invoke(state);
```

3. **Test Error Handling:**
```javascript
// Test with invalid data
try {
  await ghlService.sendSMS(null, "Test");
} catch (error) {
  console.log("Error handled:", error.message);
}
```

## 📈 Performance Benchmarks

Expected performance metrics:
- Response time: < 3 seconds
- Tool calls per message: 2-5
- Cost per conversation: ~$0.05-0.10
- Memory usage: < 200MB
- Concurrent users: 100+

## 🚀 Production Testing

Before deploying:
1. Run full test suite: `npm test`
2. Test with real GHL account
3. Verify webhook endpoint
4. Check error handling
5. Monitor trace logs

## 📝 Adding New Tests

To add a new test:

1. Create file in `/tests/`
2. Import required modules:
```javascript
import { salesAgent } from '../agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
```

3. Write test function:
```javascript
async function testNewFeature() {
  console.log('Testing new feature...');
  // Test implementation
}
```

4. Run with: `node tests/test-new-feature.js`

## 🔗 Useful Links

- [LangSmith Traces](https://smith.langchain.com) - View execution traces
- [GoHighLevel API Docs](https://highlevel.stoplight.io/docs/integrations)
- [LangGraph Docs](https://langchain-ai.github.io/langgraphjs/)
- [Project Repository](https://github.com/palinopr/outletbot)