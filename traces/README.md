# Traces Directory

This directory stores LangSmith trace IDs and analysis for debugging.

## Important Traces

### Self-Conversation Issues
- `1f06b3bc-8e5a-6d3d-aa19-f423acb8dc3c` - Agent talking to itself
- `1f06b412-7aa4-6962-922c-65da2ce33823` - Context contamination with "Juan"

### No Response Issues  
- `1f06b149-1474-6632-a410-d17d5656da98` - Agent didn't respond to user

### Successful Flows
- Add successful trace IDs here for reference

## How to View Traces

1. Go to [LangSmith](https://smith.langchain.com)
2. Navigate to your project
3. Search for the trace ID
4. Or use the trace viewer script: `node traces/trace-viewer.js <trace-id>`

## Trace Analysis

Use the trace viewer to:
- Analyze tool calls
- Check message flow
- Debug state changes
- Identify bottlenecks