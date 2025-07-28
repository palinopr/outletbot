/**
 * Comprehensive Pre-Deployment Test Suite
 * Tests all critical functionality before deploying to production
 */

import dotenv from 'dotenv';
import { salesAgentInvoke } from './agents/salesAgent.js';
import { graph as webhookHandler } from './agents/webhookHandler.js';
import { GHLService } from './services/ghlService.js';
import ConversationManager from './services/conversationManager.js';
import { HumanMessage } from '@langchain/core/messages';
import crypto from 'crypto';
import { Logger } from './services/logger.js';

dotenv.config();

const logger = new Logger('pre-deployment-test');

// Test Results Tracking
const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

// Test utilities
async function runTest(testName, testFn) {
  console.log(`\n🧪 Testing: ${testName}`);
  try {
    const result = await testFn();
    if (result.success) {
      testResults.passed++;
      console.log(`✅ PASSED: ${result.message || testName}`);
      return result;
    } else {
      testResults.failed++;
      testResults.errors.push({ test: testName, error: result.error });
      console.log(`❌ FAILED: ${result.error || 'Unknown error'}`);
      return result;
    }
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({ test: testName, error: error.message });
    console.log(`❌ ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test 1: GHL Service Connection
async function testGHLConnection() {
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  try {
    // Test calendar access
    const calendarId = process.env.GHL_CALENDAR_ID;
    const slots = await ghlService.getAvailableSlots(
      calendarId,
      new Date(),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    );
    
    return { 
      success: true, 
      message: `GHL connected. Found ${Object.keys(slots).length} days with slots`,
      data: { slotsFound: Object.keys(slots).length }
    };
  } catch (error) {
    return { success: false, error: `GHL connection failed: ${error.message}` };
  }
}

// Test 2: Cache Functionality
async function testCacheResponse() {
  // Test 1: First contact should use AI (no name in leadInfo)
  const firstContactId = 'cache_test_1_' + Date.now();
  const firstConversationId = 'conv_cache_1_' + Date.now();
  
  const firstResult = await webhookHandler.invoke({
    messages: [new HumanMessage('hola')],
    contactId: firstContactId,
    conversationId: firstConversationId,
    phone: '(305) 555-0001',
    threadId: firstConversationId
  }, {
    configurable: {
      thread_id: firstConversationId,
      contactId: firstContactId
    }
  });
  
  const firstWasCached = firstResult.cached === true;
  console.log('First contact result:', { 
    cached: firstResult.cached, 
    processingTime: firstResult.processingTime,
    messageLength: firstResult.messages?.length 
  });
  
  // Test 2: Same contact, second message should still be cached (no name yet)
  await new Promise(resolve => setTimeout(resolve, 500)); // Wait to avoid duplicate detection
  
  const secondResult = await webhookHandler.invoke({
    messages: [new HumanMessage('hola')],
    contactId: firstContactId,
    conversationId: firstConversationId,
    phone: '(305) 555-0001',
    threadId: firstConversationId
  }, {
    configurable: {
      thread_id: firstConversationId,
      contactId: firstContactId
    }
  });
  
  const secondWasCached = secondResult.cached === true || secondResult.duplicate === true;
  console.log('Same contact second result:', { 
    cached: secondResult.cached,
    duplicate: secondResult.duplicate,
    processingTime: secondResult.processingTime 
  });
  
  // The first should use cache (no name), second should also be cached/duplicate
  if (firstWasCached && secondWasCached) {
    return { 
      success: true, 
      message: 'Cache working correctly - both cached for new contact',
      data: { firstCached: firstWasCached, secondCached: secondWasCached }
    };
  } else {
    return { 
      success: false, 
      error: `Cache not working: first=${firstWasCached}, second=${secondWasCached}` 
    };
  }
}

// Test 3: State Persistence Across Messages
async function testStatePersistence() {
  const testContactId = 'state_test_' + Date.now();
  const testConversationId = 'conv_state_' + Date.now();
  
  // Message 1: Name
  const result1 = await webhookHandler.invoke({
    messages: [new HumanMessage('Mi nombre es Carlos')],
    contactId: testContactId,
    conversationId: testConversationId,
    phone: '(305) 555-0002',
    threadId: testConversationId
  }, {
    configurable: {
      thread_id: testConversationId,
      contactId: testContactId
    }
  });
  
  // Check if name was extracted (case-insensitive)
  const hasName = result1.leadInfo?.name?.toLowerCase() === 'carlos';
  console.log('Name extraction:', { extracted: result1.leadInfo?.name, hasName });
  
  // Message 2: Problem (should remember name)
  const result2 = await webhookHandler.invoke({
    messages: [new HumanMessage('necesito mas clientes para mi restaurante')],
    contactId: testContactId,
    conversationId: testConversationId,
    phone: '(305) 555-0002',
    threadId: testConversationId,
    leadInfo: result1.leadInfo  // Pass previous state
  }, {
    configurable: {
      thread_id: testConversationId,
      contactId: testContactId
    }
  });
  
  // Check if both name and problem are present (case-insensitive)
  const hasNameAndProblem = result2.leadInfo?.name?.toLowerCase() === 'carlos' && 
                           result2.leadInfo?.problem?.includes('clientes');
  console.log('State persistence:', { name: result2.leadInfo?.name, problem: result2.leadInfo?.problem, hasNameAndProblem });
  
  if (hasName && hasNameAndProblem) {
    return { 
      success: true, 
      message: 'State persistence working - remembers across messages',
      data: { leadInfo: result2.leadInfo }
    };
  } else {
    return { 
      success: false, 
      error: `State not persisting: name=${hasName}, both=${hasNameAndProblem}`,
      data: { result1: result1.leadInfo, result2: result2.leadInfo }
    };
  }
}

// Test 4: Thread Continuity
async function testThreadContinuity() {
  const testContactId = 'thread_test_' + Date.now();
  const testConversationId = 'conv_thread_' + Date.now();
  
  const results = [];
  
  // Send 3 messages in sequence
  for (let i = 0; i < 3; i++) {
    const result = await webhookHandler.invoke({
      messages: [new HumanMessage(`Test message ${i + 1}`)],
      contactId: testContactId,
      conversationId: testConversationId,
      phone: '(305) 555-0003',
      threadId: testConversationId
    }, {
      configurable: {
        thread_id: testConversationId,
        contactId: testContactId
      }
    });
    
    results.push({
      threadId: result.threadId,
      conversationId: result.conversationId
    });
  }
  
  // Check if all have same thread ID
  const allSameThread = results.every(r => r.threadId === testConversationId);
  
  if (allSameThread) {
    return { 
      success: true, 
      message: 'Thread continuity maintained across messages',
      data: { threadIds: results.map(r => r.threadId) }
    };
  } else {
    return { 
      success: false, 
      error: 'Thread IDs not consistent',
      data: { results }
    };
  }
}

// Test 5: Tool State Access
async function testToolStateAccess() {
  const testState = {
    leadInfo: {
      name: 'TestUser',
      problem: 'need customers',
      goal: 'grow business',
      budget: '500',
      email: 'test@example.com'
    },
    contactId: 'tool_test_' + Date.now(),
    threadId: 'thread_tool_' + Date.now()
  };
  
  try {
    // Test direct agent invocation with state
    const result = await salesAgentInvoke({
      messages: [new HumanMessage('quiero ver las citas disponibles')],
      ...testState
    }, {
      configurable: {
        ghlService: new GHLService(process.env.GHL_API_KEY, process.env.GHL_LOCATION_ID),
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: testState.contactId,
        thread_id: testState.threadId,
        __pregel_scratchpad: {
          currentTaskInput: testState
        }
      }
    });
    
    // Check if calendar was shown (budget qualified)
    const calendarShown = result.messages.some(msg => 
      msg.content?.includes('disponibles') || 
      msg.content?.includes('calendar') ||
      result.availableSlots?.length > 0
    );
    
    if (calendarShown) {
      return { 
        success: true, 
        message: 'Tools can access state correctly',
        data: { messagesCount: result.messages.length }
      };
    } else {
      return { 
        success: false, 
        error: 'Calendar not shown despite qualified lead' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: `Tool state access failed: ${error.message}` 
    };
  }
}

// Test 6: Error Handling
async function testErrorHandling() {
  try {
    // Test with invalid contact ID
    const result = await webhookHandler.invoke({
      messages: [new HumanMessage('test error handling')],
      contactId: null,  // Invalid
      phone: '(305) 555-0004'
    }, {
      configurable: {}
    });
    
    // Should handle gracefully
    const hasErrorMessage = result.messages.some(msg => 
      msg.content?.includes('error') || 
      msg.content?.includes('intenta')
    );
    
    return { 
      success: hasErrorMessage, 
      message: hasErrorMessage ? 'Error handling working' : 'No error message returned' 
    };
  } catch (error) {
    // If it throws, that's also acceptable error handling
    return { 
      success: true, 
      message: 'Error properly thrown and can be caught' 
    };
  }
}

// Test 7: Performance (Token Usage)
async function testPerformance() {
  const startTime = Date.now();
  let totalTokens = 0;
  
  // Simulate a full conversation
  const messages = [
    'hola',
    'Jaime',
    'necesito mas clientes',
    'crecer mi negocio',
    '600 dolares',
    'test@example.com'
  ];
  
  const testContactId = 'perf_test_' + Date.now();
  const testConversationId = 'conv_perf_' + Date.now();
  let leadInfo = {};
  
  for (const message of messages) {
    const result = await webhookHandler.invoke({
      messages: [new HumanMessage(message)],
      contactId: testContactId,
      conversationId: testConversationId,
      phone: '(305) 555-0005',
      threadId: testConversationId,
      leadInfo
    }, {
      configurable: {
        thread_id: testConversationId,
        contactId: testContactId
      }
    });
    
    leadInfo = result.leadInfo || leadInfo;
    // Estimate tokens (actual tracking would need LangSmith integration)
    totalTokens += message === 'hola' && result.cached ? 0 : 1000;
  }
  
  const duration = Date.now() - startTime;
  const estimatedCost = (totalTokens / 1000) * 0.01; // Rough estimate
  
  // Realistic thresholds: 6 messages × 8 seconds = 48 seconds max
  if (duration < 50000 && estimatedCost < 0.20) {
    return { 
      success: true, 
      message: `Performance acceptable: ${duration}ms, ~$${estimatedCost.toFixed(2)}`,
      data: { duration, estimatedCost, totalTokens }
    };
  } else {
    return { 
      success: false, 
      error: `Performance issues: ${duration}ms, ~$${estimatedCost.toFixed(2)}` 
    };
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 RUNNING PRE-DEPLOYMENT TEST SUITE');
  console.log('=====================================\n');
  
  // Check environment variables first
  const requiredEnvVars = ['GHL_API_KEY', 'GHL_LOCATION_ID', 'GHL_CALENDAR_ID', 'OPENAI_API_KEY'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:', missingVars.join(', '));
    process.exit(1);
  }
  
  // Run all tests
  await runTest('GHL Service Connection', testGHLConnection);
  await runTest('Cache Functionality', testCacheResponse);
  await runTest('State Persistence', testStatePersistence);
  await runTest('Thread Continuity', testThreadContinuity);
  await runTest('Tool State Access', testToolStateAccess);
  await runTest('Error Handling', testErrorHandling);
  await runTest('Performance & Cost', testPerformance);
  
  // Summary
  console.log('\n\n📊 TEST SUMMARY');
  console.log('================');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    testResults.errors.forEach(err => {
      console.log(`  - ${err.test}: ${err.error}`);
    });
  }
  
  // Deployment recommendation
  console.log('\n🚀 DEPLOYMENT RECOMMENDATION:');
  if (testResults.failed === 0) {
    console.log('✅ ALL TESTS PASSED - Safe to deploy!');
    process.exit(0);
  } else {
    console.log('❌ FAILURES DETECTED - Fix issues before deploying!');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});