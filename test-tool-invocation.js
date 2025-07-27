#!/usr/bin/env node
/**
 * Test tool invocation in sales agent
 * Verifies that tools receive ghlService properly
 */

import { exportedTools } from './agents/salesAgent.js';

// Mock config object similar to what tools receive
const mockConfig = {
  configurable: {
    ghlService: {
      sendSMS: async (contactId, message) => {
        console.log('✅ GHL sendSMS called successfully!');
        console.log(`   Contact: ${contactId}`);
        console.log(`   Message: ${message.substring(0, 50)}...`);
        return { success: true };
      }
    },
    contactId: 'test-123',
    __pregel_scratchpad: {
      currentTaskInput: {
        contactId: 'test-123',
        leadInfo: { name: 'Test User' }
      }
    }
  }
};

async function testSendGHLMessage() {
  console.log('Testing sendGHLMessage tool...\n');
  
  try {
    const result = await exportedTools.sendGHLMessage.invoke(
      { message: 'Hola! Soy María de Outlet Media' },
      mockConfig
    );
    
    console.log('\nTool returned:', result);
    console.log('\n✅ sendGHLMessage tool test PASSED');
    return true;
  } catch (error) {
    console.error('\n❌ sendGHLMessage tool test FAILED:', error.message);
    return false;
  }
}

async function testWithAlternativeConfig() {
  console.log('\n\nTesting with alternative config structure...\n');
  
  // Test config where ghlService is at root
  const altConfig = {
    ghlService: {
      sendSMS: async (contactId, message) => {
        console.log('✅ GHL sendSMS called (from root config)!');
        return { success: true };
      }
    },
    configurable: {
      contactId: 'test-456',
      __pregel_scratchpad: {
        currentTaskInput: {
          contactId: 'test-456'
        }
      }
    }
  };
  
  try {
    const result = await exportedTools.sendGHLMessage.invoke(
      { message: 'Test message' },
      altConfig
    );
    
    console.log('\n✅ Alternative config test PASSED');
    return true;
  } catch (error) {
    console.error('\n❌ Alternative config test FAILED:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Tool Invocation Test\n');
  
  const test1 = await testSendGHLMessage();
  const test2 = await testWithAlternativeConfig();
  
  console.log('\n' + '='.repeat(50));
  console.log('RESULTS:');
  console.log(`Standard config: ${test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Alternative config: ${test2 ? '✅ PASS' : '❌ FAIL'}`);
  
  if (test1 && test2) {
    console.log('\n🎉 All tests passed! Tools can access ghlService correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. The fix may need adjustment.');
  }
}

runTests().catch(console.error);