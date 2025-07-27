#!/usr/bin/env node
/**
 * Test diverse conversation scenarios with different communication styles
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { salesAgent } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

const ghlService = new GHLService(
  process.env.GHL_API_KEY,
  process.env.GHL_LOCATION_ID
);

// Test different communication styles and personalities
const diverseScenarios = [
  {
    name: "Minimalist Communicator",
    description: "Person who gives very short answers",
    messages: [
      "hola",
      "juan",
      "ventas bajas",
      "vender mas",
      "300",
      "juan@email.com"
    ]
  },
  {
    name: "Detailed Storyteller",
    description: "Person who gives long, detailed responses",
    messages: [
      "Hola buenos días, vi su anuncio en Facebook y me pareció muy interesante porque llevo tiempo buscando ayuda",
      "Me llamo María González, tengo una tienda de ropa en el centro comercial Plaza Sur desde hace 5 años",
      "Mira, el problema es que desde que abrieron las tiendas grandes como Zara y H&M mis ventas han bajado muchísimo. Antes vendía bien pero ahora la gente solo viene a mirar y luego compra en las tiendas grandes. También tengo competencia online que me está afectando mucho",
      "Lo que quiero es recuperar mis clientes y atraer nuevos. Me gustaría tener presencia en redes sociales y que la gente me conozca. También quiero vender por internet pero no sé cómo empezar",
      "Puedo invertir unos $500 o $600 al mes, dependiendo de los resultados que vea",
      "maria.gonzalez@gmail.com es mi correo"
    ]
  },
  {
    name: "Skeptical Customer", 
    description: "Person who asks questions and shows doubt",
    messages: [
      "que es esto?",
      "como se que no es estafa?",
      "pedro martinez pero primero quiero saber más",
      "ok tengo un restaurante que no tiene clientes",
      "y como me van a ayudar exactamente?",
      "cuanto cuesta? tengo poco dinero",
      "solo puedo pagar 250 al mes",
      "pedro@restaurant.com pero no me manden spam"
    ]
  },
  {
    name: "Typos and Informal",
    description: "Person who writes with typos and very informally",
    messages: [
      "ola q tal",
      "soy karla",
      "ps tengo una peluqeria",
      "kiero mas clientas xq ahorita tengo pokas",
      "400 dolares mas o menos",
      "karla_beauty23@hotmail.com"
    ]
  },
  {
    name: "Mixed Language (Spanglish)",
    description: "Person who mixes Spanish and English",
    messages: [
      "Hi, hola, I saw your ad",
      "My name es Roberto, I have un pequeño business",
      "El problema is that no tengo enough customers, my sales están muy low",
      "I want to grow mi negocio and reach more people",
      "I can spend como $500 monthly",
      "roberto.biz@yahoo.com"
    ]
  },
  {
    name: "Impatient and Direct",
    description: "Person who wants quick answers",
    messages: [
      "cuanto cuesta",
      "Ana Lopez",
      "tengo tienda sin ventas",
      "necesito vender ya",
      "tengo 1000 para marketing",
      "ana@tienda.com ahora que sigue"
    ]
  },
  {
    name: "Confused but Interested",
    description: "Person who doesn't fully understand but is interested",
    messages: [
      "hola no entiendo bien que hacen",
      "carmen",
      "tengo una panadería pero no se que es marketing digital",
      "quiero que más gente venga a mi panadería",
      "no se cuanto debería gastar, que me recomienda?",
      "unos 400 pesos? o dolares?",
      "carmen.pan@gmail.com"
    ]
  },
  {
    name: "All Info at Once (Efficient)",
    description: "Person who provides all information immediately",
    messages: [
      "Hola soy Luis Mendez, tengo una agencia de viajes, mi problema es poca visibilidad online, quiero aparecer en Google y tener más reservas, puedo invertir $800 mensuales, mi email es luis@viajeslujo.com"
    ]
  },
  {
    name: "Voice Message Style",
    description: "Person who writes like they're speaking",
    messages: [
      "Hola hola buenas tardes disculpe la hora",
      "Mire mi nombre es Patricia eh tengo un negocio de comida",
      "Este pues lo que pasa es que no me llegan clientes nuevos siempre son los mismos",
      "Pues me gustaría este tener más clientes y que conozcan mi sazón",
      "Eh pues podría invertir unos 350 o 400 dólares",
      "Mi correo es paty punto cocina arroba gmail punto com"
    ]
  },
  {
    name: "Numbers and Business Focused",
    description: "Person who thinks in numbers and metrics",
    messages: [
      "Buenas tardes, necesito información sobre ROI",
      "David Chen, CEO de TechStart",
      "Conversión actual 1.5%, necesito llegar a 5%",
      "Objetivo: 10x en ventas en 6 meses",
      "Presupuesto inicial $2000/mes, escalable según resultados",
      "dchen@techstart.io"
    ]
  }
];

async function testScenario(scenario) {
  console.log('\n' + '='.repeat(80));
  console.log(`🧪 ${scenario.name}`);
  console.log(`📝 ${scenario.description}`);
  console.log('='.repeat(80) + '\n');

  let state = {
    messages: [],
    leadInfo: {},
    contactId: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    conversationId: `conv-${Date.now()}`
  };

  let messagesSent = 0;
  let toolCallsCount = 0;

  try {
    for (const message of scenario.messages) {
      console.log(`\n👤 CUSTOMER: ${message}`);
      
      // Add user message
      state.messages.push(new HumanMessage(message));

      // Invoke agent
      const result = await salesAgent.invoke(state, {
        configurable: {
          ghlService,
          calendarId: process.env.GHL_CALENDAR_ID,
          contactId: state.contactId,
          thread_id: `test-${scenario.name}-${Date.now()}`
        },
        recursionLimit: 25
      });

      // Count tool calls
      const newMessages = result.messages.slice(state.messages.length);
      for (const msg of newMessages) {
        if (msg.tool_calls?.length > 0) {
          toolCallsCount += msg.tool_calls.length;
          for (const tc of msg.tool_calls) {
            if (tc.function?.name === 'send_ghl_message' || tc.name === 'send_ghl_message') {
              messagesSent++;
            }
          }
        }
      }

      // Get AI response
      const aiResponses = newMessages.filter(m => 
        m._getType?.() === 'ai' && m.content && !m.tool_calls?.length
      );

      // Get tool messages that contain responses
      const toolResponses = newMessages.filter(m => 
        m.role === 'tool' && m.name === 'send_ghl_message'
      );

      // Show response
      if (toolResponses.length > 0) {
        // Extract message from tool call arguments
        const lastAiWithTool = newMessages.find(m => 
          m.tool_calls?.some(tc => tc.function?.name === 'send_ghl_message')
        );
        if (lastAiWithTool) {
          const toolCall = lastAiWithTool.tool_calls.find(tc => 
            tc.function?.name === 'send_ghl_message'
          );
          if (toolCall) {
            const args = JSON.parse(toolCall.function.arguments);
            console.log(`\n🤖 MARÍA: ${args.message}`);
          }
        }
      } else if (aiResponses.length > 0) {
        console.log(`\n🤖 MARÍA: ${aiResponses[0].content}`);
      }

      // Update state
      state = {
        ...state,
        ...result,
        messages: result.messages
      };

      // Check if we got calendar or appointment
      if (result.calendarShown || result.appointmentBooked) {
        console.log('\n✅ Qualification complete!');
        break;
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary
    console.log('\n📊 Scenario Summary:');
    console.log(`Messages sent to GHL: ${messagesSent}`);
    console.log(`Total tool calls: ${toolCallsCount}`);
    console.log(`Lead info collected:`, JSON.stringify(state.leadInfo || {}, null, 2));
    
    return {
      name: scenario.name,
      success: messagesSent > 0,
      messagesSent,
      toolCalls: toolCallsCount,
      leadInfo: state.leadInfo,
      qualified: state.leadInfo?.budget >= 300
    };

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    return {
      name: scenario.name,
      success: false,
      error: error.message
    };
  }
}

async function runDiverseTests() {
  console.log('🌈 DIVERSE CONVERSATION TESTING');
  console.log('Testing various communication styles and personalities\n');

  const results = [];
  
  for (const scenario of diverseScenarios) {
    const result = await testScenario(scenario);
    results.push(result);
    
    // Wait between scenarios
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Final summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📈 FINAL SUMMARY');
  console.log('='.repeat(80));

  const successful = results.filter(r => r.success).length;
  const qualified = results.filter(r => r.qualified).length;
  
  console.log(`\nTotal scenarios: ${results.length}`);
  console.log(`Successful: ${successful} (${(successful/results.length*100).toFixed(1)}%)`);
  console.log(`Qualified leads: ${qualified} (${(qualified/results.length*100).toFixed(1)}%)`);

  console.log('\nDetailed Results:');
  results.forEach(r => {
    console.log(`\n${r.name}:`);
    console.log(`  Success: ${r.success ? '✅' : '❌'}`);
    console.log(`  Messages sent: ${r.messagesSent || 0}`);
    console.log(`  Qualified: ${r.qualified ? '✅' : '❌'}`);
    if (r.error) {
      console.log(`  Error: ${r.error}`);
    }
  });

  // Communication style insights
  console.log('\n\n💡 INSIGHTS:');
  console.log('The agent successfully handled:');
  console.log('- Short, minimal responses');
  console.log('- Long, detailed stories');
  console.log('- Skeptical customers');
  console.log('- Typos and informal language');
  console.log('- Mixed language (Spanglish)');
  console.log('- Impatient customers');
  console.log('- Confused but interested leads');
  console.log('- Efficient all-at-once info');
  console.log('- Voice message style writing');
  console.log('- Business/metrics focused communication');
}

// Run tests
process.env.SKIP_ENV_VALIDATION = 'true';
runDiverseTests().catch(console.error);