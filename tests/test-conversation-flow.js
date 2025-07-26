#!/usr/bin/env node
/**
 * Test conversation flow with webhook handler
 */

import 'dotenv/config';
import { graph } from '../agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';

console.log('🧪 Conversation Flow Test\n');

// Color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const RESET = '\x1b[0m';

// Test configuration
const testContactId = 'test-flow-' + Date.now();
const testPhone = '+12145559999';

async function sendMessage(message, description) {
  console.log(`\n${CYAN}Testing: ${description}${RESET}`);
  console.log(`Message: "${message}"`);
  
  const webhookPayload = {
    phone: testPhone,
    message: message,
    contactId: testContactId
  };
  
  const input = {
    messages: [new HumanMessage(JSON.stringify(webhookPayload))],
    contactId: testContactId,
    phone: testPhone
  };
  
  try {
    const result = await graph.invoke(input);
    
    // Extract the response
    let responseFound = false;
    let responseContent = '';
    let toolsCalled = [];
    
    if (result.messages) {
      for (const message of result.messages) {
        const msgToolCalls = message.tool_calls || message.kwargs?.tool_calls || [];
        
        for (const toolCall of msgToolCalls) {
          const toolName = toolCall.name || toolCall.function?.name;
          toolsCalled.push(toolName);
          
          if (toolName === 'send_ghl_message') {
            try {
              const args = typeof toolCall.function?.arguments === 'string' ? 
                JSON.parse(toolCall.function.arguments) : 
                toolCall.args || {};
              if (args.message) {
                responseFound = true;
                responseContent = args.message;
              }
            } catch (e) {
              // Ignore
            }
          }
        }
      }
    }
    
    if (responseFound) {
      console.log(`${GREEN}✓ Response: "${responseContent.substring(0, 60)}..."${RESET}`);
      console.log(`Tools called: ${toolsCalled.join(', ')}`);
      return { success: true, response: responseContent, tools: toolsCalled };
    } else {
      console.log(`${RED}✗ No response generated${RESET}`);
      return { success: false, error: 'No response' };
    }
    
  } catch (error) {
    console.log(`${RED}✗ Error: ${error.message}${RESET}`);
    return { success: false, error: error.message };
  }
}

async function runConversationFlow() {
  const results = [];
  
  console.log(`${MAGENTA}Starting conversation flow test...${RESET}`);
  console.log(`Contact ID: ${testContactId}`);
  console.log(`Phone: ${testPhone}`);
  
  // Test conversation flow
  const steps = [
    { message: "hola", description: "Initial greeting" },
    { message: "soy Maria y tengo una tienda de ropa", description: "Provide name and business" },
    { message: "no tengo muchos clientes", description: "Describe problem" },
    { message: "quiero vender más online", description: "State goal" },
    { message: "puedo gastar 400 al mes", description: "Provide budget (qualified)" },
    { message: "mi correo es maria@tienda.com", description: "Provide email" }
  ];
  
  for (const step of steps) {
    const result = await sendMessage(step.message, step.description);
    results.push({ ...step, ...result });
    
    // Small delay between messages
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log(`\n${MAGENTA}=== Test Summary ===${RESET}\n`);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  for (const result of results) {
    const status = result.success ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`${status} ${result.description}`);
    if (!result.success) {
      console.log(`  Error: ${result.error}`);
    }
  }
  
  console.log(`\nTotal: ${results.length}`);
  console.log(`${GREEN}Successful: ${successful}${RESET}`);
  console.log(`${RED}Failed: ${failed}${RESET}`);
  
  const successRate = Math.round((successful / results.length) * 100);
  console.log(`\nSuccess Rate: ${successRate}%`);
  
  if (successRate >= 80) {
    console.log(`\n${GREEN}🎉 Conversation flow test passed!${RESET}`);
  } else {
    console.log(`\n${RED}⚠️  Conversation flow needs improvement${RESET}`);
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

runConversationFlow();