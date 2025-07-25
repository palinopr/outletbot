import { salesAgent } from './agents/modernSalesAgent.js';
import { GHLService } from './services/ghlService.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';

dotenv.config();

// Test Spanish conversation flow
async function testSpanishFlow() {
  console.log('🇲🇽 Testing Spanish Conversation Flow with Texas Timezone\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  // Simulate conversation
  const testMessages = [
    "Hola",
    "Me llamo Carlos",
    "Necesito ayuda con marketing para mi restaurante",
    "Quiero atraer más clientes locales",
    "Puedo invertir unos 400 al mes",
    "carlos@mirestaurante.com"
  ];
  
  let messages = [];
  let leadInfo = {};
  
  console.log('Starting conversation...\n');
  
  for (const message of testMessages) {
    console.log(`👤 Cliente: ${message}`);
    
    messages.push(new HumanMessage(message));
    
    try {
      const result = await salesAgent.invoke({
        messages,
        leadInfo,
        contactId: 'test-contact-spanish',
        conversationId: 'test-convo-spanish'
      }, {
        configurable: {
          ghlService,
          calendarId: process.env.GHL_CALENDAR_ID,
          contactId: 'test-contact-spanish',
          currentLeadInfo: leadInfo
        }
      });
      
      // Find the bot's response
      const lastMessage = result.messages[result.messages.length - 1];
      
      // Check for tool calls
      if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        for (const toolCall of lastMessage.tool_calls) {
          if (toolCall.name === 'send_ghl_message') {
            console.log(`🤖 María: ${toolCall.args.message}\n`);
          }
          
          if (toolCall.name === 'extract_lead_info') {
            const extracted = toolCall.args.result || {};
            leadInfo = { ...leadInfo, ...extracted };
            console.log(`   [Info extracted: ${JSON.stringify(extracted)}]`);
          }
          
          if (toolCall.name === 'get_calendar_slots' && toolCall.args.result?.success) {
            console.log('\n📅 Horarios disponibles:');
            toolCall.args.result.slots.forEach(slot => {
              console.log(`   ${slot.index}. ${slot.display}`);
            });
          }
        }
      }
      
      // Add a small delay
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
  
  console.log('\n✅ Spanish conversation test completed!');
  console.log('\nLead Info Collected:', leadInfo);
}

// Run test
testSpanishFlow().catch(console.error);