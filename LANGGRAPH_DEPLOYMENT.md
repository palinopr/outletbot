# LangGraph Platform Deployment Guide

## Overview

This guide explains how to deploy the Outlet Media Bot on LangGraph Platform with one-click deployment.

## Prerequisites

1. LangGraph Platform account
2. Environment variables ready:
   - OpenAI API key
   - GHL API key and credentials
   - LangSmith API key

## Deployment Steps

### 1. Prepare Your Repository

Ensure your repository has these files:
- ✅ `langgraph.config.js` - Platform configuration
- ✅ `api/langgraph-api.js` - API handlers
- ✅ `agents/salesAgent.js` - Core agent logic
- ✅ All service files

### 2. Connect to LangGraph Platform

1. Go to [LangGraph Platform](https://platform.langgraph.com)
2. Click "New Deployment"
3. Connect your GitHub repository
4. Select the `outlet-media-bot` repository

### 3. Configure Environment Variables

In the LangGraph Platform dashboard, add:

```env
OPENAI_API_KEY=sk-proj-...
GHL_API_KEY=pit-...
GHL_LOCATION_ID=sHFG9Rw6BdGh6d6bfMqG
GHL_CALENDAR_ID=eIHCWiTQjE1lTzjdz4xi
LANGSMITH_API_KEY=lsv2_pt_...
LANGSMITH_PROJECT=outlet-media-bot
LANGCHAIN_TRACING_V2=true
```

### 4. Deploy

1. Click "Deploy"
2. LangGraph will:
   - Build your application
   - Set up the API endpoints
   - Configure auto-scaling
   - Enable monitoring

### 5. Get Your Webhook URL

After deployment, you'll get a URL like:
```
https://your-app.langgraph.app/webhook/meta-lead
```

### 6. Configure GHL Webhook

In GoHighLevel:
1. Go to Settings → Webhooks
2. Add new webhook:
   - URL: `https://your-app.langgraph.app/webhook/meta-lead`
   - Events: SMS Inbound, Conversation Message
   - Save

## Features on LangGraph Platform

### Auto-Scaling
- Automatically scales based on load
- Handles traffic spikes
- Zero downtime deployments

### Built-in Monitoring
- Request logs
- Performance metrics
- Error tracking
- LangSmith integration

### API Management
- Rate limiting
- Authentication (if needed)
- CORS handling
- SSL/TLS included

## Testing Your Deployment

### 1. Health Check
```bash
curl https://your-app.langgraph.app/health
```

### 2. Test Webhook
```bash
curl -X POST https://your-app.langgraph.app/webhook/meta-lead \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "message": "Hi, I saw your ad",
    "contactId": "test-contact-123",
    "conversationId": "test-conv-123"
  }'
```

### 3. Monitor in LangSmith
- Go to https://smith.langchain.com
- Select your project: `outlet-media-bot`
- Watch real-time traces

## Deployment Configuration

The `langgraph.config.js` file controls:

- **Graph Definition**: Points to your sales agent
- **API Routes**: Webhook and health endpoints
- **Dependencies**: Required npm packages
- **Environment**: Required variables
- **Deployment Settings**: Memory, timeout, scaling

## Troubleshooting

### Webhook Not Receiving
- Check GHL webhook configuration
- Verify URL is correct
- Test with curl command

### Agent Not Responding
- Check environment variables
- View logs in LangGraph dashboard
- Check LangSmith traces

### Performance Issues
- Increase memory in config
- Check scaling settings
- Enable caching (Redis)

## Advanced Configuration

### Enable Redis Caching
Add to environment:
```env
REDIS_URL=redis://...
```

Update `langgraph-api.js`:
```javascript
const RedisConversationManager = require('../services/redisConversationManager');
conversationManager = new RedisConversationManager(ghlService, process.env.REDIS_URL);
```

### Custom Domain
1. In LangGraph dashboard → Settings
2. Add custom domain
3. Update DNS records
4. Update GHL webhook URL

## Support

- LangGraph Platform docs: https://docs.langgraph.com
- LangSmith traces: https://smith.langchain.com
- Your deployment logs: LangGraph dashboard