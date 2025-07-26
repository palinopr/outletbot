import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { getCurrentTaskInput, Annotation, MessagesAnnotation } from '@langchain/langgraph';

// Agent configuration with timeout and retry handling
const AGENT_CONFIG = {
  conversationTimeout: 300000, // 5 minutes total
  retryConfig: {
    maxRetries: 3,
    retryDelay: 1000,
    retryMultiplier: 2,
    retryableErrors: ['CancelledError', 'TimeoutError', 'ECONNRESET', 'ETIMEDOUT']
  }
};

// Import getCurrentTaskInput for accessing state in tools
import { getCurrentTaskInput } from '@langchain/langgraph';

// Tool: Extract lead information from messages
const extractLeadInfo = tool(
  async ({ message }, config) => {
    const llm = new ChatOpenAI({ model: "gpt-4", temperature: 0 });
    
    // Access the current state to get existing leadInfo
    let currentState;
    try {
      currentState = getCurrentTaskInput();
    } catch (e) {
      // If getCurrentTaskInput fails, we're not in a graph context
      currentState = null;
    }
    
    const existingLeadInfo = currentState?.leadInfo || config?.configurable?.currentLeadInfo || {};
    
    // Build currentInfo from state, not from tool input
    const currentInfo = {
      name: existingLeadInfo.name || "",
      businessType: existingLeadInfo.businessType || "",
      problem: existingLeadInfo.problem || "",
      goal: existingLeadInfo.goal || "",
      budget: existingLeadInfo.budget || 0,
      email: existingLeadInfo.email || "",
      businessDetails: existingLeadInfo.businessDetails || ""
    };
    
    console.log('Extract lead info - Current context:', currentInfo);
    
    const prompt = `Analyze this customer message and extract any information provided:
    Message: "${message}"
    
    Current info we already have: ${JSON.stringify(currentInfo)}
    
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
    
    const response = await llm.invoke([
      new SystemMessage("You extract information from messages. Return only valid JSON with ONLY new/changed fields."),
      { role: "user", content: prompt }
    ]);
    
    try {
      const extracted = JSON.parse(response.content);
      
      // Merge with existing info
      const merged = { ...currentInfo };
      Object.keys(extracted).forEach(key => {
        if (extracted[key] !== null && extracted[key] !== undefined && extracted[key] !== "") {
          merged[key] = extracted[key];
        }
      });
      
      console.log('Extracted new info:', extracted);
      console.log('Merged lead info:', merged);
      
      return merged;
    } catch (e) {
      console.error('Failed to parse extraction response:', e);
      return currentInfo; // Return existing info if extraction fails
    }
  },
  {
    name: "extract_lead_info",
    description: "Extract lead information from customer message using current state context",
    schema: z.object({
      message: z.string().describe("Customer's message")
      // Removed currentInfo parameter - we get it from state now
    })
  }
);

// Tool: Get calendar slots (ONLY after full qualification)
const getCalendarSlots = tool(
  async ({ leadInfo, startDate, endDate }, config) => {
    // Initialize services if not provided
    let ghlService = config?.configurable?.ghlService;
    let calendarId = config?.configurable?.calendarId || process.env.GHL_CALENDAR_ID;
    
    if (!ghlService) {
      const { GHLService } = await import('../services/ghlService.js');
      ghlService = new GHLService(
        process.env.GHL_API_KEY,
        process.env.GHL_LOCATION_ID
      );
    }
    
    // STRICT validation - must have ALL info before showing slots
    if (!leadInfo.name || !leadInfo.problem || !leadInfo.goal || !leadInfo.budget || !leadInfo.email) {
      return {
        error: "Cannot fetch slots - missing required information",
        missingFields: {
          name: !leadInfo.name,
          problem: !leadInfo.problem,
          goal: !leadInfo.goal,
          budget: !leadInfo.budget,
          email: !leadInfo.email
        }
      };
    }
    
    // Budget must be qualified
    if (leadInfo.budget < 300) {
      return {
        error: "Cannot fetch slots - budget under $300/month",
        budget: leadInfo.budget
      };
    }
    
    // Default to next 7 days if dates not provided
    const start = startDate || new Date().toISOString();
    const end = endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    try {
      const slots = await ghlService.getAvailableSlots(
        calendarId,
        start,
        end
      );
      
      // Format slots for display in Spanish with Texas timezone
      return {
        success: true,
        slots: slots.slice(0, 5).map((slot, index) => {
          const date = new Date(slot.startTime);
          const spanishDays = {
            'Monday': 'Lunes',
            'Tuesday': 'Martes',
            'Wednesday': 'Miércoles',
            'Thursday': 'Jueves',
            'Friday': 'Viernes',
            'Saturday': 'Sábado',
            'Sunday': 'Domingo'
          };
          const spanishMonths = {
            'Jan': 'enero',
            'Feb': 'febrero',
            'Mar': 'marzo',
            'Apr': 'abril',
            'May': 'mayo',
            'Jun': 'junio',
            'Jul': 'julio',
            'Aug': 'agosto',
            'Sep': 'septiembre',
            'Oct': 'octubre',
            'Nov': 'noviembre',
            'Dec': 'diciembre'
          };
          
          const dayName = date.toLocaleString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
          const monthName = date.toLocaleString('en-US', { month: 'short', timeZone: 'America/Chicago' });
          const formattedTime = date.toLocaleString('es-US', {
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'America/Chicago'
          });
          
          return {
            index: index + 1,
            display: `${spanishDays[dayName]} ${formattedTime.split(',')[0]} de ${spanishMonths[monthName]} a las ${formattedTime.split(',')[1].trim()}`,
            startTime: slot.startTime,
            endTime: slot.endTime,
            slotId: slot.id || `slot-${index}`
          };
        })
      };
    } catch (error) {
      console.error("Error fetching calendar slots:", error);
      return { error: error.message, slots: [] };
    }
  },
  {
    name: "get_calendar_slots",
    description: "Fetch available calendar slots from GHL (requires full qualification)",
    schema: z.object({
      leadInfo: z.object({
        name: z.string().optional().nullable(),
        problem: z.string().optional().nullable(),
        goal: z.string().optional().nullable(),
        budget: z.number().optional().nullable(),
        email: z.string().optional().nullable()
      }).describe("Lead information (all fields required before showing slots)"),
      startDate: z.string().optional().describe("Start date in ISO format (defaults to today)"),
      endDate: z.string().optional().describe("End date in ISO format (defaults to 7 days from now)")
    })
  }
);

// Tool: Book appointment
const bookAppointment = tool(
  async ({ slot, leadName, leadEmail }, config) => {
    // Get contactId from config
    const contactId = config?.configurable?.contactId;
    
    if (!contactId) {
      throw new Error('contactId not found in config. Cannot book appointment.');
    }
    
    // Initialize services if not provided
    let ghlService = config?.configurable?.ghlService;
    let calendarId = config?.configurable?.calendarId || process.env.GHL_CALENDAR_ID;
    
    if (!ghlService) {
      const { GHLService } = await import('../services/ghlService.js');
      ghlService = new GHLService(
        process.env.GHL_API_KEY,
        process.env.GHL_LOCATION_ID
      );
    }
    
    try {
      const appointment = await ghlService.bookAppointment(
        calendarId,
        contactId,
        {
          title: `Sales Call with ${leadName}`,
          appointmentStatus: 'confirmed',
          startTime: slot.startTime,
          endTime: slot.endTime
        }
      );
      
      return {
        success: true,
        appointmentId: appointment.id,
        confirmationMessage: `¡Perfecto! Tu cita está confirmada para ${slot.display}. Te enviaré un recordatorio antes de nuestra llamada.`
      };
    } catch (error) {
      console.error("Error booking appointment:", error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  {
    name: "book_appointment",
    description: "Book an appointment in GHL calendar",
    schema: z.object({
      slot: z.object({
        startTime: z.string(),
        endTime: z.string(),
        display: z.string()
      }).describe("Selected time slot"),
      leadName: z.string().describe("Lead's name"),
      leadEmail: z.string().describe("Lead's email")
    })
  }
);

// Tool: Update GHL contact
const updateGHLContact = tool(
  async ({ tags, notes, leadInfo }, config) => {
    // Get contactId from config
    const contactId = config?.configurable?.contactId;
    
    if (!contactId) {
      throw new Error('contactId not found in config. Cannot update contact.');
    }
    
    // Initialize GHL service if not provided
    let ghlService = config?.configurable?.ghlService;
    
    if (!ghlService) {
      const { GHLService } = await import('../services/ghlService.js');
      ghlService = new GHLService(
        process.env.GHL_API_KEY,
        process.env.GHL_LOCATION_ID
      );
    }
    
    try {
      // Update tags
      if (tags.length > 0) {
        await ghlService.addTags(contactId, tags);
      }
      
      // Add note
      if (notes) {
        await ghlService.addNote(contactId, notes);
      }
      
      // Update custom fields if we have lead info
      if (leadInfo) {
        const updateData = {
          // Standard fields
          firstName: leadInfo.name,
          email: leadInfo.email,
          companyName: leadInfo.businessType,
          // Custom fields mapped to GHL IDs
          customFields: {
            goal: leadInfo.problem || leadInfo.goal,
            budget: String(leadInfo.budget || ''),
            businessType: leadInfo.businessType,
            verifiedName: leadInfo.name
          }
        };
        
        // Remove undefined values
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === undefined) delete updateData[key];
        });
        
        await ghlService.updateContact(contactId, updateData);
      }
      
      return { success: true, updated: { tags, notes: !!notes, leadInfo: !!leadInfo } };
    } catch (error) {
      console.error("Error updating GHL contact:", error);
      return { success: false, error: error.message };
    }
  },
  {
    name: "update_ghl_contact",
    description: "Update GHL contact with tags, notes, and lead information",
    schema: z.object({
      tags: z.array(z.string()).describe("Tags to add to contact"),
      notes: z.string().optional().describe("Note to add to contact timeline"),
      leadInfo: z.object({
        name: z.string().optional(),
        email: z.string().optional(),
        businessType: z.string().optional(),
        budget: z.number().optional(),
        problem: z.string().optional(),
        goal: z.string().optional()
      }).optional().describe("Lead information to update")
    })
  }
);

// Tool: Parse time selection
const parseTimeSelection = tool(
  async ({ userMessage, availableSlots }) => {
    const llm = new ChatOpenAI({ model: "gpt-4", temperature: 0 });
    
    const prompt = `User selected a time from these options:
    ${availableSlots.map(s => `${s.index}. ${s.display}`).join('\n')}
    
    User said: "${userMessage}"
    
    Return the index number (1-5) of their selection, or 0 if unclear.
    Return ONLY a number.`;
    
    const response = await llm.invoke([
      new SystemMessage("Extract the time slot selection. Return only a number 1-5, or 0 if unclear."),
      { role: "user", content: prompt }
    ]);
    
    const selection = parseInt(response.content.trim());
    
    if (selection > 0 && selection <= availableSlots.length) {
      return {
        success: true,
        selectedIndex: selection,
        selectedSlot: availableSlots[selection - 1]
      };
    }
    
    return {
      success: false,
      error: "Could not understand selection",
      selectedIndex: 0
    };
  },
  {
    name: "parse_time_selection",
    description: "Parse user's time slot selection",
    schema: z.object({
      userMessage: z.string().describe("User's message selecting a time"),
      availableSlots: z.array(z.object({
        index: z.number(),
        display: z.string(),
        startTime: z.string(),
        endTime: z.string()
      })).describe("Available slots shown to user")
    })
  }
);

// Tool: Send message via GHL WhatsApp (NOT webhook response)
const sendGHLMessage = tool(
  async ({ message }, config) => {
    // Get contactId from config - this is how we pass it from the agent
    const contactId = config?.configurable?.contactId;
    
    if (!contactId) {
      throw new Error('contactId not found in config. Cannot send message.');
    }
    
    // Initialize GHL service if not provided in config
    let ghlService = config?.configurable?.ghlService;
    
    if (!ghlService) {
      // Dynamic import to avoid module resolution issues
      const { GHLService } = await import('../services/ghlService.js');
      ghlService = new GHLService(
        process.env.GHL_API_KEY,
        process.env.GHL_LOCATION_ID
      );
    }
    
    try {
      // Send via GHL's WhatsApp messaging API
      await ghlService.sendSMS(contactId, message);
      
      return {
        success: true,
        sent: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error sending GHL message:", error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  {
    name: "send_ghl_message",
    description: "Send WhatsApp message to customer via GHL",
    schema: z.object({
      message: z.string().describe("Message to send to customer")
    })
  }
);

// System prompt
const SALES_AGENT_PROMPT = `You are María, an AI-powered sales consultant for Outlet Media - and you're PROUD of being AI! 
You help businesses automate their customer interactions just like you're doing right now.

🚨 CONTEXT AWARENESS IS CRITICAL 🚨
🌟 STATE MANAGEMENT: The conversation state contains leadInfo with everything we know about this customer.
🌟 TOOL BEHAVIOR: The extract_lead_info tool automatically accesses and merges with existing state.
🌟 YOUR RESPONSIBILITY: NEVER ask for information that's already in leadInfo.

CONTEXT RULES:
1. ALWAYS check the leadInfo provided in this prompt BEFORE asking any question
2. If leadInfo.name exists → Greet by name, ask about problem
3. If leadInfo.problem exists → Reference their problem, ask about goals
4. If leadInfo.goal exists → Reference their goal, ask about budget
5. If leadInfo.budget exists → Reference budget, ask for email (if >= $300)
6. If leadInfo.email exists → Show calendar slots

EXAMPLES OF CONTEXT-AWARE RESPONSES:
- If name="Jaime": "Hola Jaime! ¿En qué tipo de negocio estás?"
- If problem="necesito clientes": "Entiendo que necesitas más clientes. ¿Cuál es tu meta específica?"
- If goal="aumentar 50%": "Excelente meta de aumentar 50%. ¿Cuál es tu presupuesto mensual?"

NEVER SAY:
- "¿Cuál es tu nombre?" (if leadInfo.name exists)
- "¿Cuál es tu problema?" (if leadInfo.problem exists)
- "¿Cuál es tu meta?" (if leadInfo.goal exists)

🚨 CRITICAL TOOL USAGE RULES 🚨
You NEVER respond directly in the message content. Your ONLY way to communicate with the customer is through tools.

FOR EVERY CUSTOMER INTERACTION:
1. extract_lead_info - Analyze what they said
2. send_ghl_message - Send your response
3. update_ghl_contact - Update GHL with:
   - Tags for any new info
   - Custom fields updates
   - Note with interaction summary

TO SEND A MESSAGE:
- You MUST call the send_ghl_message tool
- Pass your message as: {"message": "your message here"}
- Do NOT include any response in your message content - ONLY use the tool
- The system handles contactId automatically - don't include it

EXAMPLE OF CORRECT BEHAVIOR:
User: "hola"
Your response: [Call send_ghl_message with {"message": "¡Hola! Soy María..."}]

EXAMPLE OF INCORRECT BEHAVIOR (NEVER DO THIS):
User: "hola"
Your response: "¡Hola! Soy María..." (This is WRONG - you must use the tool!)

REMEMBER: If you want to say ANYTHING to the customer, you MUST use send_ghl_message tool. 
NEVER put your response in the message content directly.


LANGUAGE: Always respond in Spanish. You are a native Spanish speaker from Texas.

YOUR PERSONALITY & INTELLIGENCE:
- You're friendly but SMART - show off AI capabilities subtly
- Make connections between what they say and business insights
- Use their specific words/phrases to show you're truly listening
- Occasionally mention how AI (like you) is transforming businesses
- Be slightly playful/witty when appropriate
- React with genuine interest to their specific business

CREATING "WOW" MOMENTS:
1. When they mention their business type, show knowledge: 
   - "¡Un restaurante! Sabes, el 73% de los restaurantes que usan AI para marketing ven un aumento del 40% en clientes nuevos..."
   
2. When they describe problems, connect dots:
   - "Ah, necesitas más clientes locales... Y mencionaste que eres un restaurante. ¿Has notado que tus competidores están usando Google Ads? Puedo ayudarte a superarlos con AI..."

3. Show memory and context:
   - Reference things they said earlier
   - Make smart deductions: "Como mencionaste que necesitas clientes locales, imagino que la mayoría de tus ventas son presenciales, ¿verdad?"

4. Demonstrate AI capability:
   - "Mientras hablamos, ya estoy analizando las mejores estrategias para restaurantes en tu área..."
   - "Detecté que escribiste 'nesesito' - no te preocupes, te entiendo perfectamente 😊"

5. Industry-specific insights:
   - Restaurant: delivery trends, review management, local SEO
   - Retail: inventory keywords, seasonal campaigns
   - Services: appointment booking, lead nurturing

CONVERSATION RULES:
1. If you already have their name, ALWAYS greet them by name
   - Example: "Hola Jaime! Veo que tienes un restaurante..."
   - NEVER: "Hola! ¿Cuál es tu nombre?" (if you already have it)
2. Still follow the qualification flow but make it feel natural
3. Drop interesting stats/insights relevant to their business
4. Use emojis intelligently (not too many): 📊 📈 🚀 💡 ✨
5. If they test you or ask if you're real: "¡Soy 100% AI y orgullosa de serlo! 🤖 Justo como las soluciones que implementamos para tu negocio"

IMPORTANT TOOL USAGE ON EVERY MESSAGE:
1. FIRST: Check existing leadInfo in the state (provided in system prompt)
2. SECOND: Use extract_lead_info tool to analyze the customer message
   - The tool will automatically access current state and merge with new info
   - You only need to pass the message, NOT currentInfo
3. THIRD: Use send_ghl_message to respond based on what info is still missing
4. FOURTH: Use update_ghl_contact to:
   - Add tags if new information discovered
   - Update custom fields with the merged leadInfo from extract_lead_info
   - Add a note summarizing this interaction

CRITICAL: When calling extract_lead_info, pass ONLY the message:
✅ CORRECT: extract_lead_info({ message: "customer text" })
❌ WRONG: extract_lead_info({ message: "text", currentInfo: {...} })

TOOL USAGE PATTERN:
1. Customer message arrives
2. Call extract_lead_info({ message: "customer text" }) - it returns merged leadInfo
3. Based on the MERGED leadInfo from tool, determine what's missing
4. Send response asking for the NEXT missing piece ONLY
5. Update GHL with the merged leadInfo

STRICT QUALIFICATION FLOW BASED ON MERGED LEADINFO:
1. If merged leadInfo missing name → Ask for name
2. If merged leadInfo has name but no problem → Ask about problem/need  
3. If merged leadInfo has name + problem but no goal → Ask about goals
4. If merged leadInfo has name + problem + goal but no budget → Ask about budget
5. If merged leadInfo has all 4 pieces + budget >= $300 → Ask for email
6. If merged leadInfo has everything → Show calendar

⚠️ CRITICAL: Base your decisions on the MERGED leadInfo returned by extract_lead_info tool,
NOT just on what's in the current message. The tool handles all state merging for you.

Budget Handling:
- If budget >= $300: Continue to email collection and scheduling
- If budget < $300: Politely explain our minimum, offer to stay in touch, tag as "nurture-lead"

Calendar Scheduling:
- ONLY call get_calendar_slots AFTER collecting ALL info including email
- Show numbered slots in Spanish with Texas timezone
- Use parse_time_selection to understand their choice
- Call book_appointment to confirm

UPDATE GHL at each stage:
- After EVERY customer message: 
  1. Get merged leadInfo from extract_lead_info tool
  2. Pass the ENTIRE merged leadInfo to update_ghl_contact
  3. Add appropriate tags based on what's in merged leadInfo
  4. Add a note with current conversation state

EXAMPLE update_ghl_contact CALL:
{
  tags: ["name-collected", "problem-identified"],
  leadInfo: {
    name: "Jaime",
    problem: "necesito más clientes",
    businessType: "restaurante",
    // ... rest of merged data from extract_lead_info
  },
  notes: "[timestamp] Collected name (Jaime) and problem (needs more customers)"
}

NOTE FORMAT for each interaction:
[Date/Time] - State after extraction
- Current leadInfo: [what we know so far]
- Customer provided: [what was new in this message]
- Next step: [what we're asking for next]

`;


// Create the agent following LangGraph patterns
// Configure LLM with explicit tool binding
const llm = new ChatOpenAI({ 
  model: "gpt-4",
  temperature: 0.7,
  timeout: 30000, // 30 second timeout for LLM calls
  maxRetries: 3
});

// Define tools array
const tools = [
  sendGHLMessage,
  extractLeadInfo,
  getCalendarSlots,
  bookAppointment,
  updateGHLContact,
  parseTimeSelection
];

// Define custom state annotation that includes leadInfo
const AgentStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  leadInfo: Annotation({
    reducer: (x, y) => ({ ...x, ...y }), // Merge leadInfo updates
    default: () => ({})
  }),
  contactId: Annotation(),
  conversationId: Annotation()
});

// Bind tools to the model to ensure it knows they're available
const modelWithTools = llm.bindTools(tools);

export const graph = createReactAgent({
  llm: modelWithTools,
  tools: tools,
  stateSchema: AgentStateAnnotation, // Use custom state schema
  stateModifier: (state) => {
    // Add current lead info to the prompt if available
    let enhancedPrompt = SALES_AGENT_PROMPT;
    
    if (state.leadInfo) {
      const info = state.leadInfo;
      const knownInfo = [];
      if (info.name) knownInfo.push(`Nombre: ${info.name}`);
      if (info.businessType) knownInfo.push(`Tipo de negocio: ${info.businessType}`);
      if (info.problem) knownInfo.push(`Problema: ${info.problem}`);
      if (info.goal) knownInfo.push(`Meta: ${info.goal}`);
      if (info.budget) knownInfo.push(`Presupuesto: $${info.budget}/mes`);
      if (info.email) knownInfo.push(`Email: ${info.email}`);
      
      if (knownInfo.length > 0) {
        enhancedPrompt += `\n\n🔴 INFORMACIÓN CONOCIDA DEL CLIENTE:\n${knownInfo.join('\n')}\n\n🚨 USA ESTA INFORMACIÓN - NO LA PREGUNTES DE NUEVO.\n\n`;
        enhancedPrompt += `⚠️ CONTEXT AWARENESS: The extract_lead_info tool will automatically access this information from state.\n`;
        enhancedPrompt += `You don't need to pass currentInfo - just the message.\n\n`;
        
        // Determine current stage based on what we have
        if (!info.name) {
          enhancedPrompt += `CURRENT STAGE: Ask for NAME`;
        } else if (!info.problem) {
          enhancedPrompt += `CURRENT STAGE: Ask about PROBLEM (we already have name: ${info.name})`;
        } else if (!info.goal) {
          enhancedPrompt += `CURRENT STAGE: Ask about GOAL (we have name: ${info.name} and problem: ${info.problem})`;
        } else if (!info.budget) {
          enhancedPrompt += `CURRENT STAGE: Ask about BUDGET (we have name, problem, and goal)`;
        } else if (info.budget >= 300 && !info.email) {
          enhancedPrompt += `CURRENT STAGE: Ask for EMAIL (qualified with budget $${info.budget})`;
        } else if (info.email) {
          enhancedPrompt += `CURRENT STAGE: Show CALENDAR and book appointment`;
        }
      }
    }
    
    // Add a final reminder about tool usage
    enhancedPrompt += `\n\n⚠️ FINAL REMINDER: You MUST use send_ghl_message tool to send ANY message to the customer. NEVER respond directly in the message content!`;
    
    const systemMessage = new SystemMessage(enhancedPrompt);
    return [systemMessage, ...state.messages];
  }
  // Removed interruptBefore to allow autonomous tool execution
});

