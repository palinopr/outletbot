// Test that bot adds notes after each interaction
import { graph } from './agents/salesAgent.js';
import { GHLService } from './services/ghlService.js';
import { HumanMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';

dotenv.config();

async function testConversationNotes() {
  console.log('Testing conversation note updates...\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  const contactId = 'cL2khoCZCL0VC3DwgtK8';
  const testMessages = [
    "Hola",
    "Soy Carlos",
    "Tengo una tienda de ropa y necesito más ventas online",
    "Quiero duplicar mis ventas en 3 meses",
    "Mi presupuesto es como 400 al mes"
  ];
  
  try {
    let conversationState = {
      messages: [],
      leadInfo: {},
      contactId,
      conversationId: null
    };
    
    for (const message of testMessages) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Customer: "${message}"`);
      
      // Add human message
      conversationState.messages.push(new HumanMessage(message));
      
      // Invoke agent
      const result = await graph.invoke(conversationState, {
        configurable: {
          ghlService,
          calendarId: process.env.GHL_CALENDAR_ID,
          contactId,
          currentLeadInfo: conversationState.leadInfo
        },
        recursionLimit: 25
      });
      
      // Update conversation state
      conversationState = {
        ...conversationState,
        messages: result.messages,
        leadInfo: { ...conversationState.leadInfo, ...result.leadInfo }
      };
      
      console.log('Bot processed message ✓');
      
      // Small delay to ensure GHL updates are processed
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Checking GHL updates...\n');
    
    // Get final contact state
    const contact = await ghlService.getContact(contactId);
    
    console.log('Contact Information:');
    console.log('- Name:', contact.firstName);
    console.log('- Email:', contact.email);
    console.log('- Company:', contact.companyName);
    console.log('- Tags:', contact.tags?.length || 0);
    
    if (contact.customFields && Array.isArray(contact.customFields)) {
      console.log('\nCustom Fields:');
      const fieldNames = {
        'r7jFiJBYHiEllsGn7jZC': 'goal/problem',
        '4Qe8P25JRLW0IcZc5iOs': 'budget',
        'HtoheVc48qvAfvRUKhfG': 'business_type'
      };
      
      contact.customFields.forEach(field => {
        const name = fieldNames[field.id] || field.id;
        console.log(`- ${name}: ${field.value}`);
      });
    }
    
    console.log('\n✅ Test complete!');
    console.log('\nTo see the notes added, check the contact in GHL:');
    console.log(`https://app.gohighlevel.com/v2/location/${process.env.GHL_LOCATION_ID}/contacts/detail/${contactId}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testConversationNotes();