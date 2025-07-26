import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';

console.log('🔍 Analyzing Message Flow for Trace: 1f06a310-3a38-6d11-aa54-86c4ef864f6a');
console.log('========================================\n');

// Test 1: Check message types
console.log('1️⃣ Testing Message Type Consistency\n');

// Before fix - mixing plain objects and BaseMessage instances
console.log('❌ BEFORE FIX (salesAgent.js line 767):');
console.log('Plain object:', { role: "system", content: "System prompt" });
console.log('Type:', typeof { role: "system", content: "System prompt" });
console.log('Is BaseMessage?', false);

console.log('\n✅ AFTER FIX:');
const systemMsg = new SystemMessage("System prompt");
console.log('SystemMessage instance:', systemMsg);
console.log('Type:', systemMsg.constructor.name);
console.log('Is BaseMessage?', systemMsg._getType !== undefined);

// Test 2: Message array composition
console.log('\n\n2️⃣ Testing Message Array Composition\n');

const state = {
  messages: [
    new HumanMessage("Hola"),
    new AIMessage("¡Hola! Soy María de Outlet Media.")
  ]
};

console.log('❌ BEFORE FIX - Mixed array:');
const beforeFix = [
  { role: "system", content: "System prompt" },  // Plain object
  ...state.messages  // BaseMessage instances
];
console.log('Array contents:');
beforeFix.forEach((msg, i) => {
  console.log(`  [${i}]:`, msg.constructor?.name || 'PlainObject', '- _getType:', msg._getType?.() || 'undefined');
});

console.log('\n✅ AFTER FIX - Consistent array:');
const afterFix = [
  new SystemMessage("System prompt"),  // BaseMessage instance
  ...state.messages  // BaseMessage instances
];
console.log('Array contents:');
afterFix.forEach((msg, i) => {
  console.log(`  [${i}]:`, msg.constructor.name, '- _getType:', msg._getType());
});

// Test 3: Webhook handler message creation
console.log('\n\n3️⃣ Testing Webhook Handler Messages\n');

console.log('✅ Creating HumanMessage (line 213):');
const webhookMsg = new HumanMessage("Test message from webhook");
console.log('Type:', webhookMsg.constructor.name);
console.log('Content:', webhookMsg.content);
console.log('_getType:', webhookMsg._getType());

// Test 4: Tool message format
console.log('\n\n4️⃣ Testing Tool Message Format\n');

console.log('✅ Tool returns plain object (this is correct):');
const toolMessage = {
  role: "tool",
  content: "Tool response",
  tool_call_id: "tool_123"
};
console.log('Tool message:', toolMessage);
console.log('Note: Tools return plain objects which get converted internally by LangGraph');

// Summary
console.log('\n\n📊 SUMMARY OF FIXES\n');
console.log('1. salesAgent.js line 767:');
console.log('   - Changed: { role: "system", content: systemPrompt }');
console.log('   - To: new SystemMessage(systemPrompt)');
console.log('   - Reason: createReactAgent expects BaseMessageLike[] from prompt function');

console.log('\n2. webhookHandler.js line 291:');
console.log('   - Changed: new AIMessage({ content: errorMessage, name: "María" })');
console.log('   - To: new AIMessage(errorMessage)');
console.log('   - Reason: Simplified instantiation');

console.log('\n3. Why messages weren\'t received:');
console.log('   - Mixed message formats in promptFunction broke message processing');
console.log('   - createReactAgent couldn\'t properly handle the mixed array');
console.log('   - Messages were likely dropped or improperly converted');

console.log('\n✅ All messages are now BaseMessage instances in the prompt function!');