#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 TESTING FIXED EXTRACTION\n');

import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage } from '@langchain/core/messages';

// Test with the fixed prompt
async function testFixedExtraction() {
  const llm = new ChatOpenAI({ 
    model: "gpt-4", 
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY
  });
  
  // Critical test case: all info in one message
  const testCase = {
    message: "Hola soy Jaime tengo un negocio de comida necesito mas clientes quiero crecer puedo pagar 500 dolares jaime@negocio.com",
    currentInfo: {}
  };
  
  console.log('Testing extraction with FIXED prompt...\n');
  console.log(`Message: "${testCase.message}"`);
  console.log(`Current info: ${JSON.stringify(testCase.currentInfo)}`);
  
  // Fixed prompt with lowercase field names
  const prompt = `Analyze this customer message and extract any information provided:
      Message: "${testCase.message}"
      
      Current info we already have: ${JSON.stringify(testCase.currentInfo)}
      
      Extract any NEW information (if mentioned):
      - name (person's name)
      - businessType (restaurant, store, clinic, salon, etc)
      - problem (their pain point or challenge)
      - goal (what they want to achieve)
      - budget (IMPORTANT: Look for numbers with "mes", "mensual", "al mes", "por mes", "$". Examples: "500 al mes" = 500, "$1000 mensual" = 1000)
      - email (email address)
      - businessDetails (any specific details about their business)
      
      For budget, if you see a number followed by any monthly indicator, extract just the number.
      
      Return ONLY a JSON object with any new/updated fields using LOWERCASE field names.
      Example response: {"name": "Carlos", "problem": "no tengo clientes", "budget": 500}
      
      Do NOT include fields that haven't changed or weren't mentioned.`;
  
  try {
    console.log('\nCalling LLM with fixed prompt...');
    
    const response = await llm.invoke([
      new SystemMessage("You extract information from messages. Return only valid JSON with ONLY new/changed fields. Use lowercase field names: name, businessType, problem, goal, budget, email, businessDetails."),
      { role: "user", content: prompt }
    ]);
    
    console.log(`\nLLM Response: ${response.content}`);
    
    try {
      const extracted = JSON.parse(response.content);
      console.log(`\nParsed JSON: ${JSON.stringify(extracted, null, 2)}`);
      
      // Check field names
      const extractedKeys = Object.keys(extracted);
      console.log(`\nFields extracted: ${extractedKeys.join(', ')}`);
      
      // Verify all fields are lowercase
      const hasUppercaseKeys = extractedKeys.some(key => key !== key.toLowerCase());
      if (hasUppercaseKeys) {
        console.log('❌ ERROR: Some fields still have uppercase letters!');
      } else {
        console.log('✅ SUCCESS: All fields are lowercase!');
      }
      
      // Check if all expected fields were extracted
      const expectedFields = ['name', 'businessType', 'problem', 'goal', 'budget', 'email'];
      const extractedExpected = expectedFields.filter(field => field in extracted);
      
      console.log(`\nExpected fields extracted: ${extractedExpected.length}/${expectedFields.length}`);
      extractedExpected.forEach(field => {
        console.log(`  ✅ ${field}: ${extracted[field]}`);
      });
      
      const missingFields = expectedFields.filter(field => !(field in extracted));
      if (missingFields.length > 0) {
        console.log(`\nMissing fields:`);
        missingFields.forEach(field => {
          console.log(`  ❌ ${field}`);
        });
      }
      
    } catch (parseError) {
      console.log(`❌ Failed to parse JSON: ${parseError.message}`);
    }
    
  } catch (error) {
    console.log(`❌ LLM Error: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('CONCLUSION:');
  console.log('The fixed prompt should now return lowercase field names that match');
  console.log('what the code expects, fixing the extraction issue.');
}

// Run test
testFixedExtraction().catch(console.error);