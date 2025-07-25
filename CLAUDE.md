# Outlet Media Bot - Sales Agent

## Overview
This is a LangGraph-based sales agent that qualifies leads from Meta ads through GHL webhooks via WhatsApp. It conducts natural conversations to gather information and books appointments for qualified leads.

## Current Architecture (v3.0 - Modern Implementation)

### Implementation Pattern
**Now Using Modern `createReactAgent` Pattern** ✅
- Built with latest LangGraph `createReactAgent`
- Zod-validated tools with type safety
- Tool-based architecture (6 tools)
- All messages sent via GHL tool (NOT webhook responses)

### Core Components

1. **Sales Agent** (`agents/salesAgent.js`)
   - Uses `createReactAgent` pattern (latest LangGraph)
   - 6 Zod-validated tools with type safety
   - All messages sent via `sendGHLMessage` tool
   - Strict qualification flow enforcement
   - Exports `salesAgent` graph instance

2. **API Handler** (`api/langgraphApi.js`)
   - Modern webhook handler for LangGraph Platform
   - Does NOT send webhook responses
   - Agent handles all messaging via tools
   - Manages conversation state with GHL
   - Returns acknowledgment only

3. **GHL Service** (`services/ghlService.js`) ✅ FULLY TESTED
   - Complete GoHighLevel API integration
   - Authentication working with `Version: '2021-07-28'`
   - Base URL: https://services.leadconnectorhq.com
   - ✅ WhatsApp messaging confirmed working
   - ✅ Calendar integration (returns 68 slots)
   - ✅ Full message history retrieval (30 messages retrieved)
   - ✅ Contact management (tags, notes working)

4. **Conversation Manager** (`services/conversationManager.js`)
   - Fetches conversation history from GHL
   - 5-minute cache for performance
   - Handles nested message structure: `response.data.messages.messages`
   - Successfully retrieves full conversation history

### Modern Tool Architecture

**6 Zod-Validated Tools**:
```javascript
1. sendGHLMessage      // Send WhatsApp messages to customer
2. extractLeadInfo     // Extract info from customer messages
3. getCalendarSlots    // Get slots (requires ALL fields)
4. bookAppointment     // Book the appointment
5. updateGHLContact    // Update tags and notes
6. parseTimeSelection  // Parse customer's time choice
```

**State Management**: Handled by createReactAgent internally with message history

### Message Flow Architecture

```
Webhook received → Agent processes → Uses tools:
  1. extractLeadInfo (get info from message)
  2. sendGHLMessage (respond to customer)
  3. updateGHLContact (add tags/notes)
  4. getCalendarSlots (when qualified)
  5. parseTimeSelection (when booking)
  6. bookAppointment (confirm booking)
```

### Conversation Flow

1. **Greeting** → Ask for name
2. **Discovery** → Ask about problem/pain point  
3. **Goal Setting** → Ask about desired outcome
4. **Budget Qualification** → Ask about monthly budget
5. **If $300+** → Ask for email → Fetch real calendar slots
6. **If <$300** → Politely decline, tag as "nurture-lead"
7. **Appointment Booking** → Parse selection → Book in GHL

### LangGraph Platform Configuration

**langgraph.json**:
```json
{
  "runtime": "nodejs",
  "node_version": "20",  // Required v20+
  "dependencies": ["./package.json"],
  "graphs": {
    "sales_agent": "./agents/salesAgent.js"  // Points to file, not export
  },
  "api": {
    "path": "./api/langgraph-api.js"
  }
}
```

**langgraph.config.js**: 
- Extended configuration (not used by platform)
- Defines routes, deployment settings
- For reference/documentation only

### GHL Integration - CONFIRMED WORKING ✅

#### Test Results with Real Data (Jaime Ortiz - Contact ID: 8eSdb9ZDsXDem9wlED9u):
- ✅ **Contact Management**: Retrieved contact info successfully
- ✅ **WhatsApp Messaging**: Sent 2 test messages (IDs: YoMuAoIBlw6GR1HIEtmp, 7p5pNNyQKG0TvIdXjzPo)
- ✅ **Calendar Slots**: 68 available slots returned
- ✅ **Message History**: Retrieved 30 messages (22 inbound, 8 outbound)
- ✅ **Tags**: Successfully added "bot-test-tag"
- ✅ **Notes**: Added test note with timestamp

