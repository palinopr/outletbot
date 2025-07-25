# GHL Webhook Setup Guide

## Step 1: Create Webhook in GHL

1. Go to **Settings** → **Webhooks** in your GHL location
2. Click **"+ New Webhook"**
3. Configure the webhook:

### Basic Settings:
- **Name**: Meta Ads Sales Bot
- **URL**: `https://your-domain.com/webhook`
- **Version**: V2

### Events to Subscribe:
- ✅ **Inbound Message** (Required)
- ✅ **Outbound Message** (Optional - for tracking)

### Custom Payload Template:
```json
{
  "phone": "{{contact.phone}}",
  "message": "{{message.body}}",
  "contactId": "{{contact.id}}",
  "conversationId": "{{conversation.id}}"
}
```

## Step 2: Configure Headers

Add these headers:
- `Content-Type`: `application/json`

## Step 3: Test Webhook

Use GHL's test feature with this sample data:
```json
{
  "phone": "+15551234567",
  "message": "I'm interested in your services",
  "contactId": "test-contact-id",
  "conversationId": "test-conversation-id"
}
```

## Step 4: Set Up Workflow (Optional)

Create a workflow that triggers on:
1. **Form Submission** (Meta Lead Form)
2. **Tag Applied** (e.g., "meta-lead")

Workflow actions:
1. Send webhook to your bot
2. Wait for response
3. Update contact based on bot's tags

## Webhook Response

Your bot will respond with:
```json
{
  "success": true,
  "message": "Processed successfully"
}
```

## Available Merge Fields in GHL:

### Contact Fields:
- `{{contact.id}}`
- `{{contact.phone}}`
- `{{contact.email}}`
- `{{contact.first_name}}`
- `{{contact.last_name}}`

### Message Fields:
- `{{message.id}}`
- `{{message.body}}`
- `{{message.type}}`
- `{{message.direction}}`

### Conversation Fields:
- `{{conversation.id}}`
- `{{location.id}}`

## Testing Your Integration

1. Send a test SMS to a contact
2. Check your server logs
3. Verify tags are applied in GHL
4. Check if appointment is booked (for qualified leads)

## Troubleshooting

If webhook fails:
1. Check your server is running
2. Verify SSL certificate (HTTPS required)
3. Check webhook URL is correct
4. Review server logs for errors
5. Ensure all environment variables are set