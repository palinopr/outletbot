import { salesAgent } from './agents/salesAgent.js';

console.log('🧪 Testing State Loss Fix\n');

const messages = [
  { role: 'human', content: 'Hola' },
  { role: 'human', content: 'Jaime' },
  { role: 'human', content: 'estoy perdiendo clientes en mi restaurante porque no puedo contestar mensajes' },
  { role: 'human', content: 'que tu puedas contestar todo' },
  { role: 'human', content: '500 mensuales' }
];

let state = {
  messages: [],
  leadInfo: {},
  extractionCount: 0,
  processedMessages: [],
  contactId: 'test-fix-123',
  calendarShown: false
};

console.log('Running conversation...\n');

for (const msg of messages) {
  console.log(`USER: ${msg.content}`);
  
  state.messages.push(msg);
  
  try {
    const result = await salesAgent.invoke(state);
    
    // Update state
    state = { ...state, ...result };
    
    // Find AI response
    const lastAiMsg = state.messages.filter(m => m.role === 'ai').pop();
    const toolCalls = lastAiMsg?.tool_calls || [];
    
    if (toolCalls.length > 0) {
      const sendMsg = toolCalls.find(tc => tc.name === 'send_ghl_message');
      if (sendMsg) {
        console.log(`BOT: ${sendMsg.args.message}\n`);
      }
    }
    
    // Check state after budget extraction
    if (msg.content.includes('500')) {
      console.log('📊 STATE AFTER BUDGET EXTRACTION:');
      console.log('Lead Info:', JSON.stringify(state.leadInfo, null, 2));
      console.log('\n✅ Problem field:', state.leadInfo.problem || '❌ LOST!');
      console.log('✅ Goal field:', state.leadInfo.goal || '❌ LOST!');
      console.log('✅ Budget field:', state.leadInfo.budget);
      
      if (!state.leadInfo.problem || !state.leadInfo.goal) {
        console.log('\n❌ STATE LOSS BUG STILL EXISTS!');
      } else {
        console.log('\n✅ STATE PRESERVED CORRECTLY!');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    break;
  }
}

console.log('\nTest complete!');
process.exit(0);