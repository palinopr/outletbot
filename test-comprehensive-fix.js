#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

console.log('🔧 Comprehensive Fix Test - Verifying all tools return proper Command objects\n');

import { graph } from './agents/webhookHandler.js';
import { exportedTools } from './agents/salesAgent.js';
import crypto from 'crypto';

// Test webhook with real data
async function testWebhook() {
  console.log('1️⃣ Testing webhook handler with real conversation...');
  
  const webhookPayload = {
    phone: '+13054870475',
    message: 'Hola, soy Carlos y tengo un restaurante',
    contactId: '54sJIGTtwmR89Qc5JeEt'
  };
  
  try {
    const result = await graph.invoke({
      messages: [{
        role: 'human',
        content: JSON.stringify(webhookPayload)
      }]
    }, {
      runId: crypto.randomUUID()
    });
    
    console.log('✅ Webhook completed successfully');
    console.log('Messages:', result.messages?.length || 0);
    
    // Check for tool_calls error in any message
    const hasError = result.messages?.some(m => 
      m.content?.includes('Lo siento, hubo un error') ||
      m.content?.includes('tool_calls must be followed')
    );
    
    if (hasError) {
      console.error('❌ Error message found in response!');
    } else {
      console.log('✅ No error messages in response');
    }
    
    return !hasError;
  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    return false;
  }
}

// Test individual tools
async function testTools() {
  console.log('\n2️⃣ Testing individual tools return proper Command objects...');
  
  const mockConfig = {
    toolCall: { id: 'test-123' },
    configurable: {
      contactId: 'test-contact',
      ghlService: {
        sendSMS: async () => ({ id: 'msg-123' }),
        getAvailableSlots: async () => [
          { startTime: '2025-01-29T10:00:00', endTime: '2025-01-29T11:00:00' }
        ]
      },
      calendarId: 'test-calendar'
    },
    getState: async () => ({
      leadInfo: { name: 'Test', problem: 'Testing', goal: 'Test goal', budget: 500, email: 'test@test.com' },
      extractionCount: 0,
      availableSlots: [{ index: 1, display: 'Test slot', startTime: '2025-01-29T10:00:00' }]
    })
  };
  
  const tools = [
    { name: 'extractLeadInfo', fn: exportedTools.extractLeadInfo, args: { message: 'Mi presupuesto es $500 al mes' } },
    { name: 'sendGHLMessage', fn: exportedTools.sendGHLMessage, args: { message: 'Hola Carlos!' } },
    { name: 'getCalendarSlots', fn: exportedTools.getCalendarSlots, args: {} },
    { name: 'parseTimeSelection', fn: exportedTools.parseTimeSelection, args: { userMessage: 'Opción 1' } }
  ];
  
  let allPassed = true;
  
  for (const tool of tools) {
    try {
      console.log(`\nTesting ${tool.name}...`);
      const result = await tool.fn.func(tool.args, mockConfig);
      
      // Check if result is a Command object
      if (!result || !result.update) {
        console.error(`❌ ${tool.name} did not return a Command object`);
        allPassed = false;
        continue;
      }
      
      // Check if tool message is included
      const hasToolMessage = result.update.messages?.some(m => 
        m.role === 'tool' && m.tool_call_id === mockConfig.toolCall.id
      );
      
      if (!hasToolMessage) {
        console.error(`❌ ${tool.name} did not include tool message in response`);
        allPassed = false;
      } else {
        console.log(`✅ ${tool.name} returns proper Command with tool message`);
      }
      
    } catch (error) {
      console.error(`❌ ${tool.name} error:`, error.message);
      allPassed = false;
    }
  }
  
  return allPassed;
}

// Run all tests
async function runTests() {
  console.log('Starting comprehensive fix verification...\n');
  
  const webhookPass = await testWebhook();
  const toolsPass = await testTools();
  
  console.log('\n📊 Test Summary:');
  console.log('- Webhook Handler:', webhookPass ? '✅ PASS' : '❌ FAIL');
  console.log('- Tool Commands:', toolsPass ? '✅ PASS' : '❌ FAIL');
  
  if (webhookPass && toolsPass) {
    console.log('\n🎉 All tests passed! The fix is complete.');
    console.log('Tools now properly return Command objects with tool messages.');
  } else {
    console.log('\n⚠️ Some tests failed. Review the errors above.');
  }
}

runTests().catch(console.error);