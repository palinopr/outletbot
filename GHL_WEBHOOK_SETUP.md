# GHL Webhook Setup for LangGraph Platform

## Webhook URL Format
Your webhook URL should be:
```
https://YOUR-DEPLOYMENT-NAME.us.langgraph.app/runs/stream
```

## Webhook Body Format
The LangGraph Platform requires this JSON structure:

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

## Step-by-Step Setup in GHL

1. **Go to your GHL Workflow**
2. **Edit the Webhook Action**
3. **Set Method**: POST
4. **Set URL**: `https://YOUR-DEPLOYMENT-NAME.us.langgraph.app/runs/stream`
5. **Set Headers**:
   - Content-Type: `application/json`
   - X-API-Key: `YOUR_LANGSMITH_API_KEY`
6. **Set Body**: Copy the JSON above exactly

## Important Notes

- The `assistant_id` MUST be `"webhook_handler"` (matching your langgraph.json)
- The message content is a stringified JSON inside the human message
- Replace `YOUR-DEPLOYMENT-NAME` with your actual deployment name
- Replace `YOUR_LANGSMITH_API_KEY` with your actual API key

## What's Different from Direct API Call

**Old Way (Custom Webhook)**:
```json
{
  "phone": "{{contact.phone}}",
  "message": "{{message.body}}",
  "contactId": "{{contact.id}}"
}
```

**New Way (LangGraph Platform)**:
- Wraps the data in LangGraph's expected format
- Includes `assistant_id` field
- Uses proper message structure
- Includes configuration block

## Testing the Webhook

After setting up, test with a simple "Hola" message. You should see:
1. Webhook executes successfully in GHL
2. Bot responds via WhatsApp
3. Contact gets updated with tags/notes

## Troubleshooting

If you get `"assistant_id" is a required property` error:
- Make sure you're using the LangGraph Platform URL format
- Verify the JSON structure matches exactly
- Check that `assistant_id` is set to `"webhook_handler"`

If you get authentication errors:
- Verify X-API-Key header is set correctly
- Check your LANGSMITH_API_KEY is valid