// Test script to verify complete 7-step conversation flow
import { graph } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';
import { ConversationManager } from './services/conversationManager.js';
import { GHLService } from './services/ghlService.js';

dotenv.config();

// Test contact ID (use a test contact)
const TEST_CONTACT_ID = process.env.TEST_CONTACT_ID || 'test-' + Date.now();
const TEST_PHONE = process.env.TEST_PHONE || '+15128298922';

// Note: The hardcoded contact ID no longer exists in GHL
// You need to either:
// 1. Create a test contact in GHL and set TEST_CONTACT_ID env var
// 2. Use test-local.js for testing without real GHL integration

console.log('🧪 Testing Complete 7-Step Flow with Fixed Message Handling\n');
console.log('='.repeat(60));
console.log('⚠️  WARNING: Using contact ID:', TEST_CONTACT_ID);
console.log('⚠️  This test requires a valid GHL contact. Set TEST_CONTACT_ID env var.');
console.log('='.repeat(60));

// Initialize services
const ghlService = new GHLService(
  process.env.GHL_API_KEY,
  process.env.GHL_LOCATION_ID
);
const conversationManager = new ConversationManager(ghlService);

// Clear conversation cache to start fresh
conversationManager.clearCache(TEST_CONTACT_ID, null);

// Simulate the 7-step conversation flow
const conversationSteps = [
  { message: "Hola", expectedAction: "Ask for name" },
  { message: "Soy Jaime", expectedAction: "Ask about problem" },
  { message: "Necesito más clientes para mi restaurante", expectedAction: "Ask about goal" },
  { message: "Quiero aumentar ventas 50% en 3 meses", expectedAction: "Ask about budget" },
  { message: "Tengo como 500 al mes", expectedAction: "Ask for email" },
  { message: "jaime@mirestaurante.com", expectedAction: "Show calendar slots" },
  { message: "El martes a las 11", expectedAction: "Book appointment" }
];

async function simulateWebhook(message, stepIndex) {
  console.log(`\n📥 Step ${stepIndex + 1}: Customer says: "${message}"`);
  console.log('-'.repeat(60));
  
  const input = {
    messages: [new HumanMessage({
      content: JSON.stringify({
        phone: TEST_PHONE,
        message: message,
        contactId: TEST_CONTACT_ID
      })
    })],
    contactId: TEST_CONTACT_ID,
    phone: TEST_PHONE
  };
  
  try {
    const startTime = Date.now();
    
    const result = await graph.invoke(input, {
      configurable: {
        contactId: TEST_CONTACT_ID,
        phone: TEST_PHONE,
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID
      },
      recursionLimit: 30
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ Processed in ${duration}ms`);
    
    // Check if it was marked as duplicate
    if (result.duplicate) {
      console.log('⚠️  Message was marked as duplicate (deduplication working!)');
    }
    
    // Fetch conversation state to verify progress
    const conversationState = await conversationManager.getConversationState(
      TEST_CONTACT_ID,
      null,
      TEST_PHONE
    );
    
    console.log(`📊 Lead Info After Step ${stepIndex + 1}:`, {
      name: conversationState.leadName || null,
      problem: conversationState.leadProblem || null,
      goal: conversationState.leadGoal || null,
      budget: conversationState.leadBudget || null,
      email: conversationState.leadEmail || null,
      currentStep: conversationState.currentStep,
      messageCount: conversationState.messageCount
    });
    
    // Clear cache for next step
    conversationManager.clearCache(TEST_CONTACT_ID, conversationState.conversationId);
    
  } catch (error) {
    console.error(`❌ Error at step ${stepIndex + 1}:`, error.message);
  }
}

async function runFullFlowTest() {
  // First check if we can access GHL
  try {
    const testContact = await ghlService.getContact(TEST_CONTACT_ID);
    console.log('✅ Found test contact:', testContact.firstName || 'Unknown');
  } catch (error) {
    console.error('❌ Cannot find contact ID:', TEST_CONTACT_ID);
    console.error('\nTo fix this:');
    console.error('1. Create a test contact in GHL');
    console.error('2. Set TEST_CONTACT_ID=<your-contact-id> in .env');
    console.error('3. Or use test-local.js for testing without GHL\n');
    process.exit(1);
  }
  
  console.log('🚀 Starting Full 7-Step Flow Test\n');
  
  // Test message deduplication first
  console.log('📋 Testing Message Deduplication...');
  await simulateWebhook("Test deduplication", 0);
  await simulateWebhook("Test deduplication", 0); // Same message again
  console.log('\n');
  
  // Wait a bit before starting the main flow
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Run through all 7 steps
  for (let i = 0; i < conversationSteps.length; i++) {
    const step = conversationSteps[i];
    await simulateWebhook(step.message, i);
    
    // Wait between steps to simulate real conversation
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Full Flow Test Complete!\n');
  
  // Final verification
  console.log('🔍 Final Conversation State:');
  const finalState = await conversationManager.getConversationState(
    TEST_CONTACT_ID,
    null,
    TEST_PHONE
  );
  
  console.log({
    totalMessages: finalState.messageCount,
    qualificationComplete: !!(finalState.leadName && finalState.leadProblem && 
                            finalState.leadGoal && finalState.leadBudget && 
                            finalState.leadEmail),
    appointmentScheduled: finalState.appointmentScheduled,
    tags: finalState.ghlTags
  });
  
  // Check if messages were properly filtered
  console.log('\n📝 Message History Quality Check:');
  console.log(`- Total messages: ${finalState.messages.length}`);
  console.log(`- Human messages: ${finalState.messages.filter(m => m._getType() === 'human').length}`);
  console.log(`- AI messages: ${finalState.messages.filter(m => m._getType() === 'ai').length}`);
  
  // Check for tool response contamination
  const contaminatedMessages = finalState.messages.filter(m => 
    m.content.includes('"success":') || 
    m.content.includes('"timestamp":') ||
    m.content.startsWith('{')
  );
  
  if (contaminatedMessages.length > 0) {
    console.log(`⚠️  Found ${contaminatedMessages.length} contaminated messages (tool responses in history)`);
  } else {
    console.log('✅ No tool response contamination detected!');
  }
}

// Run the test
runFullFlowTest().catch(console.error);