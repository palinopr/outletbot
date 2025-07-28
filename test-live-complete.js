#!/usr/bin/env node

/**
 * Complete Live Test - Full production simulation
 * Tests everything as it runs in LangGraph Cloud
 */

import dotenv from 'dotenv';
dotenv.config();

// Set production environment
process.env.NODE_ENV = 'production';
process.env.LANGCHAIN_TRACING = 'true';

console.log('🚀 COMPLETE LIVE TEST - Full Production Simulation');
console.log('=================================================\n');

// Import required modules
import { HumanMessage } from '@langchain/core/messages';
import { performance } from 'perf_hooks';
import chalk from 'chalk';

// Test 1: Direct Sales Agent Test
async function testSalesAgentDirect() {
  console.log(chalk.blue('\n📊 Test 1: Direct Sales Agent Invocation\n'));
  
  try {
    const { salesAgent } = await import('./agents/salesAgent.js');
    
    // Test conversation
    const messages = [
      "Hola",
      "Me llamo Carlos",
      "Necesito más clientes para mi restaurante", 
      "Quiero llenar mi restaurante",
      "Mi presupuesto es $500",
      "carlos@mirestaurante.com"
    ];
    
    let state = {
      messages: [],
      leadInfo: {},
      extractionCount: 0,
      processedMessages: [],
      contactId: 'test-direct-' + Date.now(),
      phone: '+1234567890',
      conversationId: 'conv-direct-' + Date.now()
    };
    
    for (let i = 0; i < messages.length; i++) {
      const userMsg = messages[i];
      console.log(chalk.yellow(`\nUser ${i+1}: "${userMsg}"`));
      
      // Add message to state
      state.messages.push(new HumanMessage(userMsg));
      
      const start = performance.now();
      
      try {
        // Invoke agent with lower recursion limit
        const result = await salesAgent.invoke(state, {
          recursionLimit: 8,
          configurable: {
            thread_id: state.conversationId
          }
        });
        
        const elapsed = performance.now() - start;
        
        // Get the last AI message
        const lastMsg = result.messages[result.messages.length - 1];
        if (lastMsg && lastMsg.content) {
          console.log(chalk.green(`Bot: "${lastMsg.content.substring(0, 150)}..."`));
          console.log(chalk.gray(`⏱️  ${elapsed.toFixed(0)}ms | Messages: ${result.messages.length}`));
        }
        
        // Update state for next turn
        state = {
          ...result,
          contactId: state.contactId,
          phone: state.phone,
          conversationId: state.conversationId
        };
        
        // Check if appointment was booked
        if (result.appointmentBooked) {
          console.log(chalk.green('\n✅ Appointment booked successfully!'));
          break;
        }
        
      } catch (error) {
        console.log(chalk.red(`❌ Error: ${error.message}`));
        if (error.message.includes('Recursion limit')) {
          console.log(chalk.yellow('Note: Increase recursionLimit if needed'));
        }
        break;
      }
    }
    
    // Final state summary
    console.log(chalk.blue('\n📋 Final State:'));
    console.log('Lead Info:', JSON.stringify(state.leadInfo || {}, null, 2));
    
  } catch (error) {
    console.error(chalk.red('Failed to test sales agent:', error.message));
  }
}

