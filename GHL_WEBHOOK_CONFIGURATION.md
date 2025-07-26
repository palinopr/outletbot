# GoHighLevel Webhook Configuration

## Your LangGraph Deployment Details ✅

- **Deployment URL**: `https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app`
- **API Key**: `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`
- **Status**: Deployed but showing initialization errors

## The Issue

Your bot is deployed and accessible, but it's returning:
```
"Lo siento, hubo un error procesando tu mensaje. Por favor intenta de nuevo."
```

This indicates the GHL service initialization is failing in production.

## Immediate Fix Needed

The deployment likely needs these environment variables verified:
- `GHL_API_KEY` - Make sure it's not expired
- `GHL_LOCATION_ID` - Must match your GHL account
- `GHL_CALENDAR_ID` - Must be a valid calendar in your location

## How to Configure GHL Webhook

Since LangGraph uses a streaming endpoint, you'll need a webhook adapter. Here are two options:

### Option 1: Create a Simple Webhook Adapter

Create this as a separate service (e.g., on Vercel, Netlify, or Railway):

```javascript
// webhook-adapter.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, message, contactId } = req.body;

  try {
    // Call LangGraph deployment
    const response = await fetch('https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': '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'
      },
      body: JSON.stringify({
        assistant_id: 'webhook_handler',
        input: {
          messages: [{
            role: 'human',
            content: JSON.stringify({ phone, message, contactId })
          }]
        },
        stream_mode: 'values'
      })
    });

    // Process streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let lastAIMessage = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.messages) {
              const aiMessages = data.messages.filter(m => m.type === 'ai');
              if (aiMessages.length > 0) {
                lastAIMessage = aiMessages[aiMessages.length - 1].content;
              }
            }
          } catch (e) {}
        }
      }
    }

    // Return success (GHL doesn't need the response body)
    res.status(200).json({ 
      success: true,
      message: lastAIMessage || 'Processing'
    });

  } catch (error) {
    console.error('Webhook adapter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Option 2: Direct Integration (if GHL supports streaming)

In GHL webhook settings:
1. **URL**: `https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream`
2. **Method**: POST
3. **Headers**:
   - `Content-Type: application/json`
   - `X-API-Key: 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`
4. **Body Template**:
```json
{
  "assistant_id": "webhook_handler",
  "input": {
    "messages": [{
      "role": "human",
      "content": "{\"phone\": \"{{phone}}\", \"message\": \"{{message}}\", \"contactId\": \"{{contactId}}\"}"
    }]
  },
  "stream_mode": "values"
}
```

## Testing Your Deployment

Run this to test:
```bash
node test-production-webhook.js
```

## Current Status

1. ✅ Deployment is live
2. ✅ API key is working
3. ❌ Service initialization failing
4. ❌ Webhook adapter needed for GHL

## Next Steps

1. **Check deployment logs** in LangGraph dashboard for initialization errors
2. **Verify GHL credentials** are not expired
3. **Deploy webhook adapter** to bridge GHL → LangGraph
4. **Test end-to-end** with real WhatsApp messages

The main issue is that your bot's GHL service initialization is timing out or failing with the credentials in production.