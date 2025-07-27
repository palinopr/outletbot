# LangSmith Trace Debugging Tools

## Overview

I've created a comprehensive suite of tools to debug production issues by leveraging LangSmith tracing. These tools allow you to:

1. **Fetch and analyze production traces**
2. **Replay production conversations locally**
3. **Compare production vs local behavior**
4. **Run test suites with full visibility**

## Tools Created

### 1. LangSmith Trace Debugger (`debug-trace-langsmith.js`)

A powerful tool to fetch and analyze production traces from LangSmith.

**Features:**
- Fetch any trace by ID
- Extract conversation flow
- Analyze tool calls and timing
- Identify missing field extractions
- Generate detailed reports

**Usage:**
```bash
# Fetch and analyze a single trace
node debug-trace-langsmith.js fetch 1f06a7ac-ce88-6245-9ec9-821839cc6091

# Compare production vs local traces
node debug-trace-langsmith.js compare <prod-trace-id> <local-trace-id>

# Save analysis to file
node debug-trace-langsmith.js fetch <trace-id> --output ./analysis.txt
```

**Output includes:**
- Complete conversation flow
- All tool calls with inputs/outputs
- Extracted fields summary
- Performance metrics
- Error details

### 2. Webhook Flow Tester (`test-webhook-flow.js`)

Simulates production webhook flow locally with full LangSmith tracing.

**Features:**
- Simulate single webhook requests
- Replay production traces locally
- Run comprehensive test suites
- Generate test reports

**Usage:**
```bash
# Test a single webhook
node test-webhook-flow.js test-single "+1234567890" "Hola, soy Juan" "contact-123"

# Replay a production trace
node test-webhook-flow.js replay 1f06a7ac-ce88-6245-9ec9-821839cc6091

# Run full test suite
node test-webhook-flow.js test-suite
```

**Test Suite includes:**
- Complete conversation with all fields
- Partial information scenarios
- Budget threshold testing
- Multi-message conversations

### 3. Sales Agent Direct Tester (`test-salesagent-simple.js`)

Direct testing of the sales agent without webhook overhead.

**Features:**
- Test specific conversation scenarios
- See real-time field extraction
- Debug "all" response issue
- Direct agent invocation

**Usage:**
```bash
# Run all test scenarios
node test-salesagent-simple.js
```

**Test Scenarios:**
1. All information in one message
2. Information spread across messages
3. Testing 'all' response behavior

## Environment Setup

### Required Environment Variables
```bash
# LangSmith Configuration
LANGSMITH_API_KEY=your_api_key
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_PROJECT=your_project_name
LANGSMITH_TRACING=true

# GHL Configuration
GHL_API_KEY=your_ghl_key
GHL_LOCATION_ID=your_location_id
GHL_CALENDAR_ID=your_calendar_id

# OpenAI
OPENAI_API_KEY=your_openai_key
```

### Enable Tracing
Make sure LangSmith tracing is enabled:
```bash
export LANGSMITH_TRACING=true
```

## Debugging the Production Issue

### The Problem
From trace `1f06a7ac-ce88-6245-9ec9-821839cc6091`:
- Customer said "all" 
- Agent didn't extract any fields
- Field extraction failed

### How to Debug

1. **Fetch the production trace:**
```bash
node debug-trace-langsmith.js fetch 1f06a7ac-ce88-6245-9ec9-821839cc6091
```

2. **Replay it locally:**
```bash
node test-webhook-flow.js replay 1f06a7ac-ce88-6245-9ec9-821839cc6091
```

3. **Compare traces:**
```bash
node debug-trace-langsmith.js compare <prod-id> <local-id>
```

4. **Test the specific scenario:**
```bash
node test-salesagent-simple.js
# This includes a test for the "all" response
```

## Key Insights from Tools

### What to Look For

1. **In Trace Analysis:**
   - How many times was `extractLeadInfo` called?
   - What were the inputs to the tool?
   - What fields were extracted?
   - Any errors in tool execution?

2. **In Local Testing:**
   - Does the same input produce different results?
   - Are tools being called in the same order?
   - Is the state being managed correctly?

3. **Common Issues:**
   - Tool not recognizing "all" as containing information
   - State not being propagated between tool calls
   - Circuit breaker or rate limiting issues

## Production vs Local Differences

The tools will help identify:
- **Token usage differences**
- **Tool execution order changes**
- **State management issues**
- **Field extraction discrepancies**

## Next Steps

1. **Run the trace debugger** on the problematic trace
2. **Replay locally** to see if issue reproduces
3. **Compare behaviors** to identify root cause
4. **Fix and test** using the test suite
5. **Verify fix** by comparing new local trace with production

## LangSmith Dashboard

View all traces at: https://smith.langchain.com

Filter by:
- Project name
- Tags (local-test, production-replay, etc.)
- Time range
- Error status

## Cost Analysis

The trace debugger shows token usage, helping you understand:
- Cost per conversation
- Which tools use most tokens
- Optimization opportunities

## Troubleshooting

### If traces aren't appearing:
1. Check `LANGSMITH_TRACING=true`
2. Verify API key is correct
3. Check project name matches
4. Look for network/firewall issues

### If replay doesn't match production:
1. Check environment variables match exactly
2. Verify same model versions
3. Check for time-based logic
4. Look for external API differences

## Summary

These tools provide complete visibility into:
- **What happened** (trace analysis)
- **Why it happened** (field extraction details)
- **How to fix it** (local reproduction)
- **Verification** (before/after comparison)

Use them to:
1. Debug production issues
2. Test fixes locally
3. Validate deployments
4. Monitor performance