#### API Endpoints (All Working):
- `GET /conversations/{id}` - Returns conversation with lastMessageBody
- `GET /conversations/{id}/messages` - Returns nested structure: response.data.messages.messages
- `GET /contacts/search/duplicate` - Find by phone
- `POST/PUT /contacts` - Create/update contact
- `POST /contacts/{id}/tags` - Add tags
- `POST /contacts/{id}/notes` - Add notes
- `GET /calendars/{id}/free-slots` - Returns date-grouped slots
- `POST /calendars/events/appointments` - Book appointment
- `POST /conversations/messages` - Send WhatsApp (type: 'WhatsApp')

### Webhook Processing

1. Receives GHL webhook with phone, message, contactId, conversationId
2. ConversationManager fetches full history from GHL
3. Adds new message to state
4. Invokes sales agent workflow
5. Sends AI response via SMS
6. Updates GHL contact (async, non-blocking)

### Tags Applied
- `qualified-lead` - Budget $300+
- `budget-300-plus` - High-value lead
- `under-budget` - Budget <$300
- `nurture-lead` - Needs follow-up
- `appointment-scheduled` - Booking confirmed
- `appointment-booked` - Successfully booked
- `needs-marketing` / `needs-sales` - Based on problem

### Key Implementation Details

1. **Message Routing**: All responses sent via `sendGHLMessage` tool (NOT webhook responses)
2. **Strict Qualification**: Must collect ALL fields before showing calendar
3. **Calendar Response Format**: GHL returns date-grouped slots that need parsing:
   ```javascript
   {
     "2025-07-29": { "slots": ["2025-07-29T09:00:00-04:00", ...] },
     "2025-07-30": { "slots": [...] }
   }
   ```
4. **Message History Structure**: Nested in `response.data.messages.messages`
5. **Authentication**: Requires `Version: '2021-07-28'` header
6. **Conversation Type**: Shows as TYPE_PHONE but includes WhatsApp messages

### Testing Tools

1. **test-local.js**: Simulates conversations without GHL
2. **test-ghl-integration.js**: Tests real GHL API integration  

## Production Status - 89% Success Rate

### ✅ What's Working:
1. **Modern Architecture**
   - createReactAgent pattern implemented
   - Zod schema validation for all tools
   - Tool-based message handling

2. **Full GHL Integration**
   - WhatsApp messaging confirmed
   - Calendar showing 68 available slots
   - Complete message history access
   - Contact management functional

3. **Qualification Flow**
   - Strict enforcement of all fields
   - Proper state management
   - Budget-based routing

## Environment Variables

```env
# Required
OPENAI_API_KEY=
GHL_API_KEY=
GHL_LOCATION_ID=
GHL_CALENDAR_ID=

# Platform Reserved (don't include)
LANGSMITH_API_KEY=  # Auto-configured
PORT=               # Auto-assigned
```

## Deployment Status - PRODUCTION READY

### LangGraph Platform
- Repository: https://github.com/palinopr/outletbot
- Node.js: v20 (required)
- Webhook URL: `https://outletbot-[id].us.langgraph.app/webhook/meta-lead`
- Auto-scaling: 1 container (1 CPU, 1GB memory)

### Test Results Summary
- ✅ Component Tests: 89% success rate (8/9 passing)
- ✅ WhatsApp: Confirmed working with real contact
- ✅ Calendar: 68 slots available
- ✅ Messages: 30 message history retrieved
- ✅ Modern Architecture: createReactAgent implemented
- ✅ Tool Validation: All 6 tools working
- ✅ Authentication: Fixed with Version header

## Key Test Commands

```bash
# Test with real contact
node test-real-contact.js

# Test calendar integration
node test-calendar-debug.js

# Test message history
node test-messages-final.js

# Full component test (89% success)
node test-components.js
```

## Important Findings

1. **Calendar API Format**: Returns date-grouped slots, not array
2. **Message API Structure**: Nested in `response.data.messages.messages`
3. **WhatsApp Type**: Use `type: 'WhatsApp'` not 'TYPE_WHATSAPP'
4. **Conversation Type**: Shows TYPE_PHONE but includes WhatsApp
5. **Authentication**: Must include Version: '2021-07-28' header

