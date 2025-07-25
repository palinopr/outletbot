import { config } from 'dotenv';
import { graph } from './agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import { GHLService } from './services/ghlService.js';

config();

async function testSimpleFlow() {
  console.log('🎯 Testing simple agent flow...\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  // Start fresh conversation
  const messages = [
    new HumanMessage("hola")
  ];
  
  try {
    console.log('Step 1: Greeting');
    let result = await graph.invoke({
      messages
    }, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: 'Kdj9FkxZc3yq7d5tyT97'
      }
    });
    
    console.log('Agent:', result.messages[result.messages.length - 1].content.substring(0, 100) + '...');
    
    // Add name
    console.log('\nStep 2: Providing name');
    result.messages.push(new HumanMessage("jaime"));
    
    result = await graph.invoke({
      messages: result.messages
    }, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: 'Kdj9FkxZc3yq7d5tyT97'
      }
    });
    
    console.log('Agent:', result.messages[result.messages.length - 1].content.substring(0, 100) + '...');
    
    // Add problem
    console.log('\nStep 3: Providing problem');
    result.messages.push(new HumanMessage("tengo un restaurante y pierdo clientes"));
    
    result = await graph.invoke({
      messages: result.messages
    }, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: 'Kdj9FkxZc3yq7d5tyT97'
      }
    });
    
    console.log('Agent:', result.messages[result.messages.length - 1].content.substring(0, 100) + '...');
    
    // Add budget
    console.log('\nStep 4: Providing budget');
    result.messages.push(new HumanMessage("500 al mes"));
    
    result = await graph.invoke({
      messages: result.messages,
      leadInfo: {
        name: "Jaime",
        businessType: "restaurante",
        problem: "pierdo clientes"
      }
    }, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId: 'Kdj9FkxZc3yq7d5tyT97'
      }
    });
    
    const lastMessage = result.messages[result.messages.length - 1].content;
    console.log('Agent:', lastMessage.substring(0, 200) + '...');
    
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSimpleFlow();