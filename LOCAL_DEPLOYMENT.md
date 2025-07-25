# Local Deployment with LangSmith Tracing

## Prerequisites
- Node.js installed
- ngrok account (free tier works)
- LangSmith account

## Step 1: Set Up Environment

1. Create `.env` file:
```bash
# Copy from .env.example
cp .env.example .env
```

2. Add your keys to `.env`:
```
OPENAI_API_KEY=your_key_here
GHL_API_KEY=your_ghl_token_here
GHL_LOCATION_ID=your_location_id
GHL_CALENDAR_ID=your_calendar_id

# LangSmith - IMPORTANT for tracing
LANGSMITH_API_KEY=your_langsmith_key
LANGSMITH_PROJECT=outlet-media-bot-local
LANGCHAIN_TRACING_V2=true
```

## Step 2: Start Local Server

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev
```

Your bot runs on `http://localhost:3000`

## Step 3: Expose with ngrok

```bash
# Install ngrok
brew install ngrok  # Mac
# or download from https://ngrok.com

# Expose your local server
ngrok http 3000
```

You'll get a public URL like:
```
https://abc123.ngrok.io
```

## Step 4: Configure GHL Webhook

In GHL, set webhook URL to:
```
https://abc123.ngrok.io/webhook/meta-lead
```

## Step 5: Monitor in LangSmith

1. Go to [smith.langchain.com](https://smith.langchain.com)
2. Find your project: `outlet-media-bot-local`
3. Watch traces in real-time!

### What You'll See in LangSmith:

- **Each conversation** as a trace
- **Agent decisions** step by step
- **LLM calls** with prompts/responses
- **State changes** throughout conversation
- **Tokens used** per interaction
- **Latency** for each step

## Step 6: Test Your Bot

### Option A: Send test webhook
```bash
curl -X POST http://localhost:3000/webhook/meta-lead \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+15551234567",
    "message": "Hi, I saw your ad",
    "contactId": "test-contact-123",
    "conversationId": "test-conv-123"
  }'
```

### Option B: Use test script (see test-local.js)

## Debugging with LangSmith

1. **View Full Trace**:
   - Click on any run in LangSmith
   - See entire conversation flow
   - Inspect each node execution

2. **Debug Errors**:
   - Red traces show failures
   - Click to see exact error
   - View state at failure point

3. **Optimize Prompts**:
   - See all prompts sent to LLM
   - Check token usage
   - Test prompt variations

## Local Development Tips

1. **Hot Reload**: Using nodemon, changes auto-restart
2. **Console Logs**: Check terminal for detailed logs
3. **ngrok Inspector**: Visit `http://localhost:4040` to inspect requests
4. **Health Check**: Visit `http://localhost:3000/health`

## Common Issues

### ngrok URL changes
- Free ngrok gives new URL each restart
- Update GHL webhook each time
- Or get paid ngrok for stable URL

### LangSmith not showing traces
- Verify `LANGCHAIN_TRACING_V2=true`
- Check API key is correct
- Ensure project name matches

### GHL webhook fails
- Check ngrok is running
- Verify JSON payload format
- Check server logs for errors