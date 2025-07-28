import { exportedTools } from './agents/salesAgent.js';
const { getCalendarSlots } = exportedTools;
import dotenv from 'dotenv';

dotenv.config();

async function testCalendarTool() {
  console.log('🔍 Testing Calendar Tool Directly\n');
  
  // Mock the config that would come from the agent
  const mockConfig = {
    toolCall: { id: 'test-tool-call' },
    configurable: {
      ghlService: null, // Will be created by the tool
      calendarId: process.env.GHL_CALENDAR_ID,
      contactId: 'Jf5Hc0JRXrnqCjQGHTEU'
    }
  };
  
  // Mock state with qualified lead info
  const mockState = {
    leadInfo: {
      name: 'Carlos',
      problem: 'no tengo clientes',
      goal: 'llenar mi restaurante',
      budget: 500,
      email: 'carlos@restaurante.com',
      phone: '+13054870475'
    }
  };
  
  try {
    console.log('Lead Info:', mockState.leadInfo);
    console.log('Calendar ID:', process.env.GHL_CALENDAR_ID);
    console.log('\nCalling getCalendarSlots tool...\n');
    
    // Call the tool directly
    const result = await getCalendarSlots.invoke({}, mockConfig);
    
    console.log('Tool Result:', result);
    
    // Check if we got slots
    if (result.update?.availableSlots?.length > 0) {
      console.log('\n✅ Calendar slots retrieved!');
      console.log(`Total slots: ${result.update.availableSlots.length}`);
      console.log('First 3 slots:');
      result.update.availableSlots.slice(0, 3).forEach(slot => {
        console.log(`  ${slot.index}. ${slot.display}`);
      });
    } else {
      console.log('\n❌ No calendar slots found');
      if (result.update?.messages?.[0]) {
        console.log('Tool message:', result.update.messages[0].content);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error calling tool:', error.message);
    console.error('Stack:', error.stack);
  }
}

testCalendarTool();