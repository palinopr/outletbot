import { salesAgentWithContext } from './agents/salesAgentWithContext.js';
import { GHLService } from './services/ghlService.js';
import { HumanMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';

dotenv.config();

async function testWrapper() {
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  const testContactId = "Yh4fzHeohpZDYM4BCsyY";
  
  try {
    console.log('Testing wrapper with contactId:', testContactId);
    
    const result = await salesAgentWithContext({
      messages: [new HumanMessage("Hola")],
      contactId: testContactId,
      leadInfo: {}
    }, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID
      }
    });
    
    // Check tool calls
    const toolCalls = result.messages.filter(m => m.tool_calls?.length > 0);
    for (const msg of toolCalls) {
      for (const toolCall of msg.tool_calls) {
        if (toolCall.name === 'send_ghl_message') {
          console.log('\n=== TOOL CALL ===');
          console.log('ContactId used:', toolCall.args.contactId);
          console.log('Expected:', testContactId);
          console.log('Match:', toolCall.args.contactId === testContactId ? '✅ CORRECT' : '❌ WRONG');
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testWrapper();