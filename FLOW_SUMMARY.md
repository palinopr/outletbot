# Complete Flow Summary - Outlet Media Bot

## 🔄 End-to-End Flow Overview

This document provides a comprehensive step-by-step breakdown of how the bot works, from webhook receipt to appointment booking, including all debugging checkpoints.

## 📊 Flow Diagram

```
Customer → WhatsApp → GHL → Webhook → Bot → Process → Response → GHL → WhatsApp → Customer
```

## 🚀 Detailed Flow Steps

### Step 1: Webhook Receipt
**What happens:**
1. Customer sends WhatsApp message to business number
2. GHL receives message and triggers webhook
3. Webhook POST request sent to: `https://outletbot-[id].us.langgraph.app/webhook/meta-lead`

**Webhook Payload Structure:**
```json
{
  "type": "InboundMessage",
  "locationId": "sHFG9Rw6BdGh6d6bfMqG",
  "contactId": "8eSdb9ZDsXDem9wlED9u",
  "conversationId": "L0cc6qWhUxvQcenc35Ll",
  "id": "TlL5b7pGvUaothBiBSVZ",
  "message": "Hola",
  "attachments": []
}
```

**Debug Points:**
- Check webhook logs in LangGraph dashboard
- Verify payload has all required fields
- Confirm contactId and conversationId are present

### Step 2: Webhook Handler Processing
**File:** `agents/webhookHandler.js`

**What happens:**
1. Extract message from JSON payload
2. Format phone number (normalize to E.164)
3. Initialize services (GHL, ConversationManager)
4. Check for duplicate messages (deduplication)

**Key Code:**
```javascript
// Parse webhook data
const webhookData = typeof data === 'string' ? JSON.parse(data) : data;
const { message, contactId, conversationId, phone } = webhookData;

// Message deduplication
const messageHash = generateMessageHash(message, contactId);
if (messageCache.has(messageHash)) {
  return { statusCode: 200, body: 'Duplicate message ignored' };
}
```

**Debug Points:**
- Check if message extracted correctly from payload
- Verify phone number formatting
- Check messageCache for duplicates
- Monitor service initialization timeouts

### Step 3: Conversation History Fetch
**File:** `services/conversationManager.js`

**What happens:**
1. Fetch conversation history from GHL API
2. Process nested message structure: `response.data.messages.messages`
3. Sort messages by timestamp
4. Return conversation with 1-year window

**API Call:**
```javascript
GET https://services.leadconnectorhq.com/conversations/{conversationId}/messages
Headers: {
  'Authorization': 'Bearer {GHL_API_KEY}',
  'Version': '2021-07-28'
}
```

**Debug Points:**
- Check GHL API response structure
- Verify message history retrieved
- Ensure no cross-contact contamination
- Monitor API timeouts (5 seconds)

### Step 4: State Preparation
**File:** `agents/webhookHandler.js`

**What happens:**
1. Fetch existing contact data from GHL
2. Prepare initial state with lead info
3. Add ONLY current message to agent (not history)
4. Include conversation history for context only

**State Structure:**
```javascript
{
  messages: [new HumanMessage(currentMessage)], // Only current message
  leadInfo: {
    name: contact.name,
    problem: contact.customFields?.problem,
    goal: contact.customFields?.goal,
    budget: contact.customFields?.budget,
    email: contact.email,
    phone: formattedPhone,
    conversationHistory: [...] // For context only
  },
  contactId,
  conversationId,
  configurable: { ghlService, conversationManager }
}
```

**Debug Points:**
- Verify only current message in state.messages
- Check leadInfo populated from GHL contact
- Ensure conversation history available but not processed
- Confirm services passed in configurable

### Step 5: Sales Agent Processing
**File:** `agents/salesAgent.js`

**What happens:**
1. Agent receives state with single message
2. System prompt guides conversation flow
3. Tools are invoked based on conversation stage
4. State updated after each tool call

**Conversation Flow:**
1. **Greeting** → Extract name → Ask for name if missing
2. **Discovery** → Extract problem → Ask about pain point
3. **Goal Setting** → Extract goal → Ask about desired outcome
4. **Budget Check** → Extract budget → Ask monthly budget
5. **Qualification:**
   - If ≥$300: Ask email → Show calendar
   - If <$300: Polite decline → Add nurture tag
6. **Booking** → Parse time → Book appointment

**Tools Used:**
```javascript
1. extractLeadInfo    // Extract info from message
2. sendGHLMessage     // Send response to customer
3. updateGHLContact   // Update tags/notes
4. getCalendarSlots   // Fetch available times
5. parseTimeSelection // Parse customer's choice
6. bookAppointment    // Create appointment
```

**Debug Points:**
- Monitor tool calls in LangSmith traces
- Check state updates after each tool
- Verify extraction attempts (max 5)
- Ensure proper conversation termination

### Step 6: Tool Execution

#### 6.1 Extract Lead Info Tool
**What happens:**
- Analyzes customer message
- Extracts: name, problem, goal, budget, email
- Updates state with new information
- Increments extraction count

**Debug Points:**
- Check extraction accuracy
- Monitor extraction count (prevent loops)
- Verify state merge logic

#### 6.2 Send GHL Message Tool
**What happens:**
- Formats message for WhatsApp
- Calls GHL API to send message
- Returns success/failure status

**API Call:**
```javascript
POST https://services.leadconnectorhq.com/conversations/messages
Body: {
  type: 'WhatsApp',
  conversationId,
  message: aiResponse
}
```

**Debug Points:**
- Verify message sent to GHL
- Check API response
- Monitor message delivery

