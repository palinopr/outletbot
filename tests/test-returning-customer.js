// Test that bot recognizes returning customers and doesn't ask for info it already has
import { graph } from '../agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';

dotenv.config();

async function testReturningCustomer() {
  console.log('Testing returning customer recognition...\n');
  
  // Simulate a returning customer where we already have their name
  const existingLeadInfo = {
    name: 'Jaime',
    businessType: null,
    problem: null,
    goal: null,
    budget: null,
    email: null
  };
  
  // Customer provides problem info
  const customerMessage = "Tengo un restaurante y perdiendo muchos clientes no puedo contestar";
  
  console.log('Existing info:', existingLeadInfo);
  console.log('Customer says:', customerMessage);
  console.log('\nExpected behavior: Bot should greet Jaime by name and ask about goals');
  console.log('Wrong behavior: Bot asks "¿Cuál es tu nombre?"\n');
  
  try {
    const result = await graph.invoke({
      messages: [new HumanMessage(customerMessage)],
      leadInfo: existingLeadInfo,
      contactId: 'test123',
      conversationId: null
    }, {
      configurable: {
        contactId: 'test123',
        currentLeadInfo: existingLeadInfo
      },
      recursionLimit: 10
    });
    
    console.log('✅ Test completed');
    
    // Check if bot properly used the name
    const lastMessage = result.messages[result.messages.length - 1];
    console.log('\nBot response analysis:');
    
    if (lastMessage.content && typeof lastMessage.content === 'string') {
      const response = lastMessage.content.toLowerCase();
      if (response.includes('jaime')) {
        console.log('✅ Bot used customer name');
      } else {
        console.log('❌ Bot did not use customer name');
      }
      
      if (response.includes('nombre') && response.includes('?')) {
        console.log('❌ Bot asked for name (WRONG - already has it)');
      } else {
        console.log('✅ Bot did not ask for name');
      }
      
      if (response.includes('meta') || response.includes('objetivo')) {
        console.log('✅ Bot asked about goals (CORRECT - next step)');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testReturningCustomer();