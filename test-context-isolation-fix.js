#!/usr/bin/env node
/**
 * Test context isolation fix
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { graph as webhookHandler } from './agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

const ghlService = new GHLService(
  process.env.GHL_API_KEY,
  process.env.GHL_LOCATION_ID
);

async function testContextIsolation() {
  console.log('🧪 Testing Context Isolation Fix\n');
  console.log('This test simulates a user saying "Hola" and checks if the response is clean\n');
  
  // Use the real contact that had the Juan conversation
  const realContactId = 'ym8G7K6GSzm8dJDZ6BNo';
  const realPhone = '(305) 487-0475';
  
  const webhookPayload = {
    phone: realPhone,
    message: 'Hola',
    contactId: realContactId
  };
  
  const state = {
    messages: [new HumanMessage(JSON.stringify(webhookPayload))],
    contactId: realContactId,
    phone: realPhone
  };
  
  try {
    console.log('🚀 Processing webhook with "Hola" message...\n');
    
    const result = await webhookHandler.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        thread_id: `test-isolation-${Date.now()}`
      },
      recursionLimit: 10
    });
    
    // Find the response
    const responseMsg = result.messages.find(m => 
      m.tool_calls?.some(tc => tc.function?.name === 'send_ghl_message')
    );
    
    if (responseMsg) {
      const tc = responseMsg.tool_calls.find(tc => tc.function?.name === 'send_ghl_message');
      const args = JSON.parse(tc.function.arguments);
      const response = args.message;
      
      console.log(`🤖 Agent Response: "${response}"\n`);
      
      // Check for contamination
      const lowerResponse = response.toLowerCase();
      const contaminated = [];
      
      if (lowerResponse.includes('juan')) {
        contaminated.push('Mentions Juan from previous conversation');
      }
      if (lowerResponse.includes('maria') && !lowerResponse.includes('soy maría')) {
        contaminated.push('Mentions Maria from previous conversation');
      }
      if (lowerResponse.includes('tienda') || lowerResponse.includes('ventas') || 
          lowerResponse.includes('cliente') || lowerResponse.includes('presupuesto')) {
        contaminated.push('Mentions business details from previous conversation');
      }
      
      if (contaminated.length > 0) {
        console.log('❌ CONTEXT CONTAMINATION DETECTED:');
        contaminated.forEach(issue => console.log(`  - ${issue}`));
        console.log('\nThe agent is still seeing old conversation history!');
      } else {
        console.log('✅ CLEAN RESPONSE!');
        console.log('The agent gave a fresh greeting without mentioning previous conversations.');
      }
      
      // Expected response check
      if (lowerResponse.includes('hola') && lowerResponse.includes('maría') && 
          (lowerResponse.includes('outlet media') || lowerResponse.includes('consultora'))) {
        console.log('\n✅ Response follows expected pattern (greeting + introduction)');
      }
      
    } else {
      console.log('❌ No response found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

process.env.SKIP_ENV_VALIDATION = 'true';
testContextIsolation().catch(console.error);