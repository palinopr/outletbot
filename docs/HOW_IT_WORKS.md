# How the Outlet Media Bot Works

## Overview
This is a LangGraph-based sales agent that qualifies leads from Meta ads through WhatsApp conversations. It's deployed on LangGraph Platform and integrates with GoHighLevel (GHL) for messaging and appointment booking.

## Architecture Flow

```
1. WhatsApp Message → 2. GHL Webhook → 3. LangGraph Platform → 4. Sales Agent → 5. Response via GHL
```

## Detailed Process

### 1. Webhook Reception (`webhookHandler.js`)
When a message arrives:

```javascript
// Webhook receives payload
{
  "phone": "+13054870475",
  "message": "Hola, necesito ayuda",
  "contactId": "54sJIGTtwmR89Qc5JeEt"
}
```

The handler:
1. Validates the payload
2. Initializes GHL services (with 10s timeout in production)
3. Fetches conversation history from GHL
4. Invokes the sales agent

### 2. Sales Agent Processing (`salesAgent.js`)
The agent uses 6 AI-powered tools:

```javascript
1. extractLeadInfo    // Extracts: name, problem, goal, budget, email
2. sendGHLMessage     // Sends WhatsApp responses
3. updateGHLContact   // Updates CRM with tags/notes
4. getCalendarSlots   // Fetches available appointments
5. parseTimeSelection // Understands time choices
6. bookAppointment    // Books the meeting
```

### 3. Conversation Flow

```
Customer: "Hola"
Bot: Extracts info → Sends greeting → Updates CRM

Customer: "Soy Carlos, tengo un restaurante"
Bot: Extracts name + business → Asks about problem → Tags "restaurant"

Customer: "Necesito más clientes"
Bot: Extracts problem → Asks about goal → Tags "needs-marketing"

Customer: "Quiero llenar el restaurante"
Bot: Extracts goal → Asks about budget

Customer: "Puedo invertir $500 al mes"
Bot: Extracts budget → Asks for email → Tags "qualified-lead"

Customer: "carlos@restaurant.com"
Bot: Extracts email → Shows calendar slots → Updates all info in GHL

Customer: "El martes a las 3pm"
Bot: Parses selection → Books appointment → Tags "appointment-scheduled"
```

### 4. State Management
The agent maintains conversation state:

```javascript
{
  messages: [...],        // Full conversation history
  leadInfo: {            // Extracted information
    name: "Carlos",
    businessType: "restaurant",
    problem: "need more clients",
    goal: "fill restaurant",
    budget: 500,
    email: "carlos@restaurant.com"
  },
  appointmentBooked: false,
  contactId: "54sJIGTtwmR89Qc5JeEt"
}
```

### 5. Tool Execution Pattern
Each tool returns a Command object:

```javascript
return new Command({
  update: {
    leadInfo: updatedInfo,      // State updates
    messages: [toolResponse]    // Tool messages
  },
  goto: "END"  // Optional: terminate after booking
});
```

### 6. Message Sending
All messages go through GHL's WhatsApp API:

```javascript
sendGHLMessage tool → GHL API → WhatsApp → Customer's Phone
```

## Key Features

### Qualification Logic
- **Budget < $300**: Politely decline, tag as "nurture-lead"
- **Budget ≥ $300**: Continue to appointment booking
- **All fields required**: Must have name, problem, goal, budget, email before showing calendar

### Error Handling
- **Circuit Breaker**: Prevents cascade failures (5 failures = 30s cooldown)
- **Timeouts**: Different for dev (3s) vs production (10s)
- **Graceful Degradation**: User-friendly error messages in Spanish

### Performance Optimizations
- **Message Deduplication**: Prevents processing same message twice
- **Calendar Caching**: 30-minute cache for appointment slots
- **Token Efficiency**: Only last 10 messages sent to LLM
- **Extraction Limit**: Max 3 attempts to extract info per conversation

## Deployment Configuration

### Environment Variables Required
```
GHL_API_KEY=pit-xxx          # GoHighLevel API access
GHL_LOCATION_ID=sHFGxxx      # Your GHL account ID
GHL_CALENDAR_ID=eIHCxxx      # Calendar for appointments
OPENAI_API_KEY=sk-xxx        # For GPT-4 responses
NODE_ENV=production          # Activates production timeouts
TIMEZONE=America/New_York    # For appointment scheduling
```

### LangGraph Platform Setup
1. Deploy with `langgraph deploy`
2. Set all environment variables
3. Configure GHL webhook to: `https://your-deployment.langgraph.app/webhook/meta-lead`
4. Test with real WhatsApp messages

## Cost Optimization
- **Before**: $5.16 per conversation (29 tool calls)
- **After**: $1.50 per conversation (7-10 tool calls)
- **Savings**: 70% reduction through:
  - Efficient tool usage
  - State-based responses
  - Circuit breaker patterns
  - Message windowing

## Monitoring & Debugging

### Check Traces
1. LangSmith traces show tool execution flow
2. Each conversation has a unique trace ID
3. Monitor for:
   - Tool call patterns
   - Error messages
   - Response times

### Common Issues
1. **"No child runs"**: Service initialization failed (check env vars)
2. **Timeout errors**: Increase timeouts in production
3. **No messages sent**: Check GHL API key and contact ID
4. **Circuit breaker open**: Too many failures, wait 30s

## Testing Tools
- `verify-deployment.js`: Test all services
- `test-webhook-minimal.js`: Basic webhook test  
- `verify-whatsapp-sending.js`: Test WhatsApp delivery
- `diagnose-production-issue.js`: Analyze failed traces

## Success Metrics
- **89% success rate** in production
- **1-3 second** response time
- **68 calendar slots** available for booking
- **30 messages** history retrieved per conversation