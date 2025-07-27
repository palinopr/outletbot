#!/usr/bin/env node
/**
 * Debug core issue - trace 1f06b412-7aa4-6962-922c-65da2ce33823
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

console.log('🔍 CORE ISSUE ANALYSIS\n');

console.log('PROBLEM IDENTIFIED:');
console.log('1. Agent sees ALL conversation history (inbound AND outbound)');
console.log('2. All outbound messages become AIMessages');
console.log('3. Agent thinks it needs to respond to AIMessages');
console.log('4. This creates loops and self-conversation\n');

console.log('CURRENT FLOW:');
console.log('User: "Hola"');
console.log('History from GHL:');
console.log('  - HumanMessage: "Hola" (3 days ago)');
console.log('  - AIMessage: "¡Hola! Soy María..." (3 days ago)');
console.log('  - HumanMessage: "Soy Juan" (3 days ago)');
console.log('  - AIMessage: "Mucho gusto Juan..." (3 days ago)');
console.log('  - HumanMessage: "Hola" (now)\n');

console.log('AGENT SEES: 5 messages total');
console.log('AGENT THINKS: Multiple messages need responses');
console.log('RESULT: Confusion and loops\n');

console.log('ROOT CAUSE:');
console.log('The agent is designed to respond to ALL messages in the array,');
console.log('not just the latest one. The conversation history is being');
console.log('treated as NEW messages to process.\n');

console.log('SOLUTION NEEDED:');
console.log('1. Only pass the CURRENT message to the agent');
console.log('2. Pass conversation history separately as context');
console.log('3. OR modify agent to only process the last message');
console.log('4. OR create a clear separation between history and current\n');

console.log('RECOMMENDED FIX:');
console.log('Modify webhookHandler.js to only pass the current message');
console.log('to the agent, with history available in state but not in');
console.log('the messages array.');