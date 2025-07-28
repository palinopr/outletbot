# Traces Directory

This directory contains all trace-related files for debugging LangSmith traces.

## Directory Structure

```
traces/
├── analysis/          # Saved trace analysis JSON and TXT files
│   ├── trace-analysis-*.json
│   └── trace-analysis-*.txt
├── tools/            # Trace analysis tools
│   ├── trace-viewer.js      # Interactive trace viewer
│   ├── trace-logger.js      # Automatic trace logging
│   ├── debug-trace.js       # Trace debugging utility
│   ├── trace-analysis-summary.js  # Trace summary generator
│   └── check-trace.sh       # Shell script for quick checks
└── README.md         # This file
```

## Important Traces

### Self-Conversation Issues
- `1f06b3bc-8e5a-6d3d-aa19-f423acb8dc3c` - Agent talking to itself
- `1f06b412-7aa4-6962-922c-65da2ce33823` - Context contamination with "Juan"

### No Response Issues  
- `1f06b149-1474-6632-a410-d17d5656da98` - Agent didn't respond to user

### Analyzed Traces
- `1f06a7ac-*` - See analysis/trace-analysis-1f06a7ac.json
- `476e7968-*` - See analysis/trace-analysis-476e7968.json
- `65487836-*` - See analysis/trace-analysis-65487836.json
- `7a047d34-*` - See analysis/trace-analysis-7a047d34.json
- `b93aef7a-*` - See analysis/trace-analysis-b93aef7a.json

## How to Use

### View a Trace
```bash
node traces/tools/trace-viewer.js <trace-id>
node traces/tools/trace-viewer.js selfConversation
```

### Debug a Trace
```bash
node traces/tools/debug-trace.js <trace-id>
```

### Analyze Trace Summary
```bash
node traces/tools/trace-analysis-summary.js
```

### Quick Shell Check
```bash
./traces/tools/check-trace.sh <trace-id>
```

## Trace Analysis Tips

1. **Message Flow**: Check how many messages were processed
2. **Tool Calls**: Look for excessive or failed tool calls
3. **State Changes**: Verify leadInfo updates
4. **Timing**: Check for timeouts or slow operations
5. **Errors**: Look for exceptions or error messages

## Common Issues

- **Self-Conversation**: Agent responds to its own messages
- **Context Contamination**: Data from other users appears
- **Infinite Loops**: Excessive extraction attempts
- **No Response**: Tool calls succeed but no message sent
- **State Loss**: Information not persisted between calls