import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";

// Tool: Extract lead information from messages
const extractLeadInfo = tool(
  async ({ message, currentInfo }) => {
    const llm = new ChatOpenAI({ model: "gpt-4", temperature: 0 });
    
    const prompt = `Analyze this customer message and extract any information provided:
    Message: "${message}"
    
    Current info we have: ${JSON.stringify(currentInfo)}
    
    Extract any NEW information (if mentioned):
    - Name
    - BusinessType (restaurant, store, clinic, salon, etc)
    - Problem/Pain point
    - Goal
    - Budget (extract number if mentioned)
    - Email
    - Any specific details about their business
    
    Return ONLY a JSON object with any new/updated fields: {"name": null, "businessType": null, "problem": null, "goal": null, "budget": null, "email": null, "businessDetails": null}`;
    
    const response = await llm.invoke([
      new SystemMessage("You extract information from messages. Return only valid JSON."),
      { role: "user", content: prompt }
    ]);
    
    try {
      return JSON.parse(response.content);
    } catch (e) {
      return {};
    }
  },
  {
    name: "extract_lead_info",
    description: "Extract lead information from customer message",
    schema: z.object({
      message: z.string().describe("Customer's message"),
      currentInfo: z.object({
        name: z.string().optional(),
        businessType: z.string().optional(),
        problem: z.string().optional(),
        goal: z.string().optional(),
        budget: z.number().optional(),
        email: z.string().optional(),
        businessDetails: z.string().optional()
      }).describe("Currently known information")
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
  async ({ contactId, slot, leadName, leadEmail }, config) => {
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
      contactId: z.string().describe("GHL contact ID"),
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
  async ({ contactId, tags, notes, leadInfo }, config) => {
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
        const updateData = {};
        if (leadInfo.name) updateData.name = leadInfo.name;
        if (leadInfo.email) updateData.email = leadInfo.email;
        if (leadInfo.businessType) updateData.companyName = leadInfo.businessType;
        
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
      contactId: z.string(),
      tags: z.array(z.string()).describe("Tags to add to contact"),
      notes: z.string().optional().describe("Note to add to contact timeline"),
      leadInfo: z.object({
        name: z.string().optional(),
        email: z.string().optional(),
        businessType: z.string().optional(),
        budget: z.number().optional()
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
  async ({ contactId, message }, config) => {
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
      contactId: z.string().describe("GHL contact ID"),
      message: z.string().describe("Message to send to customer")
    })
  }
);

// System prompt
const SALES_AGENT_PROMPT = `You are María, an AI-powered sales consultant for Outlet Media - and you're PROUD of being AI! 
You help businesses automate their customer interactions just like you're doing right now.

CRITICAL: All messages to customers MUST be sent using the send_ghl_message tool. 
You are NOT responding to a webhook - you're sending WhatsApp messages through GHL's messaging system.

EXAMPLE OF CORRECT TOOL USAGE:
If the conversation state shows contactId: "abc123xyz", then call:
send_ghl_message({"contactId": "abc123xyz", "message": "¡Hola! Soy María..."})
NEVER use hardcoded IDs like: send_ghl_message({"contactId": "123", "message": "..."})
ALWAYS use the actual contactId from the current conversation state

IMPORTANT CONTEXT INFORMATION:
- The contactId is provided in the conversation state/input and MUST be used when calling tools
- ALWAYS look for contactId in the current conversation state before calling any tool
- The contactId will be a string of letters and numbers
- NEVER use "123" or any other test ID - use the real contactId from the state
- When calling send_ghl_message, you MUST use: {"contactId": "<actual-contact-id-from-state>", "message": "your message"}

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
1. Still follow the qualification flow but make it feel natural
2. Drop interesting stats/insights relevant to their business
3. Use emojis intelligently (not too many): 📊 📈 🚀 💡 ✨
4. If they test you or ask if you're real: "¡Soy 100% AI y orgullosa de serlo! 🤖 Justo como las soluciones que implementamos para tu negocio"

STRICT QUALIFICATION FLOW:
1. Saludo y preguntar por el nombre
2. Preguntar sobre su problema o necesidad
3. Preguntar sobre sus metas
4. Preguntar sobre su presupuesto mensual

IMPORTANT: You MUST collect ALL four pieces of information (nombre, problema, meta, presupuesto) 
BEFORE proceeding to scheduling. No exceptions.

Budget Handling:
- If budget >= $300: Continue to email collection and scheduling
- If budget < $300: Politely explain our minimum, offer to stay in touch, tag as "nurture-lead"

Calendar Scheduling:
- ONLY call get_calendar_slots AFTER collecting ALL info including email
- Show numbered slots in Spanish with Texas timezone
- Use parse_time_selection to understand their choice
- Call book_appointment to confirm

UPDATE GHL at each stage:
- After qualification: Add tags like "qualified-lead", "budget-300-plus", "under-budget"
- After booking: Add "appointment-scheduled" tag
- Add notes summarizing the conversation

Remember: Every send_ghl_message call must use the contactId from the conversation state!`;


// Create the agent - direct export from createReactAgent
export const graph = createReactAgent({
  llm: new ChatOpenAI({ 
    model: "gpt-4",
    temperature: 0.7 
  }),
  tools: [
    sendGHLMessage,      // FIRST - for sending all messages
    extractLeadInfo,     // Extract info from messages
    getCalendarSlots,    // Get slots ONLY after full qualification
    bookAppointment,     // Book the appointment
    updateGHLContact,    // Update tags/notes
    parseTimeSelection   // Parse time selection
  ],
  stateModifier: (state) => {
    // Create system message with the prompt
    const systemMessage = new SystemMessage(SALES_AGENT_PROMPT);
    
    // Check if we have contactId in state
    const contactId = state.contactId || state.configurable?.contactId;
    
    if (contactId) {
      // Add contactId context
      const contextMessage = new SystemMessage(
        `CRITICAL CONTEXT FOR THIS CONVERSATION:
The contactId for this conversation is: ${contactId}

IMPORTANT: When calling send_ghl_message, you MUST use exactly:
send_ghl_message({"contactId": "${contactId}", "message": "your message"})

DO NOT use any other contactId. The correct contactId is: ${contactId}`
      );
      return [systemMessage, contextMessage, ...state.messages];
    }
    
    // Return messages with just the system prompt
    return [systemMessage, ...state.messages];
  }
});

// For backward compatibility and local testing
export async function salesAgent(input, config) {
  // Log for debugging
  console.log('Agent invoked with input:', JSON.stringify(input, null, 2));
  
  // LangGraph Platform passes contactId in configurable
  const enhancedConfig = {
    ...config,
    configurable: {
      ...config?.configurable,
      contactId: input.contactId || config?.configurable?.contactId
    }
  };
  
  return graph.invoke(input, enhancedConfig);
}

// Export tools for testing
export const tools = {
  sendGHLMessage,
  extractLeadInfo,
  getCalendarSlots,
  bookAppointment,
  updateGHLContact,
  parseTimeSelection
};