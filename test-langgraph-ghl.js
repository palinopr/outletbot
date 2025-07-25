import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Test calling LangGraph with GHL data
async function testLangGraphWithGHL() {
  const ghlData = {
    phone: "(305) 487-0475",
    message: "hola",
    contactId: "Yh4fzHeohpZDYM4BCsyY",
    conversationId: "null"
  };
  
  // Convert to LangGraph format
  const langGraphPayload = {
    assistant_id: "sales_agent",
    thread_id: ghlData.contactId,
    input: {
      messages: [{
        role: "human",
        content: ghlData.message
      }]
    },
    config: {
      configurable: {
        contactId: ghlData.contactId,
        phone: ghlData.phone,
        conversationId: ghlData.conversationId !== "null" ? ghlData.conversationId : ghlData.contactId
      }
    }
  };
  
  try {
    console.log('Calling LangGraph with:', JSON.stringify(langGraphPayload, null, 2));
    
    const response = await axios.post(
      'https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream',
      langGraphPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.LANGSMITH_API_KEY
        },
        responseType: 'stream'
      }
    );
    
    console.log('Response received, processing stream...');
    
    let buffer = '';
    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            console.log('Event:', JSON.stringify(data, null, 2));
          } catch (e) {
            // Ignore non-JSON events
          }
        }
      }
    });
    
    response.data.on('end', () => {
      console.log('Stream ended');
    });
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testLangGraphWithGHL();