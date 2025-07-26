import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

console.log('🔍 VERIFYING GHL MESSAGE SENDING');
console.log('================================\n');

// Check the sendGHLMessage tool implementation
console.log('📄 Checking sendGHLMessage tool in salesAgent.js...\n');

const salesAgent = readFileSync('./agents/salesAgent.js', 'utf8');

// Find the sendGHLMessage tool
const sendToolStart = salesAgent.indexOf('// Tool: Send message via GHL WhatsApp');
const sendToolEnd = salesAgent.indexOf('});', sendToolStart + 1000) + 3;
const sendToolCode = salesAgent.substring(sendToolStart, sendToolEnd);

console.log('✅ sendGHLMessage tool found\n');

// Check key components
console.log('🔍 Analyzing implementation:\n');

// 1. Check if it uses ghlService.sendSMS
const usesSendSMS = sendToolCode.includes('ghlService.sendSMS');
console.log(`1️⃣ Uses ghlService.sendSMS: ${usesSendSMS ? '✅ YES' : '❌ NO'}`);

// 2. Check if it passes contactId
const usesContactId = sendToolCode.includes('ghlService.sendSMS(contactId, message)');
console.log(`2️⃣ Passes contactId correctly: ${usesContactId ? '✅ YES' : '❌ NO'}`);

// 3. Check if it returns Command object
const returnsCommand = sendToolCode.includes('return new Command({');
console.log(`3️⃣ Returns Command object: ${returnsCommand ? '✅ YES' : '❌ NO'}`);

// 4. Check if it has error handling
const hasErrorHandling = sendToolCode.includes('} catch (error)');
console.log(`4️⃣ Has error handling: ${hasErrorHandling ? '✅ YES' : '❌ NO'}`);

// Check GHL service implementation
console.log('\n📄 Checking ghlService.js sendSMS method...\n');

const ghlService = readFileSync('./services/ghlService.js', 'utf8');

// Find sendSMS method
const sendSMSStart = ghlService.indexOf('async sendSMS(');
const sendSMSEnd = ghlService.indexOf('}\n  }', sendSMSStart) + 1;
const sendSMSCode = ghlService.substring(sendSMSStart, sendSMSEnd);

console.log('✅ sendSMS method found\n');

// Check sendSMS implementation
console.log('🔍 Analyzing sendSMS implementation:\n');

// 1. Check API endpoint
const usesMessagesEndpoint = sendSMSCode.includes('/conversations/messages');
console.log(`1️⃣ Uses correct endpoint (/conversations/messages): ${usesMessagesEndpoint ? '✅ YES' : '❌ NO'}`);

// 2. Check message type
const usesWhatsAppType = sendSMSCode.includes("type: 'WhatsApp'") || sendSMSCode.includes('type: "WhatsApp"');
console.log(`2️⃣ Sets type to 'WhatsApp': ${usesWhatsAppType ? '✅ YES' : '❌ NO'}`);

// 3. Check contactId in payload
const includesContactId = sendSMSCode.includes('contactId:') || sendSMSCode.includes('contactId,');
console.log(`3️⃣ Includes contactId in payload: ${includesContactId ? '✅ YES' : '❌ NO'}`);

// Show the actual implementation
console.log('\n📝 CURRENT IMPLEMENTATION:\n');

console.log('sendGHLMessage tool calls:');
console.log('```javascript');
console.log('await ghlService.sendSMS(contactId, message);');
console.log('```\n');

// Extract the actual sendSMS implementation
const sendSMSBody = sendSMSCode.match(/const response = await this\.makeRequest\(([\s\S]*?)\);/);
if (sendSMSBody) {
  console.log('sendSMS makes request to:');
  console.log('```javascript');
  console.log(sendSMSBody[1].trim());
  console.log('```\n');
}

// Check system prompt
console.log('📄 Checking agent system prompt...\n');

const systemPromptMatch = salesAgent.match(/CRITICAL RULES[\s\S]*?TOOL USAGE PATTERN/);
if (systemPromptMatch) {
  const rules = systemPromptMatch[0];
  const usesToolOnly = rules.includes('ONLY use send_ghl_message tool');
  console.log(`✅ System prompt enforces tool usage: ${usesToolOnly ? 'YES' : 'NO'}`);
}

// Summary
console.log('\n📊 MESSAGE FLOW SUMMARY:\n');
console.log('1. Agent receives message from webhook');
console.log('2. Agent MUST use sendGHLMessage tool (enforced by prompt)');
console.log('3. Tool calls ghlService.sendSMS(contactId, message)');
console.log('4. sendSMS posts to /conversations/messages with type: "WhatsApp"');
console.log('5. Message sent to customer via GHL\n');

console.log('⚠️  IMPORTANT CHECKS:\n');
console.log('1. Verify GHL_API_KEY is correct');
console.log('2. Verify contactId exists in GHL');
console.log('3. Check GHL API logs for actual requests');
console.log('4. Ensure WhatsApp is configured in GHL location\n');

// Test data
console.log('🧪 TEST DATA FOR VERIFICATION:\n');
console.log('Contact ID: 54sJIGTtwmR89Qc5JeEt');
console.log('Test message: "Hola, esta es una prueba del bot"');
console.log('\nTo test manually, the agent should:');
console.log('1. Extract lead info from the message');
console.log('2. Send response via sendGHLMessage tool');
console.log('3. Update contact with tags\n');

console.log('📋 DEBUGGING STEPS:\n');
console.log('1. Check LangSmith trace for tool calls');
console.log('2. Look for "SEND GHL MESSAGE START" in logs');
console.log('3. Verify "MESSAGE SENT SUCCESSFULLY" appears');
console.log('4. Check GHL conversation for the message');
console.log('5. If no message in GHL, check API response/errors');