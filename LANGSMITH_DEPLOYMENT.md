# LangSmith/LangGraph Platform Deployment Guide

## Overview
This bot is ready for deployment on LangSmith/LangGraph Platform with modern `createReactAgent` pattern.

## Architecture Summary

### Modern Implementation ✅
- **Pattern**: `createReactAgent` with 6 Zod-validated tools
- **Message Delivery**: Via `send_ghl_message` tool (NOT webhook responses)
- **Qualification**: Strict validation - ALL fields required before showing calendar
- **State Management**: Type-safe with proper annotations

### Key Files
```
agents/modernSalesAgent.js       # Main agent with tools
api/modernLanggraphApi.js       # Webhook handler
langgraph.json                  # Platform configuration
langgraph.config.js            # Extended configuration
```

## Pre-Deployment Checklist

### 1. Environment Variables
Set these in LangGraph Platform dashboard:
```env
OPENAI_API_KEY=sk-...
GHL_API_KEY=your-ghl-api-key
GHL_LOCATION_ID=your-location-id
GHL_CALENDAR_ID=your-calendar-id
LANGSMITH_API_KEY=your-langsmith-key
LANGSMITH_PROJECT=outlet-media-bot
LANGCHAIN_TRACING_V2=true
```

### 2. Verify Local Setup
```bash
# Install dependencies
npm install

# Run verification
node verify-deployment.js

# Test the modern agent
node test-modern-agent.js
```

## Deployment Steps

### Option 1: LangGraph CLI

1. **Install LangGraph CLI**
```bash
npm install -g @langchain/langgraph-cli
```

2. **Login to LangSmith**
```bash
langgraph auth login
```

3. **Deploy**
```bash
# From project root
langgraph deploy --name outlet-media-bot

# Or with specific config
langgraph deploy --config ./langgraph.json --name outlet-media-bot
```

4. **Get Deployment URL**
```bash
langgraph deployments list
```

Your webhook URL will be:
```
https://[deployment-id].langgraph.app/webhook/meta-lead
```

### Option 2: GitHub Integration

1. **Push to GitHub**
```bash
git add .
git commit -m "Deploy modern createReactAgent implementation"
git push origin main
```

2. **Connect in LangSmith**
- Go to LangSmith Dashboard
- Click "New Deployment"
- Select "GitHub Integration"
- Choose your repository
- Select branch: `main`
- Config file: `langgraph.json`

3. **Auto-Deploy Settings**
- Enable auto-deploy on push
- Set environment variables
- Configure scaling (1-10 instances)

## Post-Deployment

### 1. Update GHL Webhook
In GoHighLevel:
```
Webhook URL: https://[deployment-id].langgraph.app/webhook/meta-lead
Method: POST
Headers: Content-Type: application/json
```

### 2. Monitor in LangSmith
- View traces: https://smith.langchain.com
- Check project: `outlet-media-bot`
- Monitor:
  - Conversation flows
  - Tool usage (especially `send_ghl_message`)
  - Qualification rates
  - Appointment bookings

### 3. Test Webhook
```bash
curl -X POST https://[deployment-id].langgraph.app/webhook/meta-lead \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "message": "Hi, I need help with marketing",
    "contactId": "test-contact-123",
    "conversationId": "test-convo-123"
  }'
```

### 4. Health Check
```bash
curl https://[deployment-id].langgraph.app/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "2.0.0",
  "platform": "langgraph",
  "pattern": "createReactAgent"
}
```

## Key Implementation Details

### 1. Message Flow
```
GHL Webhook → LangGraph Platform → Agent → send_ghl_message tool → GHL SMS API
```
**NOT**: Webhook → Response → GHL ❌

### 2. Qualification Logic
```javascript
// Calendar tool validates ALL fields:
if (!leadInfo.name || !leadInfo.problem || !leadInfo.goal || !leadInfo.budget || !leadInfo.email) {
  return { error: "Missing required information" };
}
if (leadInfo.budget < 300) {
  return { error: "Budget under $300/month" };
}
```

### 3. Tool Order
1. `sendGHLMessage` - FIRST, for all messages
2. `extractLeadInfo` - After each customer message
3. `getCalendarSlots` - ONLY after full qualification
4. `bookAppointment` - When slot selected
5. `updateGHLContact` - For tags/notes
6. `parseTimeSelection` - For time parsing

## Troubleshooting

### Issue: Messages not sending
- Check: Is agent using `send_ghl_message` tool?
- Verify: GHL API credentials
- Monitor: Tool execution in LangSmith traces

### Issue: Calendar shown too early
- Check: `getCalendarSlots` tool validation
- Verify: ALL fields collected first
- Monitor: State at tool invocation

### Issue: Deployment fails
- Check: Node.js version (must be 20+)
- Verify: All dependencies in package.json
- Check: langgraph.json syntax

## Scaling Configuration

In `langgraph.config.js`:
```javascript
instances: {
  min: 1,      // Minimum instances
  max: 10      // Maximum instances
}
```

Platform auto-scales based on:
- Request volume
- Response time
- Error rate

## Success Metrics

Monitor in LangSmith:
- **Qualification Rate**: Leads with all info collected
- **Conversion Rate**: Qualified leads ($300+)
- **Booking Rate**: Appointments scheduled
- **Response Time**: < 2s per interaction
- **Error Rate**: < 1%

## Support

- LangSmith Dashboard: https://smith.langchain.com
- LangGraph Docs: https://langchain-ai.github.io/langgraphjs/
- Support: support@langchain.com