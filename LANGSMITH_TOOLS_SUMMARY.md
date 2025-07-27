# LangSmith Debugging Tools - Complete Summary

## 🛠️ Tools Created

### 1. **debug-trace-langsmith.js**
Complete trace analysis tool that:
- Fetches any LangSmith trace by ID
- Analyzes conversation flow
- Shows all tool calls with inputs/outputs
- Identifies missing field extractions
- Generates detailed reports
- Can compare production vs local traces

**Usage:**
```bash
node debug-trace-langsmith.js fetch <trace-id>
node debug-trace-langsmith.js compare <prod-id> <local-id>
```

### 2. **test-webhook-flow.js**
Webhook simulation and replay tool:
- Simulates production webhooks locally
- Replays production traces
- Runs comprehensive test suites
- Full LangSmith tracing enabled

**Usage:**
```bash
node test-webhook-flow.js test-single <phone> <message> <contactId>
node test-webhook-flow.js replay <trace-id>
node test-webhook-flow.js test-suite
```

### 3. **test-from-zero.js**
Complete conversation simulator:
- Starts conversations from scratch
- Simulates real user flow
- Tests problematic scenarios (like "all" response)
- Interactive mode for custom testing
- Shows real-time field extraction

**Usage:**
```bash
node test-from-zero.js complete    # Full conversation
node test-from-zero.js problematic  # Test edge cases
node test-from-zero.js custom       # Interactive mode
```

### 4. **test-salesagent-simple.js**
Direct sales agent tester:
- Tests agent without webhook overhead
- Multiple conversation scenarios
- Shows field extraction in real-time
- Debug specific issues

**Usage:**
```bash
node test-salesagent-simple.js
```

### 5. **test-single-message.js**
Minimal test for debugging:
- Single message processing
- Shows exact state and results
- Minimal overhead for quick debugging

## 📊 What We Learned from Testing

### Key Findings:
1. **Messages are being sent** - The agent responds correctly
2. **Field extraction works** - Tools are called and extract data
3. **State issue** - Lead info isn't being properly accumulated in the test script
4. **LangSmith traces created** - All conversations are traced

### Trace URLs Generated:
- Each test run creates traces viewable at: `https://smith.langchain.com/public/<trace-id>/r`
- Traces show full conversation flow, tool calls, and timing

## 🔍 How to Debug Production Issues

### Step 1: Analyze Production Trace
```bash
node debug-trace-langsmith.js fetch 1f06a7ac-ce88-6245-9ec9-821839cc6091
```

### Step 2: Replay Locally
```bash
node test-webhook-flow.js replay 1f06a7ac-ce88-6245-9ec9-821839cc6091
```

### Step 3: Test Specific Scenario
```bash
node test-from-zero.js problematic  # Tests "all" response
```

### Step 4: Compare Traces
```bash
node debug-trace-langsmith.js compare <prod-id> <local-id>
```

## 🚀 Environment Setup

### Required Variables:
```bash
OPENAI_API_KEY=your_key
GHL_API_KEY=your_key
GHL_LOCATION_ID=your_id
GHL_CALENDAR_ID=your_id
LANGSMITH_API_KEY=your_key
LANGSMITH_PROJECT=your_project
LANGSMITH_TRACING=true
```

### Quick Run Scripts:
- `run-test-simple.sh` - Runs tests with all env vars
- `check-trace.sh <trace-id>` - Quick trace analysis

## 📈 Benefits

1. **Complete Visibility**
   - See every message, tool call, and state change
   - Understand exact conversation flow
   - Identify where failures occur

2. **Local Reproduction**
   - Replay exact production scenarios
   - Test fixes before deploying
   - Verify behavior matches production

3. **Cost Analysis**
   - Token usage per conversation
   - Tool execution timing
   - Performance optimization opportunities

4. **Rapid Debugging**
   - Direct links to traces
   - Side-by-side comparison
   - Real-time field extraction viewing

## 🎯 Next Steps

1. **Fix the "all" response issue** - Agent should extract info when user says "all"
2. **Optimize token usage** - Current conversations cost ~$1.50 each
3. **Improve field extraction** - Make it more robust
4. **Add retry logic** - Handle API failures gracefully

## 📝 Documentation

- Main docs: `LANGSMITH_DEBUG_TOOLS.md`
- This summary: `LANGSMITH_TOOLS_SUMMARY.md`
- Test reports: Generated as `test-report.md`
- Trace analyses: Saved as `trace-analysis-*.txt/json`

These tools give you **complete control** over debugging and testing your sales agent with full LangSmith integration!