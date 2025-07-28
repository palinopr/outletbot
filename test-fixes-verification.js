#!/usr/bin/env node

/**
 * Verify fixes for recursion limit and other issues
 */

import dotenv from 'dotenv';
dotenv.config();

import { HumanMessage } from '@langchain/core/messages';
import { performance } from 'perf_hooks';

console.log('🔍 TESTING FIXES VERIFICATION');
console.log('============================\n');

// Test 1: Direct agent test with recursion limit
async function testRecursionLimit() {
  console.log('Test 1: Recursion Limit Fix\n');
  
  try {
    const { salesAgent } = await import('./agents/salesAgent.js');
    
    const state = {
      messages: [new HumanMessage('Hola')],
      leadInfo: {},
      extractionCount: 0,
      processedMessages: [],
      contactId: 'test-recursion',
      phone: '+1234567890',
      conversationId: 'test-conv-recursion'
    };
    
    console.log('Invoking agent with recursionLimit: 15...');
    const start = performance.now();
    
    const result = await salesAgent.invoke(state, {
      recursionLimit: 15,
      configurable: {
        thread_id: state.conversationId
      }
    });
    
    const elapsed = performance.now() - start;
    console.log(`✅ Completed in ${elapsed.toFixed(0)}ms`);
    console.log(`Messages: ${result.messages.length}`);
    console.log(`Extraction count: ${result.extractionCount}`);
    
    if (result.messages.length > 0) {
      const lastMsg = result.messages[result.messages.length - 1];
      if (lastMsg.content) {
        console.log(`Response: "${lastMsg.content.substring(0, 100)}..."`);
      }
    }
    
  } catch (error) {
    if (error.message.includes('Recursion limit')) {
      console.log('❌ Still hitting recursion limit!');
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

// Test 2: Test max extraction handling
async function testMaxExtraction() {
  console.log('\n\nTest 2: Max Extraction Handling\n');
  
  try {
    const { salesAgent } = await import('./agents/salesAgent.js');
    
    // Start with extraction count near limit
    const state = {
      messages: [new HumanMessage('test message')],
      leadInfo: {},
      extractionCount: 2,  // Near the limit of 3
      processedMessages: [],
      maxExtractionReached: false,
      contactId: 'test-extraction',
      phone: '+1234567890',
      conversationId: 'test-conv-extraction'
    };
    
    console.log('Testing with extractionCount: 2 (near limit)...');
    
    const result = await salesAgent.invoke(state, {
      recursionLimit: 10,
      configurable: {
        thread_id: state.conversationId
      }
    });
    
    console.log(`✅ Completed successfully`);
    console.log(`Max extraction reached: ${result.maxExtractionReached}`);
    console.log(`Final extraction count: ${result.extractionCount}`);
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

// Test 3: Test appointment booking termination
async function testAppointmentTermination() {
  console.log('\n\nTest 3: Appointment Booking Termination\n');
  
  try {
    const { salesAgent } = await import('./agents/salesAgent.js');
    
    // Simulate state after appointment booking
    const state = {
      messages: [new HumanMessage('Gracias')],
      leadInfo: {
        name: 'Test User',
        email: 'test@example.com',
        budget: '$500'
      },
      appointmentBooked: true,  // Already booked
      extractionCount: 0,
      processedMessages: [],
      contactId: 'test-appointment',
      phone: '+1234567890',
      conversationId: 'test-conv-appointment'
    };
    
    console.log('Testing with appointmentBooked: true...');
    
    const result = await salesAgent.invoke(state, {
      recursionLimit: 5,
      configurable: {
        thread_id: state.conversationId
      }
    });
    
    console.log(`✅ Completed successfully`);
    console.log(`Messages added: ${result.messages.length - state.messages.length}`);
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

// Test 4: Full conversation flow
async function testFullFlow() {
  console.log('\n\nTest 4: Full Conversation Flow\n');
  
  try {
    const { default: webhookHandler } = await import('./api/langgraph-api.js');
    
    const payload = {
      type: "InboundMessage",
      locationId: process.env.GHL_LOCATION_ID,
      contactId: "test-full-flow",
      conversationId: "test-conv-full",
      message: "Hola",
      phone: "+1234567890"
    };
    
    const mockReq = {
      method: 'POST',
      body: payload,
      headers: { 'content-type': 'application/json' }
    };
    
    let responseData = null;
    const mockRes = {
      statusCode: null,
      status: function(code) { 
        this.statusCode = code; 
        return this; 
      },
      json: function(data) { 
        responseData = data; 
        return this; 
      }
    };
    
    console.log('Testing webhook handler...');
    const start = performance.now();
    
    await webhookHandler(mockReq, mockRes);
    
    const elapsed = performance.now() - start;
    
    if (mockRes.statusCode === 200) {
      console.log(`✅ Success in ${elapsed.toFixed(0)}ms`);
    } else {
      console.log(`❌ Failed with status ${mockRes.statusCode}`);
      if (responseData) {
        console.log('Error:', responseData);
      }
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

// Run all tests
async function runTests() {
  try {
    await testRecursionLimit();
    await testMaxExtraction();
    await testAppointmentTermination();
    await testFullFlow();
    
    console.log('\n\n✅ All tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  }
}

runTests();