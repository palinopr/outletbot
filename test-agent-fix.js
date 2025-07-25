import { graph as salesAgent } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';

dotenv.config();

async function testAgentFix() {
  console.log('Testing agent with real contactId...\n');
  
  const testContactId = '9ZwduP8T0yCTHpNIj4rS';
  
  try {
    // Log the input state
    const inputState = {
      messages: [new HumanMessage('hola')],
      contactId: testContactId
    };
    
    const config = {
      configurable: {
        contactId: testContactId
      }
    };
    
    console.log('Input state:', JSON.stringify(inputState, null, 2));
    console.log('Config:', JSON.stringify(config, null, 2));
    
    const result = await salesAgent.invoke(inputState, config);
    
    // Check if the agent used the correct contactId
    const lastMessage = result.messages[result.messages.length - 1];
    console.log('Agent response:', JSON.stringify(lastMessage, null, 2));
    
    // Log all messages
    console.log('\nAll messages:');
    result.messages.forEach((msg, idx) => {
      console.log(`\nMessage ${idx}:`, msg.constructor.name);
      if (msg.content) console.log('Content:', msg.content);
      if (msg.tool_calls) console.log('Tool calls:', msg.tool_calls);
    });
    
    // Look for tool calls
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      const toolCall = lastMessage.tool_calls[0];
      console.log('\nTool called:', toolCall.name);
      console.log('Tool args:', JSON.stringify(toolCall.args, null, 2));
      
      if (toolCall.args.contactId === testContactId) {
        console.log('\n✅ SUCCESS: Agent used the correct contactId!');
      } else {
        console.log('\n❌ FAILED: Agent used wrong contactId:', toolCall.args.contactId);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testAgentFix();