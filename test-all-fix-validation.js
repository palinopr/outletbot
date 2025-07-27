#!/usr/bin/env node
/**
 * Quick validation that "all" response fix is working
 */

import { config as dotenvConfig } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

dotenvConfig();

// Enable tracing
process.env.LANGSMITH_TRACING = 'true';
process.env.LANGSMITH_PROJECT = 'all-fix-validation';

async function validateAllFix() {
  console.log('🔍 Validating "all" response fix...\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );

  // Test case: User says "all" after multi-part question
  const messages = [
    new HumanMessage("Hola"),
    new AIMessage("¡Hola! Soy María de Outlet Media. ¿Me podrías compartir tu nombre?"),
    new HumanMessage("Carlos"),
    new AIMessage("Mucho gusto Carlos. Para poder ayudarte mejor, necesito saber: ¿Cuál es el principal problema con tu negocio? ¿Qué resultado te gustaría lograr?"),
    new HumanMessage("all")
  ];

  const state = {
    messages,
    leadInfo: { name: "Carlos", phone: "+1234567890" },
    contactId: `validate-all-${Date.now()}`,
    conversationId: `conv-validate-${Date.now()}`
  };

  console.log('Scenario: User responds "all" to multi-part question');
  console.log('Previous question asked about: problem & goal');
  console.log('User response: "all"\n');

  try {
    const result = await salesAgent.invoke(state, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: state.contactId,
        thread_id: `validate-${Date.now()}`
      }
    });

    // Check if fields were extracted
    const beforeFields = Object.keys(state.leadInfo).filter(k => state.leadInfo[k]);
    const afterFields = Object.keys(result.leadInfo || {}).filter(k => result.leadInfo[k]);
    const newFields = afterFields.filter(f => !beforeFields.includes(f));

    console.log('\n=== VALIDATION RESULTS ===');
    console.log('Before: ', beforeFields);
    console.log('After:  ', afterFields);
    console.log('New fields extracted:', newFields.length > 0 ? newFields : 'NONE');
    
    // Get last AI message
    const lastAiMessage = result.messages?.filter(m => 
      m._getType?.() === 'ai' || m.type === 'ai'
    ).pop();
    
    console.log('\nAgent response:');
    console.log(lastAiMessage?.content || 'No response');
    
    // Success criteria
    const success = !lastAiMessage?.content?.includes('específico') && 
                   !lastAiMessage?.content?.includes('más detalles');
    
    console.log('\n' + (success ? '✅ FIXED: Agent understood "all" contextually!' : 
                       '❌ NOT FIXED: Agent still asking for clarification'));
    
    return success;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

// Run validation
validateAllFix().then(success => {
  if (success) {
    console.log('\n✅ "All" fix validated! Ready for comprehensive testing.');
  } else {
    console.log('\n❌ "All" fix not working. Please check the implementation.');
  }
  process.exit(success ? 0 : 1);
});