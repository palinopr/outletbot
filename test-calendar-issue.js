import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';
import dotenv from 'dotenv';

dotenv.config();

// Real contact from GHL
const CONTACT_ID = 'Jf5Hc0JRXrnqCjQGHTEU';
const PHONE = '+13054870475';

async function testCalendarDirectly() {
  console.log('🔍 Testing Calendar API Directly...\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  try {
    const slots = await ghlService.getAvailableSlots(
      process.env.GHL_CALENDAR_ID,
      new Date(),
      14 // 2 weeks
    );
    
    console.log('✅ Calendar API working!');
    console.log(`Found ${Object.keys(slots).length} days with slots`);
    console.log('Sample slots:', Object.keys(slots).slice(0, 3));
  } catch (error) {
    console.error('❌ Calendar API Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

async function simulateQualifiedLead() {
  console.log('\n🎯 SIMULATING QUALIFIED LEAD SCENARIO\n');
  
  // First, test calendar directly
  await testCalendarDirectly();
  
  console.log('\n📱 Starting conversation flow...\n');
  
  // Simulate a qualified lead (all info collected, budget $500+)
  const state = {
    messages: [new HumanMessage('carlos@restaurante.com')],
    contactId: CONTACT_ID,
    phone: PHONE,
    leadInfo: {
      name: 'Carlos',
      problem: 'no tengo clientes',
      goal: 'llenar mi restaurante',
      budget: 500,
      email: null // Will be extracted from message
    }
  };
  
  try {
    console.log('🤖 Invoking agent with qualified lead state...');
    console.log('Lead info:', state.leadInfo);
    console.log('Message:', state.messages[0].content);
    
    const result = await webhookHandler.invoke(state, {
      configurable: {
        thread_id: CONTACT_ID,
        contactId: CONTACT_ID,
        phone: PHONE,
        locationId: process.env.GHL_LOCATION_ID
      }
    });
    
    const lastMessage = result.messages[result.messages.length - 1];
    console.log('\n✅ Response received!');
    console.log('Bot response:', lastMessage.content?.substring(0, 200) + '...');
    
    // Check if calendar was shown
    if (lastMessage.content?.includes('disponibles') || lastMessage.content?.includes('horarios')) {
      console.log('\n✅ Calendar slots were shown!');
    } else {
      console.log('\n❌ Calendar slots were NOT shown');
      console.log('Full response:', lastMessage.content);
    }
    
  } catch (error) {
    console.error('\n❌ Error during webhook invocation:', error.message);
    console.error('Error type:', error.name);
    console.error('Stack:', error.stack);
  }
}

// Run the test
simulateQualifiedLead().catch(console.error);