# Webhook Setup for LangGraph Deployment

## Your Deployment Info
- **Base URL**: `https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app`
- **Webhook Endpoint**: `/webhook/meta-lead`
- **Status**: Deployed ✅ (but requires authentication)

## Authentication Required

Your deployment is secured with authentication (403 Forbidden response). You need to:

### Option 1: Get API Key from LangGraph
1. Go to your LangGraph deployment dashboard
2. Look for "API Keys" or "Authentication" section
3. Generate or copy your API key
4. Use it in requests:

```bash
curl -X POST https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/webhook/meta-lead \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_HERE" \
  -d '{
    "phone": "+13054870475",
    "message": "Hola test",
    "contactId": "54sJIGTtwmR89Qc5JeEt"
  }'
```

### Option 2: Configure GHL Webhook
In GoHighLevel, when setting up the webhook:

1. **Webhook URL**: 
   ```
   https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/webhook/meta-lead
   ```

2. **Headers** (if GHL supports them):
   - Key: `X-API-Key`
   - Value: `[Your LangGraph API Key]`

3. **Authentication Type**: 
   - Bearer Token
   - Or API Key
   - Or Custom Headers

### Option 3: Check Deployment Settings
Your deployment might have:
- Public endpoint option (to disable auth for webhooks)
- Webhook-specific authentication settings
- IP whitelist for GHL servers

## Testing Your Webhook

Once you have the authentication configured:

```javascript
// Test with auth header
const response = await fetch('https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/webhook/meta-lead', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_API_KEY', // or
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    phone: '+13054870475',
    message: 'Hola test',
    contactId: '54sJIGTtwmR89Qc5JeEt'
  })
});
```

## Common Auth Headers
LangGraph might use:
- `X-API-Key: your-key`
- `Authorization: Bearer your-token`
- `X-Auth-Token: your-token`
- `langchain-api-key: your-key`

Check your deployment dashboard for the exact header name and format!

## Next Steps
1. Find your API key in LangGraph dashboard
2. Test with curl using the auth header
3. Configure GHL webhook with authentication
4. Test end-to-end flow

Your bot is deployed and running! Just needs the auth setup. 🔐