#### 6.3 Update GHL Contact Tool
**What happens:**
- Updates contact custom fields
- Adds appropriate tags
- Creates notes for conversation

**Tags Applied:**
- `qualified-lead` (budget ≥$300)
- `under-budget` (budget <$300)
- `nurture-lead` (needs follow-up)
- `appointment-scheduled`
- `needs-marketing` / `needs-sales`

**Debug Points:**
- Verify tags applied correctly
- Check custom field updates
- Monitor note creation

#### 6.4 Get Calendar Slots Tool
**What happens:**
- Fetches available appointment slots
- Returns date-grouped structure
- Formats for customer display

**API Response Structure:**
```json
{
  "2025-01-29": {
    "slots": ["2025-01-29T09:00:00-04:00", ...]
  },
  "2025-01-30": {
    "slots": [...]
  }
}
```

**Debug Points:**
- Verify calendar ID correct
- Check slots returned
- Monitor date formatting

#### 6.5 Book Appointment Tool
**What happens:**
- Creates appointment in GHL calendar
- Updates contact with booking status
- Sends confirmation message

**Debug Points:**
- Verify appointment created
- Check confirmation sent
- Ensure conversation terminates

### Step 7: Response Handling
**File:** `api/langgraphApi.js`

**What happens:**
1. Agent completes processing
2. All messages sent via tools (not webhook response)
3. Webhook returns 200 OK acknowledgment
4. Updates logged asynchronously

**Response Pattern:**
```javascript
// Webhook only acknowledges receipt
return {
  statusCode: 200,
  body: JSON.stringify({ 
    status: 'success',
    message: 'Webhook processed'
  })
};
```

**Debug Points:**
- Verify 200 response sent
- Check async updates complete
- Monitor error handling

## 🐛 Common Issues & Solutions

### 1. Self-Conversation
**Issue:** Bot responds to its own messages
**Solution:** Only pass current message to agent
**Check:** `state.messages` should have 1 item

### 2. Context Contamination
**Issue:** Data from other contacts appears
**Solution:** Skip phone search, use contact ID directly
**Check:** Verify correct conversationId used

### 3. Duplicate Messages
**Issue:** Same message processed multiple times
**Solution:** Message deduplication with hash
**Check:** messageCache entries

### 4. No Response Sent
**Issue:** Tool called but message not sent
**Solution:** Force tool usage with `tool_choice: "required"`
**Check:** LangSmith traces for tool calls

### 5. Extraction Loops
**Issue:** extractLeadInfo called repeatedly
**Solution:** Max extraction limit (5 attempts)
**Check:** extractionCount in state

### 6. Calendar Not Shown
**Issue:** Calendar requested but not displayed
**Solution:** Ensure ALL fields collected first
**Check:** leadInfo has all required fields

## 📊 Performance Metrics

**Target Metrics:**
- Response time: <3 seconds
- Tool calls per message: 2-5
- Cost per conversation: ~$0.05-0.10
- Success rate: >85%

**Monitoring Points:**
1. API response times
2. Tool call frequency
3. Token usage per message
4. Error rates by type

## 🔍 Debugging Commands

**View Specific Trace:**
```bash
node traces/tools/trace-viewer.js <trace-id>
```

**Test Full Flow:**
```bash
node tests/test-full-flow.js
```

**Check GHL Integration:**
```bash
node tests/test-real-webhook-flow.js
```

**Monitor Live Logs:**
```bash
# In LangGraph dashboard
# Filter by: webhook, error, tool
```

## 🚨 Critical Checkpoints

1. **Webhook Receipt**: Message extracted correctly
2. **History Fetch**: No timeout, correct structure
3. **State Prep**: Only current message in state
4. **Tool Usage**: All tools return Commands
5. **Message Send**: GHL API success
6. **Termination**: Conversation ends properly

## 📝 State Flow Example

```javascript
// Initial State
{
  messages: [HumanMessage("Hola")],
  leadInfo: {},
  contactId: "abc123"
}

// After Name Extraction
{
  messages: [HumanMessage("Hola")],
  leadInfo: { name: "María" },
  extractionCount: 1
}

// After All Info Collected
{
  messages: [HumanMessage("mi presupuesto es 500")],
  leadInfo: {
    name: "María",
    problem: "necesito más clientes",
    goal: "crecer mi negocio",
    budget: "$500",
    email: "maria@example.com"
  },
  extractionCount: 4
}

// After Booking
{
  messages: [HumanMessage("el martes a las 3pm")],
  leadInfo: { ...allInfo },
  appointmentBooked: true
}
```

## 🔧 Configuration

**Environment Variables:**
```bash
OPENAI_API_KEY=sk-...
GHL_API_KEY=pit-...
GHL_LOCATION_ID=...
GHL_CALENDAR_ID=...
```

**Feature Flags:**
```javascript
enableDeduplication: true
enableConversationHistory: true
maxExtractionAttempts: 5
conversationTimeout: 30000
```

## 📋 Checklist for New Deployments

- [ ] Environment variables set
- [ ] GHL webhook configured
- [ ] Calendar ID verified
- [ ] Test webhook endpoint
- [ ] Verify message delivery
- [ ] Check tag application
- [ ] Monitor first conversations
- [ ] Review LangSmith traces

## 🆘 Emergency Procedures

**If bot not responding:**
1. Check webhook logs
2. Verify GHL API key valid
3. Check OpenAI quota
4. Review recent deployments

**If sending duplicate messages:**
1. Check deduplication cache
2. Verify message hash logic
3. Review concurrent requests

**If wrong customer data:**
1. Check contactId usage
2. Verify no phone search
3. Clear conversation cache

This document should be your primary reference for understanding and debugging the bot flow.