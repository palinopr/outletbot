import { salesAgentInvoke } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';

dotenv.config();

async function testQualifiedLead() {
  console.log('🎯 Testing Qualified Lead Scenario\n');
  
  // Simulate a conversation where all info is already collected
  const qualifiedState = {
    messages: [
      new HumanMessage('carlos@restaurante.com')
    ],
    leadInfo: {
      name: 'Carlos',
      problem: 'no tengo clientes suficientes',
      goal: 'llenar mi restaurante todos los días', 
      budget: 500,
      email: null,  // Will be extracted from message
      phone: '+13054870475'
    },
    contactId: 'Jf5Hc0JRXrnqCjQGHTEU',
    conversationId: 'conv_Jf5Hc0JRXrnqCjQGHTEU'
  };
  
  console.log('Initial state:');
  console.log('- Name:', qualifiedState.leadInfo.name);
  console.log('- Problem:', qualifiedState.leadInfo.problem);
  console.log('- Goal:', qualifiedState.leadInfo.goal);
  console.log('- Budget: $' + qualifiedState.leadInfo.budget);
  console.log('- Email: (to be extracted)');
  console.log('- Message:', qualifiedState.messages[0].content);
  console.log('\nInvoking agent...\n');
  
  try {
    const result = await salesAgentInvoke(qualifiedState, {
      configurable: {
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: 'Jf5Hc0JRXrnqCjQGHTEU'
      },
      runId: 'test-qualified-' + Date.now()
    });
    
    console.log('\n✅ Agent completed!');
    
    // Check results
    const lastMessage = result.messages[result.messages.length - 1];
    console.log('\nBot response:', lastMessage.content?.substring(0, 300) + '...');
    
    // Check if calendar was shown
    if (lastMessage.content?.includes('disponibles') || 
        lastMessage.content?.includes('horarios') ||
        lastMessage.content?.includes('slots')) {
      console.log('\n✅ SUCCESS: Calendar slots were shown!');
      
      // Count slots
      const slotMatches = lastMessage.content.match(/\d+\./g);
      if (slotMatches) {
        console.log(`Found ${slotMatches.length} time slots`);
      }
    } else {
      console.log('\n❌ FAIL: Calendar slots were NOT shown');
      console.log('Response type:', lastMessage._getType?.() || lastMessage.role);
      
      // Check for error messages
      if (lastMessage.content?.includes('Missing required') || 
          lastMessage.content?.includes('no tengo')) {
        console.log('Reason: Still asking for information');
      }
    }
    
    // Show final lead info
    console.log('\nFinal lead info:', result.leadInfo);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testQualifiedLead();