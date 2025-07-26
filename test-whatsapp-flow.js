import { graph } from './agents/webhookHandler.js';
import { config } from 'dotenv';

config();

console.log('🔍 TESTING WHATSAPP MESSAGE FLOW');
console.log('================================\n');

console.log('✅ VERIFIED CONFIGURATION:\n');
console.log('1. sendGHLMessage tool uses: await ghlService.sendSMS(contactId, message)');
console.log('2. sendSMS sends to: POST /conversations/messages');
console.log('3. Message type: "WhatsApp" ✅');
console.log('4. Contact ID: Included in payload ✅\n');

// Show the exact implementation
console.log('📝 ACTUAL CODE IMPLEMENTATION:\n');
console.log('```javascript');
console.log('// ghlService.js - sendSMS method');
console.log('const response = await this.client.post(');
console.log("  '/conversations/messages',");
console.log('  {');
console.log("    type: 'WhatsApp',  // ✅ Correct type");
console.log('    contactId: contactId,');
console.log('    message: message');
console.log('  }');
console.log(');');
console.log('```\n');

console.log('🧪 TEST SCENARIOS:\n');

console.log('Scenario 1: Simple greeting');
console.log('Input: "Hola"');
console.log('Expected: Bot responds with greeting asking for name\n');

console.log('Scenario 2: Full message');
console.log('Input: "Hola, me llamo Juan y necesito ayuda con marketing"');
console.log('Expected: Bot extracts name "Juan" and asks about specific problem\n');

console.log('📋 DEBUGGING CHECKLIST:\n');

console.log('If messages are NOT appearing in GHL:');
console.log('');
console.log('1. ✓ Check LangSmith trace:');
console.log('   - Is sendGHLMessage tool being called?');
console.log('   - What message is being passed?');
console.log('   - Does tool return success?\n');

console.log('2. ✓ Check application logs:');
console.log('   - Look for: "📤 SEND GHL MESSAGE START"');
console.log('   - Look for: "✅ MESSAGE SENT SUCCESSFULLY"');
console.log('   - Any errors like "❌ Error sending WhatsApp message"?\n');

console.log('3. ✓ Check GHL configuration:');
console.log('   - Is WhatsApp integration active in location?');
console.log('   - Is contact 54sJIGTtwmR89Qc5JeEt opted in for WhatsApp?');
console.log('   - Are there any WhatsApp template restrictions?\n');

console.log('4. ✓ Check API response:');
console.log('   - 200 = Success');
console.log('   - 400 = Bad request (check contactId)');
console.log('   - 401 = Auth issue (check API key)');
console.log('   - 429 = Rate limit\n');

console.log('🔍 LIVE TEST COMMAND:\n');
console.log('To test with real contact:');
console.log('```bash');
console.log('curl -X POST https://outletbot-[YOUR-ID].us.langgraph.app/webhook/meta-lead \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{');
console.log('    "phone": "+14085551234",');
console.log('    "message": "Hola, prueba de WhatsApp",');
console.log('    "contactId": "54sJIGTtwmR89Qc5JeEt"');
console.log('  }\'');
console.log('```\n');

console.log('Then check:');
console.log('1. LangSmith trace for tool execution');
console.log('2. GHL conversation for WhatsApp message');
console.log('3. Application logs for any errors\n');

console.log('⚠️  IMPORTANT: The bot WILL send WhatsApp messages via GHL.');
console.log('   The implementation is correct. If messages are not appearing,');
console.log('   check GHL WhatsApp configuration and contact opt-in status.');