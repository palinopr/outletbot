import { config } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

config();

async function testAgentDirect() {
  console.log('🧪 Testing agent directly with conversation history...\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  // Simulate conversation history
  const messages = [
    new HumanMessage("hola"),
    new AIMessage("¡Hola! Soy María, tu asistente de ventas de Outlet Media, completamente alimentada por inteligencia artificial. ¿Podrías compartirme tu nombre, por favor?"),
    new HumanMessage("jaime"),
    new AIMessage("¡Hola Jaime! Soy María, una asistente de inteligencia artificial especializada en ayudar a las empresas a automatizar sus interacciones con los clientes. ¿Podrías contarme un poco más sobre tu negocio y qué desafíos estás enfrentando actualmente? 😊"),
    new HumanMessage("tengo un restaurante y estoy perdiendo muchos clientes oq no puedo contestarle a todos"),
    new HumanMessage("500 al mes") // New message about budget
  ];
  
  const leadInfo = {
    name: "Jaime",
    businessType: "restaurante",
    problem: "perdiendo clientes por no poder contestar a todos",
    goal: null,
    budget: null,
    email: null
  };
  
  try {
    console.log('📨 Sending messages to agent...');
    console.log(`Messages: ${messages.length} (including new budget message)`);
    console.log('Lead info provided:', leadInfo);
    
    const result = await salesAgent({
      messages,
      leadInfo,
      contactId: 'Kdj9FkxZc3yq7d5tyT97'
    }, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: 'Kdj9FkxZc3yq7d5tyT97',
        currentLeadInfo: leadInfo
      }
    });
    
    console.log('\n✅ Agent processed successfully!');
    console.log('Response messages:', result.messages.length);
    
    const lastMessage = result.messages[result.messages.length - 1];
    console.log('\n🤖 Agent response:');
    console.log(lastMessage.content);
    
    // Check response quality
    console.log('\n📊 Response analysis:');
    const response = lastMessage.content.toLowerCase();
    
    const goodSigns = {
      'Mentioned Jaime': response.includes('jaime'),
      'Mentioned restaurant': response.includes('restaurante'),
      'Mentioned $500 budget': response.includes('500'),
      'Asked for email': response.includes('email') || response.includes('correo'),
      'Shows context awareness': !response.includes('nombre?') && !response.includes('qué tipo de negocio')
    };
    
    Object.entries(goodSigns).forEach(([check, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${check}`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAgentDirect();