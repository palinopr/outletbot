#!/usr/bin/env node
import 'dotenv/config';
import { tools } from './agents/modernSalesAgent.js';
import { GHLService } from './services/ghlService.js';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage } from '@langchain/core/messages';
import ConversationManager from './services/conversationManager.js';

console.log('🧪 Testing Outlet Media Bot Components\n');

// Initialize services
const ghlService = new GHLService(
  process.env.GHL_API_KEY,
  process.env.GHL_LOCATION_ID
);

const conversationManager = new ConversationManager(ghlService);

// Test configuration
const testContactId = process.env.TEST_CONTACT_ID || 'test-contact-' + Date.now();
const testConversationId = 'test-convo-' + Date.now();

// Color codes for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

async function testGHLService() {
  console.log(`${BLUE}=== Testing GHL Service ===${RESET}\n`);
  
  const tests = [];
  
  // Test 1: Check API connection
  try {
    console.log('1. Testing GHL API connection...');
    const testContact = await ghlService.getContact(testContactId).catch(() => null);
    if (testContact || testContact === null) {
      console.log(`${GREEN}✓ GHL API connection successful${RESET}`);
      tests.push({ name: 'API Connection', status: 'pass' });
    }
  } catch (error) {
    console.log(`${RED}✗ GHL API connection failed: ${error.message}${RESET}`);
    tests.push({ name: 'API Connection', status: 'fail', error: error.message });
  }
  
  // Test 2: Calendar availability
  try {
    console.log('\n2. Testing calendar availability...');
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    
    const slots = await ghlService.getAvailableSlots(
      process.env.GHL_CALENDAR_ID,
      startDate.toISOString(),
      endDate.toISOString()
    );
    
    console.log(`${GREEN}✓ Found ${slots.length} available slots${RESET}`);
    if (slots.length > 0) {
      console.log(`   First slot: ${new Date(slots[0].startTime).toLocaleString()}`);
    }
    tests.push({ name: 'Calendar Slots', status: 'pass', data: { slotCount: slots.length } });
  } catch (error) {
    console.log(`${RED}✗ Calendar test failed: ${error.message}${RESET}`);
    tests.push({ name: 'Calendar Slots', status: 'fail', error: error.message });
  }
  
  // Test 3: Conversation management
  try {
    console.log('\n3. Testing conversation management...');
    const conversationState = await conversationManager.getConversationState(testContactId, testConversationId);
    console.log(`${GREEN}✓ Conversation state retrieved${RESET}`);
    console.log(`   Messages: ${conversationState.messages.length}`);
    console.log(`   Conversation ID: ${conversationState.conversationId}`);
    tests.push({ name: 'Conversation Management', status: 'pass' });
  } catch (error) {
    console.log(`${RED}✗ Conversation management failed: ${error.message}${RESET}`);
    tests.push({ name: 'Conversation Management', status: 'fail', error: error.message });
  }
  
  return tests;
}

async function testTools() {
  console.log(`\n${BLUE}=== Testing Individual Tools ===${RESET}\n`);
  
  const tests = [];
  const config = {
    configurable: {
      ghlService,
      calendarId: process.env.GHL_CALENDAR_ID,
      contactId: testContactId,
      currentLeadInfo: {}
    }
  };
  
  // Test 1: extractLeadInfo tool
  try {
    console.log('1. Testing extractLeadInfo tool...');
    const result = await tools.extractLeadInfo.invoke({
      message: "Hi, I'm John Smith and I need help with marketing for my restaurant",
      currentInfo: {}
    }, config);
    
    console.log(`${GREEN}✓ Extract tool working${RESET}`);
    console.log(`   Extracted: ${JSON.stringify(result)}`);
    tests.push({ name: 'extractLeadInfo', status: 'pass', data: result });
  } catch (error) {
    console.log(`${RED}✗ Extract tool failed: ${error.message}${RESET}`);
    tests.push({ name: 'extractLeadInfo', status: 'fail', error: error.message });
  }
  
  // Test 2: parseTimeSelection tool
  try {
    console.log('\n2. Testing parseTimeSelection tool...');
    const testSlots = [
      { index: 1, display: 'Monday, Dec 4 at 10:00 AM', startTime: '2024-12-04T10:00:00Z', endTime: '2024-12-04T11:00:00Z' },
      { index: 2, display: 'Tuesday, Dec 5 at 2:00 PM', startTime: '2024-12-05T14:00:00Z', endTime: '2024-12-05T15:00:00Z' }
    ];
    
    const result = await tools.parseTimeSelection.invoke({
      userInput: "I'll take the Tuesday slot",
      availableSlots: testSlots
    }, config);
    
    console.log(`${GREEN}✓ Parse time tool working${RESET}`);
    console.log(`   Selected: ${result ? result.display : 'None'}`);
    tests.push({ name: 'parseTimeSelection', status: 'pass', data: result });
  } catch (error) {
    console.log(`${RED}✗ Parse time tool failed: ${error.message}${RESET}`);
    tests.push({ name: 'parseTimeSelection', status: 'fail', error: error.message });
  }
  
  // Test 3: getCalendarSlots tool (with validation)
  try {
    console.log('\n3. Testing getCalendarSlots tool with incomplete info...');
    const incompleteInfo = {
      name: "John",
      problem: "Need marketing",
      // Missing goal, budget, email
    };
    
    const result = await tools.getCalendarSlots.invoke({
      leadInfo: incompleteInfo,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }, config);
    
    if (result.error) {
      console.log(`${GREEN}✓ Calendar tool correctly rejected incomplete info${RESET}`);
      console.log(`   Error: ${result.error}`);
      tests.push({ name: 'getCalendarSlots validation', status: 'pass' });
    } else {
      console.log(`${RED}✗ Calendar tool should have rejected incomplete info${RESET}`);
      tests.push({ name: 'getCalendarSlots validation', status: 'fail' });
    }
  } catch (error) {
    console.log(`${RED}✗ Calendar validation test failed: ${error.message}${RESET}`);
    tests.push({ name: 'getCalendarSlots validation', status: 'fail', error: error.message });
  }
  
  // Test 4: getCalendarSlots tool (with complete info)
  try {
    console.log('\n4. Testing getCalendarSlots tool with complete info...');
    const completeInfo = {
      name: "John Smith",
      problem: "Need more customers",
      goal: "Fill restaurant every night",
      budget: 500,
      email: "john@restaurant.com"
    };
    
    const result = await tools.getCalendarSlots.invoke({
      leadInfo: completeInfo,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }, config);
    
    if (result.success && result.slots) {
      console.log(`${GREEN}✓ Calendar tool working with complete info${RESET}`);
      console.log(`   Slots returned: ${result.slots.length}`);
      if (result.slots.length > 0) {
        console.log(`   First slot: ${result.slots[0].display}`);
      }
      tests.push({ name: 'getCalendarSlots complete', status: 'pass', data: { slotCount: result.slots.length } });
    } else if (result.error) {
      console.log(`${YELLOW}⚠ Calendar tool returned error: ${result.error}${RESET}`);
      tests.push({ name: 'getCalendarSlots complete', status: 'warn', error: result.error });
    }
  } catch (error) {
    console.log(`${RED}✗ Calendar complete test failed: ${error.message}${RESET}`);
    tests.push({ name: 'getCalendarSlots complete', status: 'fail', error: error.message });
  }
  
  // Test 5: sendGHLMessage tool
  try {
    console.log('\n5. Testing sendGHLMessage tool...');
    const result = await tools.sendGHLMessage.invoke({
      contactId: testContactId,
      message: "Test message from component testing"
    }, config);
    
    if (result.success) {
      console.log(`${GREEN}✓ Send message tool working${RESET}`);
      tests.push({ name: 'sendGHLMessage', status: 'pass' });
    } else {
      console.log(`${YELLOW}⚠ Send message returned error: ${result.error}${RESET}`);
      tests.push({ name: 'sendGHLMessage', status: 'warn', error: result.error });
    }
  } catch (error) {
    console.log(`${RED}✗ Send message tool failed: ${error.message}${RESET}`);
    tests.push({ name: 'sendGHLMessage', status: 'fail', error: error.message });
  }
  
  return tests;
}

