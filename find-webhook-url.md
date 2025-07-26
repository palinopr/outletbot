# How to Find Your Webhook URL

## From the LangSmith Deployment Page

1. On your deployment page (the link you shared), look for:
   - **"Endpoints"** section
   - **"API URL"** or **"Webhook URL"**
   - **"Deployment URL"**

2. The webhook URL will look like:
   ```
   https://[deployment-name]-[unique-id].[region].langgraph.app/webhook/meta-lead
   ```
   
   Example:
   ```
   https://outletbot-527bf05d.us.langgraph.app/webhook/meta-lead
   ```

3. Common places to find it:
   - **Overview Tab**: Usually shows the base URL
   - **API Tab**: Shows all available endpoints
   - **Settings**: May show the deployment URL

## Based on Your Deployment ID

Your deployment ID is: `527bf05d-3ded-43fe-a588-f2557c1c0e43`

The webhook URL might be:
- `https://527bf05d-3ded-43fe-a588-f2557c1c0e43.us.langgraph.app/webhook/meta-lead`
- `https://outletbot-527bf05d.us.langgraph.app/webhook/meta-lead`
- Or check the deployment page for the exact format

## Quick Test

Once you find the URL, test it:

```bash
curl -X POST [YOUR-WEBHOOK-URL] \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+13054870475",
    "message": "Hola test",
    "contactId": "54sJIGTtwmR89Qc5JeEt"
  }'
```

## In GHL

When setting up the webhook in GoHighLevel:
1. Go to Settings → Webhooks
2. Add your webhook URL
3. Select trigger: "Inbound Message"
4. Save and test

The URL is what connects GHL WhatsApp messages to your bot!