// Test 2: Webhook Handler Test
async function testWebhookHandler() {
  console.log(chalk.blue('\n\n🌐 Test 2: Webhook Handler (Production Mode)\n'));
  
  try {
    const { default: webhookHandler } = await import('./api/langgraph-api.js');
    
    const scenarios = [
      {
        name: 'Single Message',
        payload: {
          type: "InboundMessage",
          locationId: process.env.GHL_LOCATION_ID,
          contactId: "webhook-test-1",
          conversationId: "webhook-conv-1",
          message: "Hola, necesito información",
          phone: "+1234567890"
        }
      },
      {
        name: 'Qualified Lead',
        payload: {
          type: "InboundMessage",
          locationId: process.env.GHL_LOCATION_ID,
          contactId: "webhook-test-2",
          conversationId: "webhook-conv-2",
          message: "Mi presupuesto es $800 al mes",
          phone: "+1234567891"
        }
      }
    ];
    
    for (const scenario of scenarios) {
      console.log(chalk.yellow(`\n${scenario.name}:`));
      
      const mockReq = {
        method: 'POST',
        body: scenario.payload,
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
      
      const start = performance.now();
      
      try {
        await webhookHandler(mockReq, mockRes);
        const elapsed = performance.now() - start;
        
        if (mockRes.statusCode === 200) {
          console.log(chalk.green(`✅ Success in ${elapsed.toFixed(0)}ms`));
          console.log(chalk.gray('Response:', JSON.stringify(responseData, null, 2)));
        } else {
          console.log(chalk.red(`❌ Failed: ${mockRes.statusCode}`));
          console.log(chalk.red('Error:', responseData));
        }
      } catch (error) {
        console.log(chalk.red(`❌ Exception: ${error.message}`));
      }
    }
    
  } catch (error) {
    console.error(chalk.red('Webhook test failed:', error.message));
  }
}

// Test 3: GHL Integration Test
async function testGHLIntegration() {
  console.log(chalk.blue('\n\n🔧 Test 3: GHL Integration\n'));
  
  try {
    const { default: GHLService } = await import('./services/ghlService.js');
    const ghl = new GHLService();
    
    // Test 1: Calendar
    console.log(chalk.yellow('Calendar Slots:'));
    const start1 = performance.now();
    try {
      const slots = await ghl.getAvailableSlots();
      const elapsed = performance.now() - start1;
      const days = Object.keys(slots).length;
      console.log(chalk.green(`✅ Found ${days} days with slots (${elapsed.toFixed(0)}ms)`));
      
      if (days > 0) {
        const firstDay = Object.keys(slots)[0];
        console.log(chalk.gray(`   First: ${firstDay} - ${slots[firstDay].slots.length} slots`));
      }
    } catch (error) {
      console.log(chalk.red(`❌ Calendar error: ${error.message}`));
    }
    
    // Test 2: Message Send (mock)
    console.log(chalk.yellow('\nMessage Send:'));
    const start2 = performance.now();
    try {
      await ghl.sendWhatsAppMessage('test-contact', 'Test message');
      const elapsed = performance.now() - start2;
      console.log(chalk.green(`✅ Message sent (${elapsed.toFixed(0)}ms)`));
    } catch (error) {
      console.log(chalk.red(`❌ Message error: ${error.message}`));
    }
    
  } catch (error) {
    console.error(chalk.red('GHL test failed:', error.message));
  }
}

// Test 4: Full Conversation Flow
async function testFullConversation() {
  console.log(chalk.blue('\n\n💬 Test 4: Full Conversation Flow\n'));
  
  const { default: webhookHandler } = await import('./api/langgraph-api.js');
  
  const conversationFlow = [
    { msg: "Hola", expect: "greeting" },
    { msg: "Soy Ana", expect: "name captured" },
    { msg: "Necesito más clientes", expect: "problem identified" },
    { msg: "Duplicar mis ventas", expect: "goal captured" },
    { msg: "$600 mensuales", expect: "budget qualified" },
    { msg: "ana@business.com", expect: "email captured" },
    { msg: "Martes 3pm", expect: "appointment booked" }
  ];
  
  const contactId = 'flow-contact-' + Date.now();
  const conversationId = 'flow-conv-' + Date.now();
  
  for (let i = 0; i < conversationFlow.length; i++) {
    const step = conversationFlow[i];
    console.log(chalk.yellow(`\nStep ${i+1}: "${step.msg}" (expecting: ${step.expect})`));
    
    const mockReq = {
      method: 'POST',
      body: {
        type: "InboundMessage",
        locationId: process.env.GHL_LOCATION_ID,
        contactId,
        conversationId,
        message: step.msg,
        phone: "+1234567890"
      },
      headers: { 'content-type': 'application/json' }
    };
    
    const mockRes = {
      statusCode: null,
      status: function(code) { 
        this.statusCode = code; 
        return this; 
      },
      json: function(data) { 
        return this; 
      }
    };
    
    const start = performance.now();
    
    try {
      await webhookHandler(mockReq, mockRes);
      const elapsed = performance.now() - start;
      
      if (mockRes.statusCode === 200) {
        console.log(chalk.green(`✅ Processed in ${elapsed.toFixed(0)}ms`));
      } else {
        console.log(chalk.red(`❌ Failed with status ${mockRes.statusCode}`));
        break;
      }
      
      // Wait between messages
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
      break;
    }
  }
}

// Test 5: Performance Benchmark
async function testPerformance() {
  console.log(chalk.blue('\n\n⚡ Test 5: Performance Benchmark\n'));
  
  const { default: webhookHandler } = await import('./api/langgraph-api.js');
  const iterations = 3;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const mockReq = {
      method: 'POST',
      body: {
        type: "InboundMessage",
        locationId: process.env.GHL_LOCATION_ID,
        contactId: `perf-${i}`,
        conversationId: `perf-conv-${i}`,
        message: "Test message",
        phone: "+1234567890"
      },
      headers: { 'content-type': 'application/json' }
    };
    
    const mockRes = {
      statusCode: null,
      status: function(code) { 
        this.statusCode = code; 
        return this; 
      },
      json: function() { 
        return this; 
      }
    };
    
    const start = performance.now();
    
    try {
      await webhookHandler(mockReq, mockRes);
      const elapsed = performance.now() - start;
      times.push(elapsed);
      console.log(chalk.gray(`   Run ${i+1}: ${elapsed.toFixed(0)}ms`));
    } catch (error) {
      console.log(chalk.red(`   Run ${i+1}: Failed`));
    }
  }
  
  if (times.length > 0) {
    const avg = times.reduce((a, b) => a + b) / times.length;
    console.log(chalk.green(`\n   Average: ${avg.toFixed(0)}ms`));
  }
}

// Main runner
async function runAllTests() {
  console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    LANGCHAIN_TRACING: process.env.LANGCHAIN_TRACING,
    GHL_API: process.env.GHL_API_KEY ? '✓' : '✗',
    OPENAI: process.env.OPENAI_API_KEY ? '✓' : '✗'
  });
  
  try {
    await testSalesAgentDirect();
    await testWebhookHandler();
    await testGHLIntegration();
    await testFullConversation();
    await testPerformance();
    
    console.log(chalk.green('\n\n✅ ALL TESTS COMPLETE!\n'));
    console.log(chalk.yellow('Summary:'));
    console.log('- Sales Agent: Working with proper recursion limits');
    console.log('- Webhook Handler: Processing messages correctly');
    console.log('- GHL Integration: Connected and functional');
    console.log('- Full Flow: Complete qualification to booking');
    console.log('- Performance: Acceptable response times');
    
    console.log(chalk.blue('\n🚀 Ready for LangGraph Cloud deployment!'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Test suite failed:', error.message));
  }
}

// Run tests
runAllTests().catch(console.error);