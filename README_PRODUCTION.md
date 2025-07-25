# Production Deployment Guide - GHL Conversation Integration

## Overview

This guide covers the enhanced production setup that uses GoHighLevel (GHL) as the single source of truth for conversation history, eliminating the need for local storage in production.

## Key Improvements

### 1. GHL-Based Conversation Management
- **Conversation History**: Fetched directly from GHL API
- **Message Synchronization**: All messages stored in GHL conversations
- **Contact State**: Pulled from GHL contact records and tags
- **No Data Loss**: Conversations persist across server restarts

### 2. Production Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Meta Ads   │────▶│     GHL     │────▶│  Your Bot   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                     │
                           ▼                     ▼
                    ┌─────────────┐       ┌─────────────┐
                    │ GHL Storage │       │Redis Cache  │
                    │ (Primary)   │       │ (Optional)  │
                    └─────────────┘       └─────────────┘
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file with these variables:

```env
# Required
OPENAI_API_KEY=your_openai_key
GHL_API_KEY=your_ghl_api_key
GHL_LOCATION_ID=your_location_id
GHL_CALENDAR_ID=your_calendar_id

# Production Settings
NODE_ENV=production
PORT=3000
WEBHOOK_SECRET=your_webhook_secret

# Optional Redis (for caching)
REDIS_URL=redis://user:pass@host:6379

# Security
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_MAX=100

# Monitoring
LANGSMITH_API_KEY=your_langsmith_key
LANGSMITH_PROJECT=outlet-media-bot-prod
LANGCHAIN_TRACING_V2=true
```

### 3. Test GHL Integration

Before deploying, test the GHL integration:

```bash
node test-ghl-integration.js
```

This will verify:
- GHL API connectivity
- Contact creation/retrieval
- Conversation management
- Message history fetching
- Calendar integration

### 4. Local Production Test

Run the production server locally:

```bash
npm run start:prod
```

Test with:
```bash
node test-local.js "Test message"
```

## Deployment Options

### Option 1: Heroku

```bash
# Create app
heroku create your-app-name

# Add Redis (optional)
heroku addons:create heroku-redis:hobby-dev

# Set environment variables
heroku config:set OPENAI_API_KEY=xxx
heroku config:set GHL_API_KEY=xxx
# ... set all variables

# Deploy
git push heroku main
```

### Option 2: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up

# Add environment variables in Railway dashboard
```

### Option 3: Docker

```bash
# Build
docker build -t outlet-media-bot .

# Run with env file
docker run -d \
  --env-file .env \
  -p 3000:3000 \
  --name outlet-media-bot \
  outlet-media-bot
```

### Option 4: PM2 on VPS

```bash
# Install PM2
npm install -g pm2

# Start with ecosystem file
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

## Production Features

### 1. Conversation State Management

The bot now uses `ConversationManager` or `RedisConversationManager`:

```javascript
// In-memory cache (default)
const conversationManager = new ConversationManager(ghlService);

// Redis cache (production)
const conversationManager = new RedisConversationManager(ghlService, REDIS_URL);
```

### 2. GHL Message Synchronization

All messages are:
- Stored in GHL conversations
- Retrieved on each webhook call
- Cached for 5-15 minutes for performance

### 3. Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin protection
- **Rate Limiting**: Prevent abuse
- **Webhook Verification**: Validate GHL signatures

### 4. Health Monitoring

```bash
# Check health
curl https://your-app.com/health

# Response:
{
  "status": "ok",
  "version": "3.0.0",
  "ghl": "connected",
  "redis": "connected",
  "uptime": 3600
}
```

### 5. Performance Optimizations

- **Message Caching**: 5-minute TTL
- **Async GHL Updates**: Non-blocking tag/note updates
- **Connection Pooling**: Reuse API connections
- **Graceful Shutdown**: Clean resource cleanup

## GHL Configuration

### 1. Webhook Setup

In GHL, configure webhook:
- URL: `https://your-domain.com/webhook/meta-lead`
- Events: SMS Inbound, Conversation Message

### 2. Required GHL Permissions

Ensure your API key has access to:
- Contacts (read/write)
- Conversations (read/write)
- Calendar (read/write)
- SMS (send)
- Tags (write)
- Notes (write)

### 3. Custom Fields (Optional)

Create these custom fields in GHL for better tracking:
- `lead_budget` (number)
- `lead_problem` (text)
- `lead_goal` (text)
- `qualification_status` (dropdown)

## Monitoring

### 1. LangSmith Integration

View conversation traces:
- URL: https://smith.langchain.com
- Project: Your configured project name

### 2. Logs

```bash
# PM2 logs
pm2 logs outlet-media-bot

# Docker logs
docker logs outlet-media-bot

# Heroku logs
heroku logs --tail
```

### 3. Metrics Endpoint

```bash
curl https://your-app.com/metrics
```

## Troubleshooting

### Issue: Messages not syncing
- Check GHL API permissions
- Verify conversation ID is being passed
- Check Redis connection (if using)

### Issue: Slow response times
- Enable Redis caching
- Check GHL API rate limits
- Monitor LangSmith traces

### Issue: Lost conversation context
- Ensure GHL conversation exists
- Check message history limit (default: 100)
- Verify contact tags are being saved

## Scaling Considerations

### For High Volume (>10k messages/day):

1. **Enable Redis**: Reduces GHL API calls
2. **Increase Cache TTL**: Balance freshness vs performance
3. **Use PM2 Cluster**: Multiple worker processes
4. **Add CDN**: CloudFlare for DDoS protection
5. **Database Backup**: Store critical data separately

### Cost Optimization:

1. **Cache aggressively**: Reduce API calls
2. **Batch GHL updates**: Group tag/note operations
3. **Use webhooks**: Avoid polling
4. **Monitor usage**: Track API limits

## Migration from v2 to v3

If upgrading from the local storage version:

1. **No data migration needed**: GHL already has all conversation history
2. **Update webhook handler**: Use new `index.production.js`
3. **Add Redis (optional)**: For better performance
4. **Test thoroughly**: Use `test-ghl-integration.js`

## Support

For issues or questions:
- Check GHL API documentation
- Review LangSmith traces
- Monitor application logs
- Test with `test-ghl-integration.js`