// Enhanced sales agent with error recovery
export async function salesAgent(input, config) {
  // console.log('Agent invoked with input:', JSON.stringify(input, null, 2));
  console.log(`Agent received ${input.messages?.length || 0} messages in conversation history`);
  console.log('Current leadInfo state:', input.leadInfo || 'No leadInfo');
  
  const startTime = Date.now();
  
  // Enhanced config with timeout tracking
  const enhancedConfig = {
    ...config,
    configurable: {
      ...config?.configurable,
      contactId: input.contactId || config?.configurable?.contactId,
      conversationStartTime: startTime,
      agentConfig: AGENT_CONFIG,
      currentLeadInfo: input.leadInfo || {} // Pass leadInfo through config for tools
    }
  };
  
  try {
    // Set overall timeout for the conversation
    const conversationTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Conversation timeout exceeded'));
      }, AGENT_CONFIG.conversationTimeout);
    });
    
    // Run agent with timeout and recursion limit
    const result = await Promise.race([
      graph.invoke(input, {
        ...enhancedConfig,
        recursionLimit: 25 // Prevent infinite loops
      }),
      conversationTimeoutPromise
    ]);
    
    console.log(`Conversation completed in ${Date.now() - startTime}ms`);
    return result;
    
  } catch (error) {
    console.error('Agent error:', error);
    
    // Handle specific error types
    if (error.message === 'Conversation timeout exceeded') {
      return {
        messages: [
          ...input.messages,
          {
            role: 'assistant',
            content: 'Lo siento, la conversación tardó demasiado. Por favor, intenta de nuevo o contacta soporte.'
          }
        ]
      };
    }
    
    // Handle cancellation errors
    if (error.name === 'CancelledError' || error.message.includes('cancelled')) {
      console.log('Operation was cancelled - likely due to platform restart');
      return {
        messages: [
          ...input.messages,
          {
            role: 'assistant',
            content: 'Hubo una interrupción temporal. Por favor, envía tu mensaje nuevamente.'
          }
        ]
      };
    }
    
    // Re-throw other errors
    throw error;
  }
}

// Export tools for testing
export const exportedTools = {
  sendGHLMessage,
  extractLeadInfo,
  getCalendarSlots,
  bookAppointment,
  updateGHLContact,
  parseTimeSelection
};

// Export configuration for monitoring
export const agentConfig = AGENT_CONFIG;

// Export prompt for reuse
export { SALES_AGENT_PROMPT };