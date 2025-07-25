import { config } from 'dotenv';
import { salesAgent } from './agents/salesAgent.js';
import { GHLService } from './services/ghlService.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

config();

async function testNewConversation() {
  console.log('🆕 Testing as if it\'s a new conversation...\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  const contactId = 'Kdj9FkxZc3yq7d5tyT97';
  
  // Simulate a conversation that has progressed to the budget stage
  const existingMessages = [
    new HumanMessage("hola"),
    new AIMessage("¡Hola! Soy María, tu asistente de ventas de Outlet Media. ¿Cuál es tu nombre?"),
    new HumanMessage("soy Carlos"),
    new AIMessage("¡Mucho gusto Carlos! ¿Qué tipo de negocio tienes y qué problema estás enfrentando?"),
    new HumanMessage("tengo una tienda de ropa y no tengo suficientes clientes"),
    new AIMessage("Entiendo Carlos. ¿Cuál es tu objetivo principal? ¿Qué te gustaría lograr?"),
    new HumanMessage("quiero duplicar mis ventas este año"),
    new AIMessage("¡Excelente meta! Para ofrecerte la mejor solución, ¿cuál es tu presupuesto mensual para marketing?")
  ];
  
  // Now customer responds with budget
  const newMessage = new HumanMessage("tengo 400 dolares al mes");
  const allMessages = [...existingMessages, newMessage];
  
  console.log('📨 Customer says: "tengo 400 dolares al mes"');
  console.log('Expected: Agent should ask for email since budget is >$300\n');
  
  try {
    const result = await salesAgent({
      messages: allMessages,
      leadInfo: {
        name: "Carlos",
        businessType: "tienda de ropa",
        problem: "no tengo suficientes clientes",
        goal: "duplicar ventas este año",
        budget: null, // Agent should extract this from the message
        email: null
      },
      contactId
    }, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId
      }
    });
    
    const agentResponse = result.messages[result.messages.length - 1];
    console.log('🤖 Agent response:');
    console.log(agentResponse.content);
    
    // Analyze response
    console.log('\n📊 Response Analysis:');
    const response = agentResponse.content.toLowerCase();
    
    const checks = {
      'Mentioned Carlos': response.includes('carlos'),
      'Acknowledged $400 budget': response.includes('400'),
      'Asked for email': response.includes('email') || response.includes('correo'),
      'Professional tone': !response.includes('error') && !response.includes('problema técnico'),
      'Context aware': !response.includes('nombre?') && !response.includes('tipo de negocio')
    };
    
    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${check}`);
    });
    
    const score = Object.values(checks).filter(v => v).length;
    console.log(`\n🏆 Score: ${score}/5`);
    
    if (score >= 4) {
      console.log('✅ SUCCESS: Agent is working properly!');
    } else {
      console.log('⚠️  Agent needs improvement');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testNewConversation();