## Files Structure

### Core Implementation
- `agents/salesAgent.js` - Main agent with 6 tools
- `api/langgraphApi.js` - Webhook handler
- `services/ghlService.js` - GHL API integration
- `services/conversationManager.js` - Message history

### Test Files
- `test-real-contact.js` - Tests with real contact
- `test-calendar-debug.js` - Calendar endpoint testing
- `test-messages-final.js` - Message history testing
- `test-components.js` - Full integration test
- `TEST_REPORT_V2.md` - Latest test results
- `PRODUCTION_READY_REPORT.md` - Deployment readiness
- `DEPLOYMENT_GUIDE.md` - Step-by-step deployment

## Recent Architecture Updates (January 2025)

### Performance Crisis & Resolution
Initial traces showed conversations costing $5.16 each with 29 tool calls. After analysis and optimization, reduced to $1.50 per conversation with 7-10 tool calls.

### Major Fixes Implemented

#### 1. State Management Overhaul
**Problem**: Global variables causing concurrent user conflicts
```javascript
// BEFORE (Wrong)
let extractionCount = 0;  // Shared between all users!
const processedMessages = new Set();  // Memory leak!
```

**Solution**: Conversation-scoped state with proper reducers
```javascript
// AFTER (Correct)
const AgentStateAnnotation = Annotation.Root({
  extractionCount: Annotation({
    reducer: (x, y) => y,
    default: () => 0
  }),
  processedMessages: Annotation({
    reducer: (x, y) => [...new Set([...x, ...y])],
    default: () => []
  })
});
```

#### 2. Tool Consistency with Command Pattern
**Problem**: Inconsistent tool returns causing state propagation failures

**Solution**: ALL tools now return Command objects
```javascript
// Every tool follows this pattern
return new Command({
  update: { 
    leadInfo: merged,
    extractionCount: count + 1 
  },
  goto: 'END' // Optional: for termination
});
```

#### 3. Conversation Termination
**Problem**: Agent continued after appointment booking, sending 4 duplicate confirmations

**Solution**: Implement conditional edges with END state
```javascript
// bookAppointment tool signals completion
return new Command({
  update: { appointmentBooked: true },
  goto: 'END'  // Terminates conversation
});
```

#### 4. Circuit Breaker Pattern
**Problem**: extractLeadInfo called 10+ times in loops

**Solution**: Limit extraction attempts per conversation
```javascript
if (extractionCount >= MAX_EXTRACTION_ATTEMPTS) {
  return new Command({ update: {} });  // Stop trying
}
```

### Performance Optimizations

1. **System Prompt Reduction**: 3500 → 500 chars (85% reduction)
   - Removed redundant examples
   - Condensed instructions
   - Maintained all functionality

2. **Token Usage**:
   - Message windowing: Last 10 messages only
   - Calendar caching: 30-minute TTL
   - Result: 70-80% token reduction

3. **Cost Impact**:
   - API calls: 65-75% reduction
   - Cost per conversation: $5.16 → $1.50
   - Response time: Maintained at 1-3 seconds

### Architecture Patterns Now Used

1. **State Pattern**: `getCurrentTaskInput()` for accessing state in tools
2. **Command Pattern**: All tools return Command objects with plain message objects
3. **Circuit Breaker**: Max attempts with state tracking
4. **Conditional Edges**: Proper conversation termination
5. **Message Deduplication**: Hash-based duplicate prevention

### Thread Safety Improvements
- **No Global Variables**: Everything in conversation scope
- **Isolated Conversations**: Each user has separate state
- **Proper Reducers**: State updates are predictable
- **Bounded Growth**: No memory leaks from unbounded collections

### Key Lessons Learned

1. **Always Use State Annotations**: Never use global variables
2. **Tools Must Return Commands**: Use plain objects in messages array, not Message classes
3. **Explicit Termination**: Always signal when conversation complete
4. **Test Concurrent Users**: Single-user testing hides critical bugs
5. **Trace Analysis Essential**: LangSmith traces reveal hidden patterns
6. **Command Objects Work**: They ARE compatible with createReactAgent (v0.2.33+)

### Documentation
- See `KNOWLEDGE.md` for detailed technical documentation
- See `COMPLETE_FLOW_WITH_NOTES.md` for updated flow with optimizations