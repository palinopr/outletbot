# GHL Webhook Setup Guide

This guide covers webhook setup for both LangGraph Platform and custom deployments.

## Option 1: LangGraph Platform Deployment

### Webhook URL Format
```
https://YOUR-DEPLOYMENT-NAME.us.langgraph.app/runs/stream
```

### Required Headers
- `Content-Type`: `application/json`
- `X-API-Key`: `YOUR_LANGSMITH_API_KEY`

### Webhook Body Format (LangGraph Platform)
```json
{
  "assistant_id": "webhook_handler",
  "input": {
    "messages": [{
      "role": "human", 
      "content": "{\"phone\": \"{{contact.phone}}\", \"message\": \"{{message.body}}\", \"contactId\": \"{{contact.id}}\"}"
    }]
  },
  "config": {
    "configurable": {
      "contactId": "{{contact.id}}",
      "phone": "{{contact.phone}}"
    }
  },
  "stream_mode": "values"
}
```

## Option 2: Custom API Deployment

### Webhook URL Format
```
https://your-server.com/webhook/meta-lead
```

### Required Headers
- `Content-Type`: `application/json`

### Webhook Body Format (Custom)
```json
{
  "phone": "{{contact.phone}}",
  "message": "{{message.body}}",
  "contactId": "{{contact.id}}",
  "conversationId": "{{conversation.id}}"
}
```

## Setup Steps in GHL

1. **Go to Settings → Webhooks** in your GHL location
2. **Click "+ New Webhook"**
3. **Configure Basic Settings**:
   - **Name**: Meta Ads Sales Bot
   - **Version**: V2
   - **Method**: POST
   - **URL**: Your webhook URL (see options above)

4. **Set Headers** (as per your deployment type)

5. **Events to Subscribe**:
   - ✅ **Inbound Message** (Required)
   - ✅ **Outbound Message** (Optional - for tracking)

6. **Set Body**: Copy the appropriate JSON template above

## Available GHL Merge Fields

### Contact Fields
- `{{contact.id}}`
- `{{contact.phone}}`
- `{{contact.email}}`
- `{{contact.first_name}}`
- `{{contact.last_name}}`

### Message Fields
- `{{message.id}}`
- `{{message.body}}`
- `{{message.type}}`
- `{{message.direction}}`

### Conversation Fields
- `{{conversation.id}}`
- `{{location.id}}`

## Testing Your Webhook

### Test Data
```json
{
  "phone": "+15551234567",
  "message": "I'm interested in your services",
  "contactId": "test-contact-id",
  "conversationId": "test-conversation-id"
}
```

### Expected Flow
1. Webhook executes successfully in GHL
2. Bot responds via WhatsApp/SMS
3. Contact gets updated with tags/notes
4. Appointment booked for qualified leads

## Workflow Setup (Optional)

Create a workflow that triggers on:
1. **Form Submission** (Meta Lead Form)
2. **Tag Applied** (e.g., "meta-lead")

Workflow actions:
1. Send webhook to your bot
2. Wait for response (optional)
3. Update contact based on bot's tags

## Troubleshooting

### LangGraph Platform Errors

**"assistant_id" is a required property**:
- Make sure you're using the LangGraph Platform URL format
- Verify the JSON structure matches exactly
- Check that `assistant_id` is set to `"webhook_handler"`

**Authentication errors**:
- Verify X-API-Key header is set correctly
- Check your LANGSMITH_API_KEY is valid

### Custom Deployment Errors

**Webhook fails**:
1. Check your server is running
2. Verify SSL certificate (HTTPS required)
3. Check webhook URL is correct
4. Review server logs for errors
5. Ensure all environment variables are set

### Common Issues

**No response from bot**:
- Check conversation history is being fetched
- Verify GHL API key has proper permissions
- Check if contact exists in GHL
- Review agent logs for errors

**Tags not applied**:
- Verify GHL API permissions include contact updates
- Check tag names match exactly (case-sensitive)
- Ensure contact ID is valid

## Important Notes

- The message content is stringified JSON for LangGraph Platform
- Replace placeholders with your actual values
- Test with simple messages first ("Hola")
- Monitor logs during initial setup