#!/usr/bin/env node
/**
 * Fix for state passing in createReactAgent
 * 
 * Problem: Tools in createReactAgent don't have direct access to agent state
 * Solution: Pass required state through configurable and ensure tools use it properly
 */

import fs from 'fs/promises';

async function fixStatePassing() {
  console.log('🔧 Fixing state passing in salesAgent.js...\n');
  
  // Read the current file
  const filePath = './agents/salesAgent.js';
  let content = await fs.readFile(filePath, 'utf8');
  
  // Fix 1: Update extractLeadInfo to properly access state from configurable
  const extractLeadInfoFix = `// Tool: Extract lead information from messages
const extractLeadInfo = tool(
  async ({ message }, config) => {
    const startTime = Date.now();
    const toolCallId = config.toolCall?.id || 'extract_lead_info';
    
    logger.info('🔍 EXTRACT LEAD INFO START', {
      toolCallId,
      messageLength: message.length,
      messagePreview: message.substring(0, 50)
    });
    
    try {
      // Access state from configurable - this is passed from the agent invoke
      const currentLeadInfo = config?.configurable?.leadInfo || {};
      const extractionCount = config?.configurable?.extractionCount || 0;
      const processedMessages = config?.configurable?.processedMessages || [];
      const messages = config?.configurable?.messages || [];`;
  
  // Find and replace the extractLeadInfo tool definition
  const extractToolRegex = /\/\/ Tool: Extract lead information from messages[\s\S]*?try \{[\s\S]*?const processedMessages = currentState\.processedMessages \|\| \[\];/;
  
  if (extractToolRegex.test(content)) {
    content = content.replace(extractToolRegex, extractLeadInfoFix);
    console.log('✅ Fixed extractLeadInfo state access');
  }
  
  // Fix 2: Update getCalendarSlots to use configurable
  const calendarSlotsFix = `// Tool: Get calendar slots (ONLY after full qualification)
const getCalendarSlots = tool(
  async ({ startDate, endDate }, config) => {
    const toolCallId = config.toolCall?.id || 'get_calendar_slots';
    
    // Access state from configurable
    const currentLeadInfo = config?.configurable?.leadInfo || {};
    
    logger.debug('📅 Calendar tool state access', {
      hasConfigurable: !!config.configurable,
      leadInfoKeys: Object.keys(currentLeadInfo)
    });`;
  
  const calendarToolRegex = /\/\/ Tool: Get calendar slots \(ONLY after full qualification\)[\s\S]*?logger\.debug\('\ud83d\udcc5 Calendar tool state access'[\s\S]*?\}\);/;
  
  if (calendarToolRegex.test(content)) {
    content = content.replace(calendarToolRegex, calendarSlotsFix);
    console.log('✅ Fixed getCalendarSlots state access');
  }
  
  // Fix 3: Update agent invocation to pass state through configurable
  const agentInvokeFix = `// Create the agent with modern parameters
export const salesAgent = createReactAgent({
  llm: modelWithTools,
  tools: tools,
  stateSchema: AgentStateAnnotation,  // Custom state schema
  checkpointer: checkpointer,
  messageModifier: promptFunction,
  preModelStreamSteps: [preModelHook]
});

// Export a wrapper that ensures state is passed to tools
export const graph = {
  invoke: async (state, options) => {
    // Ensure state is available to tools through configurable
    const enhancedOptions = {
      ...options,
      configurable: {
        ...options?.configurable,
        leadInfo: state.leadInfo,
        messages: state.messages,
        extractionCount: state.extractionCount || 0,
        processedMessages: state.processedMessages || [],
        availableSlots: state.availableSlots || []
      }
    };
    
    return salesAgent.invoke(state, enhancedOptions);
  }
};`;
  
  const agentCreateRegex = /\/\/ Create the agent with modern parameters[\s\S]*?export const salesAgent[\s\S]*?\}\);/;
  
  if (agentCreateRegex.test(content)) {
    content = content.replace(agentCreateRegex, agentInvokeFix);
    console.log('✅ Added graph wrapper for state passing');
  }
  
  // Write the fixed content
  await fs.writeFile(filePath, content);
  console.log('\n✅ State passing fixes applied!');
  console.log('\nKey changes:');
  console.log('1. Tools now access state from config.configurable');
  console.log('2. Added graph wrapper that ensures state is passed to tools');
  console.log('3. All state fields are available through configurable');
}

// Run the fix
fixStatePassing().catch(console.error);