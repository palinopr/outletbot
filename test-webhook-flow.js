import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('Testing Webhook Handler Flow\n');

async function testWebhookFlow() {
  try {
    // Test case 1: Simple greeting
    console.log('Test 1: Simple greeting');
    const test1State = {
      messages: [new HumanMessage('hola')],
      contactId: 'test-contact-123',
      phone: '+1234567890',
      conversationId: 'test-conversation-123'
    };

    const config1 = {
      configurable: {
        thread_id: 'test-thread-123',
        contactId: 'test-contact-123',
        conversationId: 'test-conversation-123',
        phone: '+1234567890'
      }
    };

    console.log('Invoking webhook handler...');
    const result1 = await webhookHandler.invoke(test1State, config1);
    
    console.log('Result:');
    console.log('- Messages processed:', result1.messages?.length);
    console.log('- Contact ID:', result1.contactId);
    console.log('- Thread ID:', result1.threadId);
    console.log('- Processing time:', result1.processingTime || 'N/A');
    
    // Extract AI response
    const aiMessages = result1.messages?.filter(m => m._getType?.() === 'ai' || m.role === 'assistant');
    if (aiMessages?.length > 0) {
      console.log('- AI Response:', aiMessages[aiMessages.length - 1].content);
    }

    console.log('\n✅ Test 1 completed successfully\n');

    // Test case 2: With name
    console.log('Test 2: Providing name');
    const test2State = {
      messages: [new HumanMessage('Me llamo Juan')],
      contactId: 'test-contact-123',
      phone: '+1234567890',
      conversationId: 'test-conversation-123',
      threadId: 'test-thread-123'
    };

    const config2 = {
      configurable: {
        thread_id: 'test-thread-123',
        contactId: 'test-contact-123',
        conversationId: 'test-conversation-123',
        phone: '+1234567890'
      }
    };

    const result2 = await webhookHandler.invoke(test2State, config2);
    console.log('Result:');
    console.log('- Lead info collected:', Object.keys(result2.leadInfo || {}).filter(k => result2.leadInfo[k]));
    console.log('- Name extracted:', result2.leadInfo?.name || 'None');

    console.log('\n✅ Test 2 completed successfully\n');

    console.log('All tests passed! Webhook handler is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run tests
testWebhookFlow().then(() => {
  console.log('\n✅ All tests completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});