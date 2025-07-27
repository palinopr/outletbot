// DEMONSTRATION: How to fix the extractLeadInfo tool

// CURRENT BROKEN VERSION (no context):
async function extractLeadInfo_BROKEN({ message }) {
  const prompt = `Analyze this customer message:
  Message: "${message}"
  
  Extract: name, problem, goal, budget, email`;
  
  // This CANNOT understand:
  // Bot: "What's your budget?"
  // User: "500" <-- No context that this is budget
  // User: "all" <-- No context about what "all" refers to
}

// FIXED VERSION (with context):
async function extractLeadInfo_FIXED({ message }, config) {
  // Get conversation context from state
  const state = await config.getState();
  const messages = state.messages || [];
  
  // Get last 3 messages for context
  const recentMessages = messages.slice(-3);
  const conversationContext = recentMessages.map((msg, idx) => {
    const role = msg._getType() === 'human' ? 'Customer' : 'Assistant';
    return `${role}: ${msg.content}`;
  }).join('\n');
  
  // Check what was asked in the previous message
  const lastAssistantMessage = recentMessages
    .reverse()
    .find(m => m._getType() === 'ai')?.content || '';
  
  const prompt = `Analyze this customer message IN THE CONTEXT of the conversation:

CONVERSATION CONTEXT:
${conversationContext}

CURRENT MESSAGE TO ANALYZE: "${message}"

IMPORTANT CONTEXT RULES:
1. If the customer says "all", "todo", "toda la información" - they are responding to ALL questions asked in the previous assistant message
2. If the customer says "si", "yes", "sí" - they are confirming what was asked in the previous message
3. If the assistant asked about budget and customer responds with just a number, that's the budget
4. If the assistant asked for name and customer responds with just a name, extract it

Last assistant message asked about: ${lastAssistantMessage}

Extract any information provided (name, problem, goal, budget, email).
For contextual responses, infer based on what was asked.

Examples:
- Assistant: "What's your budget?" Customer: "500" → Extract budget: 500
- Assistant: "What's your name?" Customer: "Carlos" → Extract name: Carlos  
- Assistant: "What problem do you have and what's your goal?" Customer: "all" → Need more specific info
- Assistant: "Is your budget $500?" Customer: "si" → Extract budget: 500`;

  // Now the LLM can understand context!
  const response = await llm.invoke(prompt);
  
  // Parse and return extracted info...
}

// EXAMPLE SCENARIOS THAT WOULD NOW WORK:

// Scenario 1: Number response to budget question
// Assistant: "¿Cuál es tu presupuesto mensual?"
// Customer: "500"
// EXTRACTED: { budget: 500 } ✅

// Scenario 2: Confirmation
// Assistant: "¿Tu presupuesto es de $300 al mes?"  
// Customer: "si"
// EXTRACTED: { budget: 300 } ✅

// Scenario 3: Name only response
// Assistant: "¿Cómo te llamas?"
// Customer: "María"
// EXTRACTED: { name: "María" } ✅

// Scenario 4: All response (needs clarification)
// Assistant: "¿Cuál es tu problema y qué quieres lograr?"
// Customer: "all"
// EXTRACTED: {} - Tool understands "all" but needs specific answers ✅