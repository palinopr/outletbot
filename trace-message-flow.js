console.log('🔍 TRACING GHL MESSAGE FLOW');
console.log('==========================\n');

console.log('📊 MESSAGE SENDING ARCHITECTURE:\n');

console.log('1️⃣ WEBHOOK RECEIVES MESSAGE');
console.log('   webhookHandler.js → webhookHandlerNode()');
console.log('   - Extracts: phone, message, contactId');
console.log('   - Creates: HumanMessage object\n');

console.log('2️⃣ SALES AGENT INVOKED');
console.log('   salesAgent.js → salesAgentInvoke()');
console.log('   - Receives: messages array with conversation');
console.log('   - System prompt: "NEVER respond directly - ONLY use send_ghl_message tool"\n');

console.log('3️⃣ AGENT USES TOOLS');
console.log('   Tool execution order:');
console.log('   a) extractLeadInfo → Analyzes customer message');
console.log('   b) sendGHLMessage → Sends response to customer');
console.log('   c) updateGHLContact → Updates tags/notes\n');

console.log('4️⃣ sendGHLMessage TOOL EXECUTION');
console.log('   ```javascript');
console.log('   // salesAgent.js line 692');
console.log('   await ghlService.sendSMS(contactId, message);');
console.log('   ```\n');

console.log('5️⃣ GHL SERVICE SENDS MESSAGE');
console.log('   ghlService.js → sendSMS()');
console.log('   - Endpoint: POST /conversations/messages');
console.log('   - Payload:');
console.log('   ```javascript');
console.log('   {');
console.log('     type: "WhatsApp",');
console.log('     contactId: contactId,');
console.log('     message: message');
console.log('   }');
console.log('   ```\n');

console.log('📝 CRITICAL POINTS TO VERIFY:\n');

console.log('1. Check LangSmith trace for tool calls:');
console.log('   - Look for "sendGHLMessage" tool being called');
console.log('   - Verify the message content passed to the tool');
console.log('   - Check if tool returns success\n');

console.log('2. Check application logs for:');
console.log('   - "📤 SEND GHL MESSAGE START"');
console.log('   - "✅ MESSAGE SENT SUCCESSFULLY"');
console.log('   - Any error messages\n');

console.log('3. Check GHL conversation:');
console.log('   - Login to GHL');
console.log('   - Go to contact: 54sJIGTtwmR89Qc5JeEt');
console.log('   - Check conversation history');
console.log('   - Verify WhatsApp messages appear\n');

console.log('⚠️  COMMON ISSUES:\n');

console.log('1. ❌ Tool not called:');
console.log('   - Agent might be returning direct response');
console.log('   - Check system prompt enforcement\n');

console.log('2. ❌ Message sent but not visible:');
console.log('   - Wrong conversation type (SMS vs WhatsApp)');
console.log('   - Contact not properly linked to WhatsApp\n');

console.log('3. ❌ API error:');
console.log('   - Invalid contactId');
console.log('   - WhatsApp not configured in location');
console.log('   - Rate limiting\n');

console.log('🧪 MANUAL TEST STEPS:\n');
console.log('1. Send webhook with test message');
console.log('2. Watch logs for tool execution');
console.log('3. Check LangSmith for tool calls');
console.log('4. Verify message in GHL conversation');
console.log('5. If no message, check error logs\n');

console.log('📊 EXPECTED LOG SEQUENCE:\n');
console.log('1. 🔍 WEBHOOK HANDLER START');
console.log('2. 🤖 INVOKING SALES AGENT');
console.log('3. 🔍 EXTRACT LEAD INFO START');
console.log('4. 📤 SEND GHL MESSAGE START');
console.log('5. ✅ MESSAGE SENT SUCCESSFULLY');
console.log('6. ✅ WEBHOOK PROCESSED SUCCESSFULLY');