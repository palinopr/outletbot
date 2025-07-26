// Debug Analysis for Trace: 1f06a310-3a38-6d11-aa54-86c4ef864f6a
// Contact: 54sJIGTtwmR89Qc5JeEt (Real GHL contact)

console.log('🔍 DEBUGGING TRACE: 1f06a310-3a38-6d11-aa54-86c4ef864f6a');
console.log('=================================================\n');

console.log('To debug this trace, we need to check:\n');

console.log('1. WHAT TO LOOK FOR IN LANGSMITH TRACE:');
console.log('   - Last successful log before failure');
console.log('   - Which tool/function was being called');
console.log('   - Any timeout errors');
console.log('   - Tool call patterns (loops?)');
console.log('   - Message content that might cause issues\n');

console.log('2. CRITICAL CHECKPOINTS TO VERIFY:');
console.log('   ✓ Did webhook receive the message?');
console.log('   ✓ Did it extract phone/contactId/message?');
console.log('   ✓ Did conversation manager return state?');
console.log('   ✓ Did sales agent get invoked?');
console.log('   ✓ Which tools were called?');
console.log('   ✓ Did sendGHLMessage complete?\n');

console.log('3. COMMON STUCK POINTS:');
console.log('   a) conversationManager.getConversationState()');
console.log('      - GHL API timeout fetching conversation');
console.log('      - GHL API timeout fetching messages');
console.log('   b) salesAgent.invoke()');
console.log('      - LLM timeout (GPT-4 slow response)');
console.log('      - Tool execution loop');
console.log('   c) ghlService.sendSMS()');
console.log('      - WhatsApp API timeout\n');

console.log('4. DEBUGGING STEPS:');
console.log('   Step 1: Open https://smith.langchain.com/public/1f06a310-3a38-6d11-aa54-86c4ef864f6a/r');
console.log('   Step 2: Look for the LAST log entry');
console.log('   Step 3: Check if any tools are called repeatedly');
console.log('   Step 4: Look for timeout errors or long gaps between logs');
console.log('   Step 5: Check the message content for special characters\n');

console.log('5. BASED ON THE PATTERN:');
console.log('   - If stuck after "FETCHING CONVERSATION STATE" → GHL API issue');
console.log('   - If stuck after "INVOKING SALES AGENT" → LLM or tool issue');
console.log('   - If stuck in tool calls → Infinite loop in agent logic');
console.log('   - If no logs at all → Webhook not reaching handler\n');

console.log('6. QUICK TEST TO ISOLATE THE ISSUE:');

// Test function to check each component
async function debugComponents() {
  const contactId = '54sJIGTtwmR89Qc5JeEt';
  
  console.log('\nTesting GHL Service...');
  try {
    const { GHLService } = await import('./services/ghlService.js');
    const ghl = new GHLService(process.env.GHL_API_KEY, process.env.GHL_LOCATION_ID);
    
    // Test 1: Get contact
    console.time('getContact');
    const contact = await ghl.getContact(contactId);
    console.timeEnd('getContact');
    console.log('✓ Contact fetched:', contact?.firstName || 'Unknown');
    
    // Test 2: Get conversation
    console.time('getConversation');
    const conv = await ghl.getOrCreateConversation(contactId, '+14085551234');
    console.timeEnd('getConversation');
    console.log('✓ Conversation:', conv?.id);
    
    // Test 3: Get messages
    if (conv?.id) {
      console.time('getMessages');
      const messages = await ghl.getConversationMessages(conv.id);
      console.timeEnd('getMessages');
      console.log('✓ Messages:', messages.length);
    }
  } catch (error) {
    console.error('✗ GHL Error:', error.message);
  }
  
  console.log('\nTesting OpenAI...');
  try {
    const { ChatOpenAI } = await import('@langchain/openai');
    const llm = new ChatOpenAI({ model: 'gpt-4', timeout: 5000 });
    
    console.time('llmInvoke');
    await llm.invoke([{ role: 'system', content: 'Reply OK' }]);
    console.timeEnd('llmInvoke');
    console.log('✓ LLM working');
  } catch (error) {
    console.error('✗ LLM Error:', error.message);
  }
}

// Uncomment to run debug
// debugComponents().catch(console.error);

console.log('\n7. SPECIFIC ISSUES TO CHECK:');
console.log('   - Is the message in Spanish with special chars (ñ, á, é)?');
console.log('   - Is the contact ID valid in GHL?');
console.log('   - Are there rate limits being hit?');
console.log('   - Is the LangGraph platform having issues?');

console.log('\n8. IMMEDIATE ACTION:');
console.log('   Check the LangSmith trace NOW to see the last operation');
console.log('   before the timeout. That will tell us exactly where it\'s stuck.');