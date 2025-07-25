import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Test that contactId is properly passed to the agent
async function testContactIdPassing() {
  const testContactId = "Yh4fzHeohpZDYM4BCsyY";
  
  const payload = {
    assistant_id: "sales_agent",
    thread_id: testContactId,
    input: {
      messages: [{
        role: "human",
        content: "Hola"
      }]
    },
    config: {
      configurable: {
        contactId: testContactId,
        phone: "(305) 487-0475",
        conversationId: "conv-123"
      }
    }
  };
  
  console.log('Testing with contactId:', testContactId);
  console.log('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await axios.post(
      'https://outletbot-a6387ef666a552b8ada595998ba395ea.us.langgraph.app/runs/stream',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.LANGSMITH_API_KEY
        },
        responseType: 'stream'
      }
    );
    
    let toolCallsFound = [];
    let buffer = '';
    
    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.messages) {
              const lastMessage = data.messages[data.messages.length - 1];
              if (lastMessage.tool_calls) {
                for (const toolCall of lastMessage.tool_calls) {
                  console.log('\n=== TOOL CALL FOUND ===');
                  console.log('Tool:', toolCall.name);
                  console.log('Args:', JSON.stringify(toolCall.args, null, 2));
                  
                  if (toolCall.name === 'send_ghl_message') {
                    const usedContactId = toolCall.args.contactId;
                    console.log('ContactId used:', usedContactId);
                    console.log('Expected:', testContactId);
                    console.log('Match:', usedContactId === testContactId ? '✅ CORRECT' : '❌ WRONG');
                  }
                  
                  toolCallsFound.push(toolCall);
                }
              }
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    });
    
    await new Promise((resolve) => {
      response.data.on('end', resolve);
    });
    
    console.log('\n=== SUMMARY ===');
    console.log('Total tool calls:', toolCallsFound.length);
    console.log('send_ghl_message calls:', toolCallsFound.filter(t => t.name === 'send_ghl_message').length);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testContactIdPassing();