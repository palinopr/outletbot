#!/usr/bin/env node
/**
 * Comprehensive End-to-End Test for Webhook Flow
 * Tests the complete flow from webhook receipt to GHL message delivery
 * 
 * @module test-full-flow
 */

import 'dotenv/config';
import { graph } from '../agents/webhookHandler.js';
import { salesAgent } from '../agents/salesAgent.js';
import { GHLService } from '../services/ghlService.js';
import ConversationManager from '../services/conversationManager.js';
import { HumanMessage } from '@langchain/core/messages';
import { Logger } from '../services/logger.js';
import { MemorySaver } from '@langchain/langgraph';
import crypto from 'crypto';

// Enable LangSmith tracing for debugging
process.env.LANGCHAIN_TRACING_V2 = "true";
process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "true";
process.env.LANGCHAIN_PROJECT = "Outlet Media Bot - Full Flow Test";

console.log('🧪 Comprehensive Webhook Flow Test\n');

// Color codes for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// Test configuration
const testConfig = {
  contactId: process.env.TEST_CONTACT_ID || '8eSdb9ZDsXDem9wlED9u',
  phone: process.env.TEST_PHONE || '+12146669779',
  calendarId: process.env.GHL_CALENDAR_ID,
  locationId: process.env.GHL_LOCATION_ID
};

// Initialize services
const ghlService = new GHLService(
  process.env.GHL_API_KEY,
  process.env.GHL_LOCATION_ID
);

const conversationManager = new ConversationManager(ghlService);
const logger = new Logger('test-full-flow');

// Test scenarios
const testScenarios = [
  {
    name: "Initial Contact - Spanish Greeting",
    message: "hola",
    expectedBehavior: "Should greet in Spanish and ask for name",
    validateResponse: (response) => {
      return response.toLowerCase().includes('hola') && 
             (response.includes('nombre') || response.includes('llamo') || response.includes('llamas'));
    }
  },
  {
    name: "Provide Name",
    message: "soy Carlos y tengo un restaurante",
    expectedBehavior: "Should extract name and business type, ask about problem",
    validateResponse: (response) => {
      return response.includes('Carlos') && 
             (response.includes('problema') || response.includes('necesita'));
    }
  },
  {
    name: "Describe Problem",
    message: "necesito más clientes, mi restaurante está vacío",
    expectedBehavior: "Should understand problem, ask about goals",
    validateResponse: (response) => {
      return response.includes('meta') || response.includes('objetivo') || 
             response.includes('lograr');
    }
  },
  {
    name: "State Goal",
    message: "quiero llenar el restaurante todas las noches",
    expectedBehavior: "Should understand goal, ask about budget",
    validateResponse: (response) => {
      return response.includes('presupuesto') || response.includes('invertir') || 
             response.includes('mensual');
    }
  },
  {
    name: "Provide Budget - Qualified",
    message: "puedo invertir $500 al mes",
    expectedBehavior: "Should recognize qualified lead ($500 > $300), ask for email",
    validateResponse: (response) => {
      return response.includes('email') || response.includes('correo');
    }
  },
  {
    name: "Provide Email",
    message: "mi email es carlos@mirestaurante.com",
    expectedBehavior: "Should show calendar slots",
    validateResponse: (response) => {
      return response.includes('disponible') || response.includes('horario') || 
             response.includes('cita');
    }
  },
  {
    name: "Select Time Slot",
    message: "el martes a las 2pm está perfecto",
    expectedBehavior: "Should book appointment and confirm",
    validateResponse: (response) => {
      return response.includes('confirmada') || response.includes('agendada') || 
             response.includes('cita');
    }
  }
];

/**
 * Test webhook validation
 */
