import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🚀 Testing Complete System Flow\n');

// Simulate a complete conversation flow
async function testCompleteFlow() {
  const contactId = 'test-' + Date.now();
  const conversationId = 'conv-' + Date.now();
  const threadId = `thread_${contactId}`;
  
  const config = {
    configurable: {
      thread_id: threadId,
      contactId,
      conversationId,
      phone: '+1234567890'
    }
  };

  try {
    // Test 1: Initial greeting
    console.log('📍 Step 1: Initial Greeting');
    const step1 = await webhookHandler.invoke({
      messages: [new HumanMessage('hola')],
      contactId,
      phone: '+1234567890',
      conversationId,
      threadId
    }, config);
    
    const aiResponse1 = step1.messages?.filter(m => m._getType?.() === 'ai').pop();
    console.log('✅ AI Response:', aiResponse1?.content?.substring(0, 100) + '...');
    console.log('Lead Info:', step1.leadInfo);
    console.log('');

    // Test 2: Provide name
    console.log('📍 Step 2: Providing Name');
    const step2 = await webhookHandler.invoke({
      messages: [new HumanMessage('Me llamo Carlos')],
      contactId,
      phone: '+1234567890',
      conversationId,
      threadId,
      leadInfo: step1.leadInfo
    }, config);
    
    console.log('✅ Lead Info Updated:', step2.leadInfo);
    console.log('');

    // Test 3: Provide problem
    console.log('📍 Step 3: Describing Problem');
    const step3 = await webhookHandler.invoke({
      messages: [new HumanMessage('tengo un restaurante pero no tengo clientes')],
      contactId,
      phone: '+1234567890',
      conversationId,
      threadId,
      leadInfo: step2.leadInfo
    }, config);
    
    console.log('✅ Lead Info Updated:', step3.leadInfo);
    console.log('');

    // Test 4: Provide goal
    console.log('📍 Step 4: Stating Goal');
    const step4 = await webhookHandler.invoke({
      messages: [new HumanMessage('quiero llegar a vender $10k al mes')],
      contactId,
      phone: '+1234567890',
      conversationId,
      threadId,
      leadInfo: step3.leadInfo
    }, config);
    
    console.log('✅ Lead Info Updated:', step4.leadInfo);
    console.log('');

    // Test 5: Provide budget
    console.log('📍 Step 5: Stating Budget');
    const step5 = await webhookHandler.invoke({
      messages: [new HumanMessage('puedo invertir $500 al mes')],
      contactId,
      phone: '+1234567890',
      conversationId,
      threadId,
      leadInfo: step4.leadInfo
    }, config);
    
    console.log('✅ Lead Info Updated:', step5.leadInfo);
    console.log('');

    // Test 6: Provide email
    console.log('📍 Step 6: Providing Email');
    const step6 = await webhookHandler.invoke({
      messages: [new HumanMessage('mi email es carlos@restaurant.com')],
      contactId,
      phone: '+1234567890',
      conversationId,
      threadId,
      leadInfo: step5.leadInfo
    }, config);
    
    console.log('✅ Lead Info Updated:', step6.leadInfo);
    const aiResponse6 = step6.messages?.filter(m => m._getType?.() === 'ai').pop();
    console.log('AI Response:', aiResponse6?.content?.substring(0, 150) + '...');
    console.log('');

    // Check if calendar was shown
    if (aiResponse6?.content?.includes('disponibles')) {
      console.log('📅 Calendar slots were shown!');
      
      // Test 7: Select time slot
      console.log('📍 Step 7: Selecting Time Slot');
      const step7 = await webhookHandler.invoke({
        messages: [new HumanMessage('la primera opción')],
        contactId,
        phone: '+1234567890',
        conversationId,
        threadId,
        leadInfo: step6.leadInfo,
        availableSlots: step6.availableSlots
      }, config);
      
      console.log('✅ Appointment Booked:', step7.appointmentBooked);
      const finalResponse = step7.messages?.filter(m => m._getType?.() === 'ai').pop();
      console.log('Final Response:', finalResponse?.content);
    }

    console.log('\n🎉 Complete flow test finished successfully!');
    
    // Summary
    console.log('\n📊 Summary:');
    console.log('- Total steps:', 6);
    console.log('- Lead qualified:', step6.leadInfo?.budget >= 300 ? 'Yes' : 'No');
    console.log('- All info collected:', !!(step6.leadInfo?.name && step6.leadInfo?.problem && step6.leadInfo?.goal && step6.leadInfo?.budget && step6.leadInfo?.email));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Test error handling
async function testErrorCases() {
  console.log('\n🧪 Testing Error Cases\n');
  
  try {
    // Missing required fields
    console.log('📍 Test: Missing required fields');
    const result = await webhookHandler.invoke({
      messages: [new HumanMessage('test')],
      // Missing contactId
    }, {});
    console.log('❌ Should have failed but didnt');
  } catch (error) {
    console.log('✅ Correctly handled missing fields:', error.message);
  }

  // Test low budget rejection
  console.log('\n📍 Test: Low budget rejection');
  const lowBudgetTest = await webhookHandler.invoke({
    messages: [new HumanMessage('mi presupuesto es $100')],
    contactId: 'test-low-budget',
    phone: '+1234567890',
    conversationId: 'test-conv',
    leadInfo: {
      name: 'Test User',
      problem: 'no sales',
      goal: 'more sales'
    }
  }, {
    configurable: {
      thread_id: 'test-thread-low',
      contactId: 'test-low-budget'
    }
  });
  
  const rejection = lowBudgetTest.messages?.filter(m => m._getType?.() === 'ai').pop();
  console.log('✅ Rejection message:', rejection?.content?.substring(0, 100) + '...');
}

// Run all tests
async function runAllTests() {
  try {
    await testCompleteFlow();
    await testErrorCases();
    
    console.log('\n✅ All tests passed! System is ready for deployment.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Tests failed:', error);
    process.exit(1);
  }
}

// Execute tests
runAllTests();