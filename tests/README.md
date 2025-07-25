# Debugging and Testing Tools

This directory contains essential debugging and testing tools for the Outlet Media Bot.

## Available Tools

### 1. `debug-trace.js` - LangSmith Trace Debugger
**Purpose**: Debug specific LangSmith traces to understand bot behavior and errors.

**Usage**:
```bash
# Debug a specific trace by ID
node tests/debug-trace.js YOUR_TRACE_ID

# Example
node tests/debug-trace.js 1f069aa3-4d0e-6419-8939-3dac1bf2836b
```

**What it shows**:
- Complete trace details
- All runs and their status
- Error messages and stack traces
- Tool calls and responses
- Message flow through the system

---

### 2. `test-components.js` - Component Integration Test
**Purpose**: Test all major components of the bot system (89% success rate).

**Usage**:
```bash
node tests/test-components.js
```

**Tests**:
- ✅ GHL Authentication
- ✅ Contact Retrieval
- ✅ WhatsApp Messaging
- ✅ Calendar Integration
- ✅ Conversation History
- ✅ Tag Management
- ✅ Note Creation
- ✅ Contact Updates
- ⚠️ Contact Creation (for new contacts)

---

### 3. `test-webhook-handler.js` - Webhook Handler Test
**Purpose**: Test the webhook handler with proper state management.

**Usage**:
```bash
node tests/test-webhook-handler.js
```

**What it tests**:
- Webhook message parsing
- State management
- Conversation history retrieval
- Agent invocation
- Error handling

---

### 4. `test-real-webhook-flow.js` - End-to-End Webhook Test
**Purpose**: Simulate complete webhook flow with real GHL contact.

**Usage**:
```bash
node tests/test-real-webhook-flow.js
```

**What it demonstrates**:
1. Webhook receives only phone, message, contactId
2. System fetches conversation history
3. System retrieves contact details
4. AI processes message with full context
5. Response sent via WhatsApp

---

### 5. `test-custom-field-update.js` - Custom Field Update Test
**Purpose**: Test updating GHL custom fields with lead data.

**Usage**:
```bash
node tests/test-custom-field-update.js
```

**What it updates**:
- Standard fields (name, email, company)
- Custom fields:
  - goal (ID: r7jFiJBYHiEllsGn7jZC)
  - budget (ID: 4Qe8P25JRLW0IcZc5iOs)
  - business_type (ID: HtoheVc48qvAfvRUKhfG)
  - urgency_level (ID: dXasgCZFgqd62psjw7nd)
- Tags for filtering
- Notes with qualification summary

---

### 6. `test-get-custom-fields.js` - Custom Field Discovery
**Purpose**: Retrieve all custom fields configured in your GHL location.

**Usage**:
```bash
node tests/test-get-custom-fields.js
```

**Output**:
- Lists all custom fields with:
  - Field name
  - Field ID
  - Field key
  - Data type
  - Options (for dropdown fields)

---

### 7. `test-conversation-notes.js` - Conversation Note Tracking Test
**Purpose**: Test that bot adds notes after each interaction.

**Usage**:
```bash
node tests/test-conversation-notes.js
```

**What it simulates**:
- Multi-turn conversation
- Note creation after each message
- Progressive data collection
- Final contact state verification

---

## Environment Requirements

All tests require a `.env` file with:
```env
GHL_API_KEY=your_api_key
GHL_LOCATION_ID=your_location_id
GHL_CALENDAR_ID=your_calendar_id
OPENAI_API_KEY=your_openai_key
LANGSMITH_API_KEY=your_langsmith_key
```

## Common Use Cases

### 1. Debug a Failed Conversation
```bash
# Get trace ID from LangSmith dashboard
node tests/debug-trace.js TRACE_ID_HERE
```

### 2. Verify GHL Integration
```bash
# Run component tests
node tests/test-components.js
```

### 3. Test Custom Field Mapping
```bash
# First, discover your fields
node tests/test-get-custom-fields.js

# Then test updates
node tests/test-custom-field-update.js
```

### 4. Simulate Complete Flow
```bash
# Test webhook to appointment booking
node tests/test-real-webhook-flow.js
```

## Troubleshooting

### Contact Not Found (400 Error)
- Verify the contactId exists in GHL
- Check if using correct location ID
- Ensure API key has proper permissions

### Custom Fields Not Updating
- Run `test-get-custom-fields.js` to verify field IDs
- Check field data types match (TEXT, NUMERICAL, etc.)
- Ensure values are properly formatted

### WhatsApp Messages Not Sending
- Verify GHL WhatsApp integration is active
- Check phone number format (+1XXXXXXXXXX)
- Ensure contact has valid phone number

### Calendar Slots Not Showing
- Verify calendar ID is correct
- Check calendar has available slots
- Ensure all lead info collected before showing calendar