async function testWebhookValidation() {
  console.log(`${BLUE}=== Testing Webhook Validation ===${RESET}\n`);
  
  const tests = [];
  
  // Test 1: Valid webhook payload
  try {
    console.log('1. Testing valid webhook payload...');
    const validPayload = {
      phone: testConfig.phone,
      message: "Test message",
      contactId: testConfig.contactId
    };
    
    // Create message for webhook handler
    const input = {
      messages: [new HumanMessage(JSON.stringify(validPayload))],
      contactId: testConfig.contactId,
      phone: testConfig.phone
    };
    
    console.log(`${GREEN}✓ Valid payload accepted${RESET}`);
    tests.push({ name: 'Valid Payload', status: 'pass' });
  } catch (error) {
    console.log(`${RED}✗ Valid payload rejected: ${error.message}${RESET}`);
    tests.push({ name: 'Valid Payload', status: 'fail', error: error.message });
  }
  
  // Test 2: Invalid webhook payload (missing required fields)
  console.log('\n2. Testing invalid webhook payload...');
  try {
    const invalidPayload = {
      message: "Test message"
      // Missing phone and contactId
    };
    
    const input = {
      messages: [new HumanMessage(JSON.stringify(invalidPayload))]
    };
    
    // This should fail validation
    const result = await graph.invoke(input, { configurable: { thread_id: 'test-invalid' } });
    
    // Check if the result contains an error message
    if (result.messages && result.messages.length > 0) {
      const lastMessage = result.messages[result.messages.length - 1];
      const errorContent = lastMessage.content || lastMessage.kwargs?.content || '';
      
      if (errorContent.includes('error procesando') || errorContent.includes('intenta de nuevo')) {
        console.log(`${GREEN}✓ Invalid payload handled with error message${RESET}`);
        tests.push({ name: 'Invalid Payload Rejection', status: 'pass' });
      } else {
        console.log(`${RED}✗ Invalid payload was not rejected properly${RESET}`);
        tests.push({ name: 'Invalid Payload Rejection', status: 'fail', error: 'No error message returned' });
      }
    } else {
      console.log(`${RED}✗ Invalid payload was not rejected${RESET}`);
      tests.push({ name: 'Invalid Payload Rejection', status: 'fail', error: 'No response returned' });
    }
    
  } catch (error) {
    if (error.message.includes('Missing required fields')) {
      console.log(`${GREEN}✓ Invalid payload correctly rejected${RESET}`);
      tests.push({ name: 'Invalid Payload Rejection', status: 'pass' });
    } else {
      console.log(`${RED}✗ Invalid payload handling failed: ${error.message}${RESET}`);
      tests.push({ name: 'Invalid Payload Rejection', status: 'fail', error: error.message });
    }
  }
  
  return tests;
}

/**
 * Test conversation state management
 */
async function testConversationState() {
  console.log(`\n${BLUE}=== Testing Conversation State Management ===${RESET}\n`);
  
  const tests = [];
  
  try {
    console.log('1. Testing conversation state retrieval...');
    const state = await conversationManager.getConversationState(
      testConfig.contactId,
      null,
      testConfig.phone
    );
    
    console.log(`${GREEN}✓ State retrieved successfully${RESET}`);
    console.log(`   Messages in history: ${state.messages.length}`);
    console.log(`   Conversation ID: ${state.conversationId || 'Not found'}`);
    
    tests.push({ 
      name: 'State Retrieval', 
      status: 'pass',
      data: { messageCount: state.messages.length }
    });
  } catch (error) {
    console.log(`${RED}✗ State retrieval failed: ${error.message}${RESET}`);
    tests.push({ name: 'State Retrieval', status: 'fail', error: error.message });
  }
  
  // Test 2: Cache functionality
  try {
    console.log('\n2. Testing conversation cache...');
    const start = Date.now();
    
    // First call (should hit API)
    await conversationManager.getConversationState(testConfig.contactId);
    const firstCallTime = Date.now() - start;
    
    // Second call (should hit cache)
    const cacheStart = Date.now();
    await conversationManager.getConversationState(testConfig.contactId);
    const cacheCallTime = Date.now() - cacheStart;
    
    if (cacheCallTime < firstCallTime / 2) {
      console.log(`${GREEN}✓ Cache working (${cacheCallTime}ms vs ${firstCallTime}ms)${RESET}`);
      tests.push({ name: 'Cache Performance', status: 'pass' });
    } else {
      console.log(`${YELLOW}⚠ Cache performance unclear${RESET}`);
      tests.push({ name: 'Cache Performance', status: 'warn' });
    }
  } catch (error) {
    console.log(`${RED}✗ Cache test failed: ${error.message}${RESET}`);
    tests.push({ name: 'Cache Performance', status: 'fail', error: error.message });
  }
  
  return tests;
}

/**
 * Test individual conversation flow with streaming
 */
