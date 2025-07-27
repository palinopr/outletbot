#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 DIRECT EXTRACTION TEST\n');

import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage } from '@langchain/core/messages';

// Test the exact extraction logic used in the sales agent
async function testDirectExtraction() {
  const llm = new ChatOpenAI({ 
    model: "gpt-4", 
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY
  });
  
  // Test messages
  const testMessages = [
    {
      message: "Hola soy Carlos Rodriguez",
      currentInfo: {}
    },
    {
      message: "tengo un restaurante mexicano y no tengo clientes",
      currentInfo: { name: "Carlos Rodriguez" }
    },
    {
      message: "quiero llenar mi restaurante todos los dias",
      currentInfo: { name: "Carlos Rodriguez", problem: "no tengo clientes" }
    },
    {
      message: "puedo gastar 600 dolares al mes",
      currentInfo: { name: "Carlos Rodriguez", problem: "no tengo clientes", goal: "llenar restaurante" }
    },
    {
      message: "mi correo es carlos@restaurant.com",
      currentInfo: { name: "Carlos Rodriguez", problem: "no tengo clientes", goal: "llenar restaurante", budget: 600 }
    },
    {
      // Problematic case: all info in one message
      message: "Hola soy Jaime tengo un negocio de comida necesito mas clientes quiero crecer puedo pagar 500 dolares jaime@negocio.com",
      currentInfo: {}
    }
  ];
  
  console.log('Testing extraction with actual prompt format...\n');
  
  for (const test of testMessages) {
    console.log('='.repeat(60));
    console.log(`\nMessage: "${test.message}"`);
    console.log(`Current info: ${JSON.stringify(test.currentInfo)}`);
    
    const prompt = `Analyze this customer message and extract any information provided:
      Message: "${test.message}"
      
      Current info we already have: ${JSON.stringify(test.currentInfo)}
      
      Extract any NEW information (if mentioned):
      - Name
      - BusinessType (restaurant, store, clinic, salon, etc)
      - Problem/Pain point
      - Goal
      - Budget (IMPORTANT: Look for numbers with "mes", "mensual", "al mes", "por mes", "$". Examples: "500 al mes" = 500, "$1000 mensual" = 1000)
      - Email
      - Any specific details about their business
      
      For budget, if you see a number followed by any monthly indicator, extract just the number.
      
      Return ONLY a JSON object with any new/updated fields. Do NOT include fields that haven't changed.
      Example: If current name is "Jaime" and message doesn't mention a different name, don't include "name" in response.`;
    
    try {
      const response = await llm.invoke([
        new SystemMessage("You extract information from messages. Return only valid JSON with ONLY new/changed fields."),
        { role: "user", content: prompt }
      ]);
      
      console.log(`\nLLM Response: ${response.content}`);
      
      try {
        const extracted = JSON.parse(response.content);
        console.log(`Parsed JSON: ${JSON.stringify(extracted)}`);
        
        // Check field names
        const extractedKeys = Object.keys(extracted);
        console.log(`Fields extracted: ${extractedKeys.join(', ') || 'NONE'}`);
        
        // Check for case mismatches
        const hasUppercaseKeys = extractedKeys.some(key => key !== key.toLowerCase());
        if (hasUppercaseKeys) {
          console.log('⚠️  WARNING: Extracted fields have uppercase letters!');
          console.log('   This may cause issues with state management.');
        }
        
      } catch (parseError) {
        console.log(`❌ Failed to parse JSON: ${parseError.message}`);
      }
      
    } catch (error) {
      console.log(`❌ LLM Error: ${error.message}`);
    }
  }
  
  console.log('\n\n' + '='.repeat(60));
  console.log('ANALYSIS:');
  console.log('If the LLM returns field names with different casing than expected,');
  console.log('the extraction will fail to update the state properly.');
  console.log('\nFor example:');
  console.log('- LLM returns: { "Name": "Carlos" }');
  console.log('- Code expects: { "name": "Carlos" }');
  console.log('\nThis mismatch would cause fields to not be saved correctly.');
}

// Run test
testDirectExtraction().catch(console.error);