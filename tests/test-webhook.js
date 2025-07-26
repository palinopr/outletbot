#!/usr/bin/env node
/**
 * Consolidated webhook handler tests
 * Supports both simple and advanced testing modes
 */

import 'dotenv/config';
import { graph } from '../agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';

const TEST_MODES = {
  SIMPLE: 'simple',
  REAL: 'real',
  CUSTOM: 'custom'
};

/**
 * Test configurations for different scenarios
 */
const TEST_CONFIGS = {
  [TEST_MODES.SIMPLE]: {
    name: '🧪 Simple Webhook Test',
    data: {
      phone: '+12145551234',
      message: 'hola',
      contactId: 'test-contact-001'
    }
  },
  [TEST_MODES.REAL]: {
    name: '🔬 Real Contact Webhook Test',
    data: {
      phone: '+12103593819',
      message: 'hola',
      contactId: '8eSdb9ZDsXDem9wlED9u' // Real contact ID from tests
    },
    config: {
      recursionLimit: 30
    }
  }
};

/**
 * Run webhook test with specified configuration
 * @param {string} mode - Test mode (simple, real, or custom)
 * @param {Object} customData - Custom test data (for custom mode)
 */
async function testWebhook(mode = TEST_MODES.SIMPLE, customData = null) {
  const testConfig = mode === TEST_MODES.CUSTOM 
    ? { name: '🎯 Custom Webhook Test', data: customData }
    : TEST_CONFIGS[mode];
    
  if (!testConfig) {
    console.error(`❌ Invalid test mode: ${mode}`);
    console.log(`Available modes: ${Object.values(TEST_MODES).join(', ')}`);
    return;
  }
  
  console.log(`${testConfig.name}\n`);
  console.log('Configuration:', JSON.stringify(testConfig.data, null, 2), '\n');
  
  const webhookData = testConfig.data;
  
  try {
    // Prepare input following MessagesAnnotation pattern
    const input = {
      messages: [new HumanMessage({
        content: JSON.stringify(webhookData)
      })],
      contactId: webhookData.contactId,
      phone: webhookData.phone
    };
    
    console.log('Invoking webhook handler...');
    
    // Build configuration
    const invokeConfig = {
      configurable: {
        contactId: webhookData.contactId,
        phone: webhookData.phone
      },
      ...(testConfig.config || {})
    };
    
    // Invoke the graph
    const startTime = Date.now();
    const result = await graph.invoke(input, invokeConfig);
    const duration = Date.now() - startTime;
    
    console.log(`\n⏱️  Completed in ${duration}ms`);
    
    // Analyze results
    if (result.messages && result.messages.length > 0) {
      console.log('\n✅ Success - Got messages back');
      console.log(`Total messages: ${result.messages.length}`);
      
      const assistantMessages = result.messages.filter(m => m.role === 'assistant');
      console.log(`Assistant messages: ${assistantMessages.length}`);
      
      if (assistantMessages.length > 0) {
        console.log('\nLast assistant message:');
        console.log(assistantMessages[assistantMessages.length - 1].content);
      }
      
      // Show state info if available
      if (result.leadInfo) {
        console.log('\nLead Info:', result.leadInfo);
      }
      
      if (result.currentStep) {
        console.log('Current Step:', result.currentStep);
      }
    } else {
      console.log('\n❌ No messages returned');
    }
    
    // Detailed result for debugging
    if (process.env.DEBUG) {
      console.log('\nFull Result:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
  }
}

// CLI handling
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const mode = args[0] || TEST_MODES.SIMPLE;
  
  if (mode === TEST_MODES.CUSTOM) {
    // Parse custom data from command line
    if (args.length < 4) {
      console.error('❌ Custom mode requires: phone, message, and contactId');
      console.log('Usage: node test-webhook.js custom <phone> <message> <contactId>');
      process.exit(1);
    }
    
    const customData = {
      phone: args[1],
      message: args[2],
      contactId: args[3]
    };
    
    testWebhook(TEST_MODES.CUSTOM, customData);
  } else {
    testWebhook(mode);
  }
}

// Export for use in other tests
export { testWebhook, TEST_MODES };