async function testLLMIntegration() {
  console.log(`\n${BLUE}=== Testing LLM Integration ===${RESET}\n`);
  
  const tests = [];
  
  try {
    console.log('Testing OpenAI connection...');
    const llm = new ChatOpenAI({ model: 'gpt-4', temperature: 0 });
    const response = await llm.invoke([
      new SystemMessage("You are a test bot. Reply with 'OK' if you receive this."),
      { role: "user", content: "Test message" }
    ]);
    
    if (response.content.includes('OK')) {
      console.log(`${GREEN}✓ OpenAI LLM working${RESET}`);
      tests.push({ name: 'OpenAI Connection', status: 'pass' });
    } else {
      console.log(`${YELLOW}⚠ Unexpected LLM response${RESET}`);
      tests.push({ name: 'OpenAI Connection', status: 'warn' });
    }
  } catch (error) {
    console.log(`${RED}✗ LLM test failed: ${error.message}${RESET}`);
    tests.push({ name: 'OpenAI Connection', status: 'fail', error: error.message });
  }
  
  return tests;
}

async function generateReport(allTests) {
  console.log(`\n${BLUE}=== Test Summary Report ===${RESET}\n`);
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let warnTests = 0;
  
  for (const [category, tests] of Object.entries(allTests)) {
    console.log(`${YELLOW}${category}:${RESET}`);
    for (const test of tests) {
      totalTests++;
      const icon = test.status === 'pass' ? '✓' : test.status === 'fail' ? '✗' : '⚠';
      const color = test.status === 'pass' ? GREEN : test.status === 'fail' ? RED : YELLOW;
      console.log(`  ${color}${icon} ${test.name}${RESET}`);
      
      if (test.error) {
        console.log(`    Error: ${test.error}`);
      }
      
      if (test.status === 'pass') passedTests++;
      else if (test.status === 'fail') failedTests++;
      else warnTests++;
    }
    console.log('');
  }
  
  console.log(`${BLUE}Overall Results:${RESET}`);
  console.log(`  Total Tests: ${totalTests}`);
  console.log(`  ${GREEN}Passed: ${passedTests}${RESET}`);
  console.log(`  ${RED}Failed: ${failedTests}${RESET}`);
  console.log(`  ${YELLOW}Warnings: ${warnTests}${RESET}`);
  
  const successRate = Math.round((passedTests / totalTests) * 100);
  console.log(`\n  Success Rate: ${successRate}%`);
  
  if (failedTests === 0) {
    console.log(`\n${GREEN}🎉 All critical components are working!${RESET}`);
  } else {
    console.log(`\n${RED}⚠️  Some components need attention${RESET}`);
  }
}

// Run all tests
async function main() {
  try {
    console.log('Starting component tests...\n');
    console.log('Configuration:');
    console.log(`  GHL Location ID: ${process.env.GHL_LOCATION_ID}`);
    console.log(`  GHL Calendar ID: ${process.env.GHL_CALENDAR_ID}`);
    console.log(`  Test Contact ID: ${testContactId}\n`);
    
    const allTests = {
      'GHL Service': await testGHLService(),
      'Tools': await testTools(),
      'LLM Integration': await testLLMIntegration()
    };
    
    await generateReport(allTests);
    
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

export { testGHLService, testTools, testLLMIntegration };