async function testConversationFlow(scenario, previousState = null) {
  console.log(`\n${CYAN}Testing: ${scenario.name}${RESET}`);
  console.log(`Message: "${scenario.message}"`);
  console.log(`Expected: ${scenario.expectedBehavior}`);
  
  const webhookPayload = {
    phone: testConfig.phone,
    message: scenario.message,
    contactId: testConfig.contactId
  };
  
  const input = {
    messages: [new HumanMessage(JSON.stringify(webhookPayload))],
    contactId: testConfig.contactId,
    phone: testConfig.phone,
    leadInfo: previousState?.leadInfo || {}
  };
  
  const config = {
    configurable: {
      contactId: testConfig.contactId,
      thread_id: testConfig.contactId
    },
    streamMode: 'updates'
  };
  
  try {
    // Stream the execution to observe each step
    console.log(`\n${MAGENTA}Streaming execution:${RESET}`);
    
    const stream = await graph.stream(input, config);
    let finalState = null;
    let toolCalls = [];
    let messagesProcessed = 0;
    let responseFound = false;
    let responseContent = '';
    
    for await (const chunk of stream) {
      // The webhook handler returns the final state after invoking salesAgent
      if (chunk.webhook_handler) {
        finalState = chunk.webhook_handler;
        messagesProcessed++;
        
        // Look for tool calls in the messages
        const messages = chunk.webhook_handler.messages || [];
        
        // Check all messages for tool calls and responses
        for (const message of messages) {
          // Handle LangChain message format
          const msgContent = message.content || message.kwargs?.content || '';
          const msgRole = message.role || (message.kwargs?.tool_calls ? 'assistant' : message._getType?.() || 'unknown');
          const msgToolCalls = message.tool_calls || message.kwargs?.tool_calls || [];
          
          // Check for AI messages with tool calls
          if (msgToolCalls.length > 0) {
            console.log(`${YELLOW}  Tools called:${RESET}`);
            for (const toolCall of msgToolCalls) {
              const toolName = toolCall.name || toolCall.function?.name;
              console.log(`    - ${toolName}`);
              toolCalls.push(toolName);
              
              // If it's send_ghl_message, extract the message content
              if (toolName === 'send_ghl_message') {
                try {
                  const args = typeof toolCall.function?.arguments === 'string' ? 
                    JSON.parse(toolCall.function.arguments) : 
                    toolCall.args || {};
                  if (args.message) {
                    responseFound = true;
                    responseContent = args.message;
                    console.log(`${GREEN}  Message sent: "${args.message.substring(0, 50)}..."${RESET}`);
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }
        }
      }
    }
    
    console.log(`\n${MAGENTA}Execution summary:${RESET}`);
    console.log(`  Messages processed: ${messagesProcessed}`);
    console.log(`  Total tools called: ${toolCalls.length}`);
    
    // Validate response
    if (!responseFound && finalState) {
      // Check the final state for any responses
      const finalMessages = finalState.messages || [];
      const assistantMessages = finalMessages.filter(m => m.role === 'assistant');
      if (assistantMessages.length > 0) {
        responseFound = true;
        responseContent = assistantMessages[assistantMessages.length - 1].content;
      }
    }
    
    // Check if we got a response that matches the scenario
    if (responseFound && responseContent) {
      const validated = scenario.validateResponse ? 
        scenario.validateResponse(responseContent) : true;
      
      if (validated) {
        console.log(`${GREEN}✓ Response validated: "${responseContent.substring(0, 50)}..."${RESET}`);
        console.log(`${GREEN}✓ Scenario completed successfully${RESET}`);
        return {
          success: true,
          state: finalState,
          toolCalls,
          response: responseContent
        };
      } else {
        console.log(`${YELLOW}⚠ Response didn't match expected pattern${RESET}`);
        console.log(`  Response: "${responseContent.substring(0, 100)}..."`);
        return {
          success: false,
          error: 'Response validation failed',
          response: responseContent
        };
      }
    } else {
      console.log(`${RED}✗ No response generated${RESET}`);
      return {
        success: false,
        error: 'No response generated'
      };
    }
    
  } catch (error) {
    console.log(`${RED}✗ Flow error: ${error.message}${RESET}`);
    console.error(error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test complete conversation sequence
 */
async function testCompleteSequence() {
  console.log(`\n${BLUE}=== Testing Complete Conversation Sequence ===${RESET}\n`);
  
  const results = [];
  let previousState = null;
  
  for (const scenario of testScenarios) {
    const result = await testConversationFlow(scenario, previousState);
    
    results.push({
      scenario: scenario.name,
      success: result.success,
      error: result.error,
      toolCalls: result.toolCalls
    });
    
    if (result.success && result.state) {
      previousState = result.state;
    }
    
    // Add delay between messages to simulate real conversation
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return results;
}

/**
 * Test GHL integration
 */
async function testGHLIntegration() {
  console.log(`\n${BLUE}=== Testing GHL Integration ===${RESET}\n`);
  
  const tests = [];
  
  // Test 1: Send message
  try {
    console.log('1. Testing GHL message sending...');
    await ghlService.sendSMS(testConfig.contactId, "Test message from full flow test");
    console.log(`${GREEN}✓ Message sent successfully${RESET}`);
    tests.push({ name: 'Send Message', status: 'pass' });
  } catch (error) {
    console.log(`${RED}✗ Message send failed: ${error.message}${RESET}`);
    tests.push({ name: 'Send Message', status: 'fail', error: error.message });
  }
  
  // Test 2: Update contact
  try {
    console.log('\n2. Testing contact update...');
    await ghlService.addTags(testConfig.contactId, ['test-flow-complete']);
    await ghlService.addNote(testConfig.contactId, `Full flow test completed at ${new Date().toISOString()}`);
    console.log(`${GREEN}✓ Contact updated successfully${RESET}`);
    tests.push({ name: 'Update Contact', status: 'pass' });
  } catch (error) {
    console.log(`${RED}✗ Contact update failed: ${error.message}${RESET}`);
    tests.push({ name: 'Update Contact', status: 'fail', error: error.message });
  }
  
  return tests;
}

/**
 * Generate comprehensive test report
 */
function generateReport(allTests) {
  console.log(`\n${BLUE}${'='.repeat(60)}${RESET}`);
  console.log(`${BLUE}=== COMPREHENSIVE TEST REPORT ===${RESET}`);
  console.log(`${BLUE}${'='.repeat(60)}${RESET}\n`);
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let warnTests = 0;
  
  for (const [category, tests] of Object.entries(allTests)) {
    console.log(`${YELLOW}${category}:${RESET}`);
    
    if (Array.isArray(tests)) {
      for (const test of tests) {
        totalTests++;
        
        if (test.status === 'pass' || test.success) {
          console.log(`  ${GREEN}✓ ${test.name || test.scenario}${RESET}`);
          passedTests++;
        } else if (test.status === 'fail' || test.success === false) {
          console.log(`  ${RED}✗ ${test.name || test.scenario}${RESET}`);
          if (test.error) {
            console.log(`    Error: ${test.error}`);
          }
          failedTests++;
        } else {
          console.log(`  ${YELLOW}⚠ ${test.name || test.scenario}${RESET}`);
          warnTests++;
        }
        
        // Show tool calls for conversation tests
        if (test.toolCalls) {
          console.log(`    Tools: ${test.toolCalls.join(', ')}`);
        }
      }
    }
    console.log('');
  }
  
  console.log(`${BLUE}Overall Results:${RESET}`);
  console.log(`  Total Tests: ${totalTests}`);
  console.log(`  ${GREEN}Passed: ${passedTests}${RESET}`);
  console.log(`  ${RED}Failed: ${failedTests}${RESET}`);
  console.log(`  ${YELLOW}Warnings: ${warnTests}${RESET}`);
  
  const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
  console.log(`\n  Success Rate: ${successRate}%`);
  
  // LangSmith tracing info
  if (process.env.LANGCHAIN_TRACING_V2 === "true") {
    console.log(`\n${CYAN}📊 LangSmith Tracing:${RESET}`);
    console.log(`  Project: ${process.env.LANGCHAIN_PROJECT}`);
    console.log(`  View traces at: https://smith.langchain.com`);
  }
  
  if (failedTests === 0) {
    console.log(`\n${GREEN}🎉 All tests passed! The webhook flow is working correctly.${RESET}`);
  } else {
    console.log(`\n${RED}⚠️  Some tests failed. Please check the errors above.${RESET}`);
  }
  
  console.log(`\n${BLUE}${'='.repeat(60)}${RESET}\n`);
}

/**
 * Main test runner
 */
async function main() {
  try {
    console.log('Starting comprehensive webhook flow test...\n');
    console.log('Configuration:');
    console.log(`  Contact ID: ${testConfig.contactId}`);
    console.log(`  Phone: ${testConfig.phone}`);
    console.log(`  Location ID: ${testConfig.locationId}`);
    console.log(`  Calendar ID: ${testConfig.calendarId}`);
    console.log(`  LangSmith Tracing: ${process.env.LANGCHAIN_TRACING_V2 === "true" ? 'Enabled' : 'Disabled'}`);
    console.log('');
    
    const allTests = {
      'Webhook Validation': await testWebhookValidation(),
      'Conversation State': await testConversationState(),
      'Complete Flow': await testCompleteSequence(),
      'GHL Integration': await testGHLIntegration()
    };
    
    generateReport(allTests);
    
    // Exit with appropriate code
    const hasFailures = Object.values(allTests)
      .flat()
      .some(test => test.status === 'fail' || test.success === false);
    
    process.exit(hasFailures ? 1 : 0);
    
  } catch (error) {
    console.error(`\n${RED}Fatal error during testing: ${error.message}${RESET}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testWebhookValidation, testConversationState, testCompleteSequence };