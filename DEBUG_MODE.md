# Debug Mode Configuration for Outlet Media Bot

## Overview
Comprehensive logging has been added throughout the webhook flow to track message processing at each step. This helps debug issues like "messages not being received" by providing detailed visibility into the entire flow.

## Environment Variables for Debug Mode

Add these to your `.env` file to enable debug mode:

```env
# Enable debug logging
LOG_LEVEL=debug

# Enable LangSmith tracing for detailed flow analysis
LANGCHAIN_TRACING_V2=true
LANGSMITH_API_KEY=your-langsmith-key
LANGSMITH_PROJECT=outlet-media-bot-debug
```

## Logging Emojis Reference

The system uses emoji prefixes to make logs easier to scan:

- 🔍 - Search/lookup operations
- ✅ - Successful operations
- ❌ - Failed operations
- 🔄 - In-progress operations
- 📦 - Data preparation
- 📤 - Outgoing messages
- 📊 - State/statistics
- 🤖 - Agent operations
- 🔁 - Duplicate detection
- ⚠️ - Warnings
- 🧹 - Cleanup operations
- 📌 - Markers/flags

## Key Log Points

### 1. Webhook Handler (`agents/webhookHandler.js`)
- **WEBHOOK HANDLER START** - Initial state and trace ID
- **Webhook data extracted** - Shows parsed message data
- **WEBHOOK VALIDATION PASSED** - All required fields present
- **FETCHING CONVERSATION STATE** - GHL conversation lookup
- **CONVERSATION STATE FETCHED** - Lead info and message history
- **PREPARING AGENT INVOCATION** - Message preparation
- **INVOKING SALES AGENT** - Agent call with context
- **AGENT RESPONSE RECEIVED** - Processing results
- **WEBHOOK PROCESSED SUCCESSFULLY** - Final status

### 2. Conversation Manager (`services/conversationManager.js`)
- **GET CONVERSATION STATE START** - Initial request
- **CACHE HIT/MISS** - Cache status
- **FETCHING CONVERSATION FROM GHL** - API call
- **MESSAGES FETCHED FROM GHL** - Message count and types
- **MESSAGE WINDOWING NEEDED** - When summarization occurs
- **LEAD INFO EXTRACTED** - Qualification status
- **CONVERSATION STATE COMPLETE** - Final state

### 3. Sales Agent (`agents/salesAgent.js`)
- **SALES AGENT INVOKED** - Initial invocation
- **EXTRACT LEAD INFO START** - Information extraction
- **LEAD INFO EXTRACTED** - Extracted fields
- **SEND GHL MESSAGE START** - Outgoing message
- **MESSAGE SENT SUCCESSFULLY** - Delivery confirmation
- **AGENT CONVERSATION COMPLETED** - Final results

## Debug Workflow

### 1. Enable Debug Mode
```bash
export LOG_LEVEL=debug
export LANGCHAIN_TRACING_V2=true
```

### 2. Monitor Logs in Real-Time
```bash
# Local development
node test-local.js 2>&1 | grep -E "🔍|✅|❌|🔄|📦|📤|🤖"

# Production logs (if using PM2)
pm2 logs outlet-bot --lines 100 | grep -E "TRACE|ERROR|START|COMPLETE"
```

### 3. Trace Analysis
With LangSmith enabled, each conversation gets a trace ID. Use this to:
1. View the complete flow in LangSmith UI
2. See tool calls and responses
3. Identify where messages might be getting lost

### 4. Common Debug Scenarios

#### Scenario: "Messages not being received"
Look for these log patterns:
```
🔍 WEBHOOK HANDLER START - Check if webhook is triggered
📋 Webhook data extracted - Verify message content
🔄 FETCHING CONVERSATION STATE - Check if history is fetched
📦 PREPARING AGENT INVOCATION - Verify message array
🤖 INVOKING SALES AGENT - Check if agent is called
📤 SEND GHL MESSAGE START - Verify outgoing message
```

#### Scenario: "Agent not responding"
Check for:
```
❌ CONVERSATION FETCH FAILED - GHL API issues
⚠️ MAX EXTRACTION ATTEMPTS REACHED - Tool loop issues
❌ AGENT ERROR - Processing errors
```

#### Scenario: "Duplicate messages"
Monitor:
```
🔁 DUPLICATE MESSAGE DETECTED - Deduplication working
📌 Message marked as processed - Cache updates
```

## Performance Monitoring

The logs include timing information:
- `processingTime` - Individual operation times
- `totalTime` - End-to-end processing time
- `fetchTime` - API call durations

Use these to identify bottlenecks:
```bash
# Find slow operations
grep -E "Time|duration|processingTime" logs.txt | sort -k2 -n
```

## Troubleshooting Tips

1. **Missing Trace ID**: If you see `traceId: 'no-trace-id'`, the webhook handler isn't passing the run ID properly.

2. **Empty Message Arrays**: Check `messageCount: 0` logs to see where messages might be getting lost.

3. **State Issues**: Look for `hasLeadInfo: false` when you expect lead data to exist.

4. **API Failures**: Search for `❌` emoji to quickly find all errors.

5. **Tool Loops**: Monitor `extractionCount` to ensure tools aren't looping indefinitely.

## Production Considerations

For production, consider:
- Setting `LOG_LEVEL=info` to reduce log volume
- Using log aggregation services (Datadog, CloudWatch)
- Setting up alerts for `❌ ERROR` patterns
- Monitoring processing times for performance degradation

## Example Debug Session

```bash
# 1. Set trace ID from user report
export TRACE_ID="1f06a310-3a38-6d11-aa54-86c4ef864f6a"

# 2. Search logs for this trace
grep "$TRACE_ID" /var/log/outlet-bot.log > trace-debug.log

# 3. Analyze the flow
grep -E "START|COMPLETE|ERROR" trace-debug.log

# 4. Check timing
grep -E "Time|duration" trace-debug.log | awk '{print $NF}' | sort -n

# 5. View in LangSmith
echo "https://smith.langchain.com/public/$TRACE_ID/r"
```

This comprehensive logging system ensures you can track every message through the entire system and quickly identify where issues occur.