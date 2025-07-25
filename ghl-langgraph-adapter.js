import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Adapter to convert GHL webhook format to LangGraph format
app.post('/webhook', async (req, res) => {
  try {
    // GHL sends this format:
    // {
    //   "phone": "{{contact.phone}}",
    //   "message": "{{message.body}}",
    //   "contactId": "{{contact.id}}",
    //   "conversationId": "{{conversation.id}}"
    // }
    const { phone, message, contactId, conversationId } = req.body;
    
    console.log('GHL webhook received:', { contactId, conversationId, phone, message });
    
    // Validate required fields
    if (!contactId || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: contactId or message' 
      });
    }
    
    // Convert to LangGraph format with contactId in config
    const langGraphPayload = {
      assistant_id: "sales_agent",
      thread_id: contactId, // Use contactId as thread ID
      input: {
        messages: [{
          role: "human",
          content: message
        }]
      },
      config: {
        configurable: {
          contactId: contactId,  // Pass the real contact ID
          phone: phone || "",
          conversationId: conversationId || contactId,
          ghlApiKey: process.env.GHL_API_KEY,
          ghlLocationId: process.env.GHL_LOCATION_ID,
          calendarId: process.env.GHL_CALENDAR_ID
        }
      }
    };
    
    console.log('Calling LangGraph with:', JSON.stringify(langGraphPayload, null, 2));
    
    // Call LangGraph API
    const response = await axios.post(
      'https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream',
      langGraphPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.LANGSMITH_API_KEY
        },
        responseType: 'stream',
        timeout: 30000 // 30 second timeout
      }
    );
    
    // Return success immediately to GHL
    res.json({ 
      success: true,
      message: 'Webhook received and processing',
      contactId: contactId
    });
    
    // Process stream in background (GHL doesn't wait for this)
    let buffer = '';
    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            // Log tool calls for debugging
            if (data.messages) {
              const lastMessage = data.messages[data.messages.length - 1];
              if (lastMessage.tool_calls) {
                console.log('Tool calls:', lastMessage.tool_calls);
              }
            }
          } catch (e) {
            // Ignore non-JSON events
          }
        }
      }
    });
    
    response.data.on('end', () => {
      console.log('LangGraph stream completed for contact:', contactId);
    });
    
    response.data.on('error', (error) => {
      console.error('Stream error:', error);
    });
    
  } catch (error) {
    console.error('Adapter error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to process webhook',
      details: error.response?.data || error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'ghl-langgraph-adapter',
    version: '1.0.0'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`GHL-LangGraph adapter running on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});