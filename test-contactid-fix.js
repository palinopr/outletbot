import { graph as salesAgent } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';

dotenv.config();

async function testContactIdFix() {
  console.log('🧪 Testing ContactID Fix\n');
  
  // Test with the actual contactId from the failed trace
  const testContactId = 'hhPgNekEeyLG0Vkv7d3N';
  
  console.log(`Testing with contactId: ${testContactId}\n`);
  
  try {
    const result = await salesAgent.invoke({
      messages: [new HumanMessage('hola')],
      contactId: testContactId,
      conversationId: 'test-conv-123'
    }, {
      configurable: {
        contactId: testContactId,
        ghlService: {
          sendSMS: async (contactId, message) => {
            console.log('📱 TOOL CALL: send_ghl_message');
            console.log(`   ContactID Used: ${contactId}`);
            console.log(`   Expected: ${testContactId}`);
            console.log(`   Match: ${contactId === testContactId ? '✅ CORRECT!' : '❌ WRONG!'}`);
            console.log(`   Message: "${message}"\n`);
            
            if (contactId !== testContactId) {
              throw new Error(`Wrong contactId! Expected ${testContactId}, got ${contactId}`);
            }
            
            return { success: true };
          }
        }
      }
    });
    
    console.log('✅ Test passed! Agent used correct contactId');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testContactIdFix();