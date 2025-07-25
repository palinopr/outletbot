// Test conversation logic without actual GHL calls
import { exportedTools } from '../agents/salesAgent.js';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';

dotenv.config();

const { extractLeadInfo } = exportedTools;

async function testConversationLogic() {
  console.log('Testing conversation logic...\n');
  
  // Test 1: Extract info from restaurant message
  console.log('TEST 1: Extract business info from message');
  const extracted = await extractLeadInfo.invoke({
    message: "Tengo un restaurante y perdiendo muchos clientes no puedo contestar",
    currentInfo: {
      name: "Jaime",
      businessType: "",
      problem: "",
      goal: "",
      budget: 0,
      email: ""
    }
  });
  
  console.log('Extracted:', extracted);
  console.log('✅ Should extract businessType: restaurant and problem info\n');
  
  // Test 2: Check what question bot should ask
  console.log('TEST 2: Determine next question based on existing info');
  
  const scenarios = [
    {
      info: { name: null },
      expected: "Ask for name"
    },
    {
      info: { name: "Jaime", problem: null },
      expected: "Ask about problem"
    },
    {
      info: { name: "Jaime", problem: "losing customers", goal: null },
      expected: "Ask about goal"
    },
    {
      info: { name: "Jaime", problem: "losing customers", goal: "increase sales", budget: null },
      expected: "Ask about budget"
    }
  ];
  
  for (const scenario of scenarios) {
    console.log(`\nScenario: Have ${JSON.stringify(scenario.info)}`);
    console.log(`Expected: ${scenario.expected}`);
    
    // Simulate what the bot should do
    const llm = new ChatOpenAI({ model: "gpt-4", temperature: 0 });
    
    const prompt = `Based on this customer info, what should you ask next?
    Current info: ${JSON.stringify(scenario.info)}
    
    Rules:
    - If no name → Ask for name
    - If have name but no problem → Ask about problem
    - If have name + problem but no goal → Ask about goal
    - If have name + problem + goal but no budget → Ask about budget
    
    Answer with just the question type.`;
    
    const response = await llm.invoke([
      new SystemMessage("You determine what question to ask next in a sales flow."),
      { role: "user", content: prompt }
    ]);
    
    console.log(`Bot decides: ${response.content.trim()}`);
  }
  
  console.log('\n✅ Logic tests completed');
}

testConversationLogic();