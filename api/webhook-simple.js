// Simple webhook handler for GHL that only expects phone, message, and contactId
// It fetches all conversation history from GHL using the contactId

export default async function handler(req, res) {
  console.log('\n=== WEBHOOK RECEIVED ===');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract only the essentials from the webhook
    const { phone, message, contactId } = req.body;
    
    // Validate required fields
    if (!phone || !message || !contactId) {
      console.error('Missing required fields:', { phone: !!phone, message: !!message, contactId: !!contactId });
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['phone', 'message', 'contactId'],
        received: Object.keys(req.body)
      });
    }
    
    console.log('Processing message from:', phone);
    console.log('Contact ID:', contactId);
    console.log('Message:', message);
    
    // Call the LangGraph agent endpoint
    const response = await fetch(`${process.env.LANGGRAPH_API_URL || 'http://localhost:8000'}/runs/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.LANGSMITH_API_KEY || ''
      },
      body: JSON.stringify({
        assistant_id: 'sales_agent',
        input: {
          messages: [{
            role: 'human',
            content: message
          }],
          phone: phone,
          contactId: contactId
          // No conversation history - agent will fetch it
        },
        config: {
          configurable: {
            contactId: contactId,
            phone: phone
          }
        },
        stream_mode: 'values'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('LangGraph API error:', response.status, errorText);
      return res.status(500).json({ 
        error: 'Failed to process message',
        details: errorText
      });
    }
    
    // Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            console.log('Stream event:', data);
          } catch (e) {
            // Not JSON, skip
          }
        }
      }
    }
    
    // Return success to GHL immediately
    res.status(200).json({ 
      success: true,
      message: 'Message processed',
      contactId: contactId
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
