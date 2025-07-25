# Outlet Media Bot - Sales Agent

## Overview
This is a LangGraph-based sales agent that qualifies leads from Meta ads through GHL webhooks. It conducts natural conversations to gather information and books appointments for qualified leads.

## Current Architecture

### Core Components

1. **Sales Agent** (`agents/salesAgent.js`)
   - LangGraph workflow with state management
   - Conversational AI that qualifies leads
   - Collects: name, problem, goal, budget
   - Books appointments for $300+/month budgets

2. **GHL Service** (`services/ghlService.js`)
   - API integration with GoHighLevel
   - Endpoints: contacts, calendar, appointments, SMS
   - Base URL: https://services.leadconnectorhq.com

3. **Express Server** (`index.js`)
   - Webhook endpoint: `/webhook/meta-lead`
   - Health check: `/health`
   - Port: 4000 (configurable)

### Conversation Flow

1. **Greeting** → Ask for name
2. **Discovery** → Ask about problem/pain point
3. **Goal Setting** → Ask about desired outcome
4. **Budget Qualification** → Ask about monthly budget
5. **If $300+** → Ask for email → Show calendar slots
6. **If <$300** → Politely decline, tag as "nurture-lead"
7. **Appointment Booking** → Confirm and create in GHL

### State Management

Currently stores conversations in memory:
```javascript
const activeConversations = new Map();
```

Each conversation maintains:
- All messages history
- Lead information (name, problem, goal, budget, email)
- Available calendar slots
- Appointment status
- GHL tags and notes

### GHL Integration

#### What's Implemented:
- ✅ Contact creation/update
- ✅ Tag management
- ✅ Note creation
- ✅ Calendar slot fetching (real-time)
- ✅ Appointment booking
- ✅ SMS sending

#### API Endpoints Used:
- `GET /calendars/{id}/appointments/slots` - Get available times
- `POST /calendars/events/appointments` - Book appointment
- `POST /conversations/messages` - Send SMS
- `PUT /contacts/{id}` - Update contact
- `POST /contacts/{id}/tags` - Add tags
- `POST /contacts/{id}/notes` - Add notes

### Webhook Format

Expected payload from GHL:
```json
{
  "phone": "+15551234567",
  "message": "Customer message",
  "contactId": "ghl-contact-id",
  "conversationId": "conversation-id"
}
```

### Tags Applied
- `qualified-lead` - Budget $300+
- `budget-300-plus` - High-value lead
- `under-budget` - Budget <$300
- `nurture-lead` - Needs follow-up
- `appointment-scheduled` - Booking confirmed
- `needs-marketing` / `needs-sales` - Based on problem

### LangSmith Integration

**Primary Deployment Platform**: LangSmith

1. **Automatic Tracing**
   - Every conversation tracked
   - Agent decision tree visible
   - LLM token usage monitored
   - Performance bottlenecks identified

2. **Debug Features**
   - Step-by-step conversation flow
   - State changes at each node
   - Error tracking with context
   - Response time analysis

3. **Configuration**
   ```javascript
   // Enabled in langsmith-config.js
   LANGCHAIN_TRACING_V2=true
   LANGSMITH_PROJECT=outlet-media-bot
   LANGSMITH_API_KEY=your_key
   ```

4. **Monitoring**
   - Real-time conversation monitoring
   - Success/failure rates
   - Budget qualification metrics
   - Appointment booking analytics

## Limitations of Current Setup

1. **Memory Storage**
   - Conversations lost on restart
   - No persistence between deployments
   - 1-hour automatic cleanup

2. **Single Instance**
   - Can't scale horizontally
   - No load balancing support

3. **No Conversation History from GHL**
   - Currently doesn't fetch previous messages
   - Starts fresh each session

## Production Implementation (v3.0)

### ✅ Completed Improvements

1. **GHL-Based Conversation Management**
   - `ConversationManager`: Fetches conversation history from GHL
   - `RedisConversationManager`: Production-ready with Redis caching
   - No local storage needed - GHL is the source of truth
   - Conversation history retrieved on each webhook call

2. **Enhanced Security**
   - Helmet.js for security headers
   - CORS protection with configurable origins
   - Rate limiting (configurable per endpoint)
   - Webhook signature verification ready

3. **Production Features**
   - Health check endpoint with detailed status
   - Metrics endpoint for monitoring
   - Graceful shutdown handling
   - Environment-based configuration
   - Winston logging ready

4. **Performance Optimizations**
   - 5-minute conversation cache (configurable)
   - Async GHL updates (non-blocking)
   - Connection pooling for API calls
   - Batch operations support

### Production Files

**LangGraph Platform Deployment**:
- `langgraph.config.js`: Platform configuration with auto-scaling
- `api/langgraph-api.js`: Webhook handlers optimized for serverless
- `LANGGRAPH_DEPLOYMENT.md`: Step-by-step deployment guide

**Traditional Deployment**:
- `index.production.js`: Production server with security features
- `services/conversationManager.js`: GHL-based conversation management
- `services/redisConversationManager.js`: Redis-cached version for scale
- `test-ghl-integration.js`: Integration test suite
- `README_PRODUCTION.md`: Traditional deployment guide

### New GHL Service Methods

```javascript
// Get conversation messages
getConversationMessages(conversationId)

// Get conversation details
getConversation(conversationId)

// Get contact's conversations
getContactConversations(contactId)

// Get or create conversation
getOrCreateConversation(contactId)
```

## Environment Variables

```env
# Required
OPENAI_API_KEY=
GHL_API_KEY=
GHL_LOCATION_ID=
GHL_CALENDAR_ID=

# Optional
LANGSMITH_API_KEY=
LANGSMITH_PROJECT=
PORT=4000
```

## Testing

1. **Local Testing**: `node test-local.js`
2. **Single Message**: `node test-local.js "Your message"`
3. **Full Conversation**: Simulates qualified/unqualified scenarios

## Deployment

### LangGraph Platform (Primary Deployment)

This bot is configured for one-click deployment on LangGraph Platform:

1. **Platform Configuration**
   ```javascript
   // langgraph.config.js
   - Graph definitions
   - API routes
   - Auto-scaling settings
   - Environment variables
   ```

2. **Deployment Files**
   - `langgraph.config.js` - Platform configuration
   - `api/langgraph-api.js` - Webhook handlers
   - `LANGGRAPH_DEPLOYMENT.md` - Deployment guide

3. **Platform Features**
   - Auto-scaling (1-10 instances)
   - Built-in monitoring
   - SSL/HTTPS included
   - Zero-downtime deployments
   - Automatic health checks

4. **Webhook URL**
   ```
   https://your-app.langgraph.app/webhook/meta-lead
   ```

### LangSmith Integration

Full tracing and monitoring enabled:

1. **Configuration**
   ```env
   LANGSMITH_API_KEY=your_key
   LANGSMITH_PROJECT=outlet-media-bot
   LANGCHAIN_TRACING_V2=true
   ```

2. **Monitoring Features**
   - Real-time conversation traces
   - Agent decision visualization
   - Performance metrics
   - Error tracking
   - Token usage analytics

3. **Dashboard Access**
   - URL: https://smith.langchain.com
   - Project: outlet-media-bot

### Other Deployment Options

- **Local**: ngrok for webhook testing
- **Cloud**: Heroku, Railway, Render
- **Container**: Docker & Docker Compose
- **VPS**: PM2 process management

### Production Requirements

- Environment variables configured
- GHL webhook URL updated
- LangSmith API key set
- Redis URL (optional for caching)