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
    const { ghlService, calendarId } = config.configurable;
    
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
    const { ghlService, calendarId } = config.configurable;
    
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
        confirmationMessage: `¡Perfecto! He agendado tu cita para el ${slot.display}. Recibirás una invitación por correo a ${leadEmail}. ¡Esperamos hablar contigo pronto!`
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
    description: "Book appointment in GHL calendar",
    schema: z.object({
      contactId: z.string().describe("GHL contact ID"),
      slot: z.object({
        startTime: z.string(),
        endTime: z.string(),
        display: z.string()
      }).describe("Selected time slot"),
      leadName: z.string().describe("Customer's name"),
      leadEmail: z.string().email().describe("Customer's email")
    })
  }
);

// Tool: Update GHL contact
const updateGHLContact = tool(
  async ({ contactId, tags, notes, leadInfo }, config) => {
    const { ghlService } = config.configurable;
    
    try {
      // Update tags
      if (tags.length > 0) {
        await ghlService.addTags(contactId, tags);
      }
      
      // Add note
      if (notes) {
        await ghlService.addNote(contactId, notes);
      }
      
      // Update contact info
      const updates = {};
      if (leadInfo.name) updates.firstName = leadInfo.name;
      if (leadInfo.email) updates.email = leadInfo.email;
      
      if (Object.keys(updates).length > 0) {
        await ghlService.updateContact(contactId, updates);
      }
      
      return { success: true, updated: true };
    } catch (error) {
      console.error("Error updating GHL contact:", error);
      return { success: false, error: error.message };
    }
  },
  {
    name: "update_ghl_contact",
    description: "Update GHL contact with tags and notes",
    schema: z.object({
      contactId: z.string(),
      tags: z.array(z.string()).describe("Tags to add"),
      notes: z.string().describe("Note content"),
      leadInfo: z.object({
        name: z.string().optional(),
        email: z.string().optional(),
        budget: z.number().optional()
      }).describe("Lead information to update")
    })
  }
);

// Tool: Parse time selection
const parseTimeSelection = tool(
  async ({ userInput, availableSlots }) => {
    const input = userInput.toLowerCase();
    
    // Check for slot number (1, 2, 3, etc.)
    for (let i = 0; i < availableSlots.length; i++) {
      if (input.includes((i + 1).toString()) || 
          input.includes(['first', 'second', 'third', 'fourth', 'fifth'][i])) {
        return availableSlots[i];
      }
    }
    
    // Check for time mentions
    for (const slot of availableSlots) {
      const slotLower = slot.display.toLowerCase();
      if (input.includes('10') && slotLower.includes('10:')) return slot;
      if (input.includes('2') && slotLower.includes('2:')) return slot;
      if (input.includes('11') && slotLower.includes('11:')) return slot;
      
      // Check day mentions
      const dayMatch = slotLower.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
      if (dayMatch && input.includes(dayMatch[1])) return slot;
    }
    
    return null; // No clear selection
  },
  {
    name: "parse_time_selection",
    description: "Parse customer's time selection from their message",
    schema: z.object({
      userInput: z.string().describe("Customer's message about time selection"),
      availableSlots: z.array(z.object({
        index: z.number(),
        display: z.string(),
        startTime: z.string(),
        endTime: z.string()
      })).describe("Available time slots")
    })
  }
);

// Tool: Send message via GHL WhatsApp (NOT webhook response)
const sendGHLMessage = tool(
  async ({ contactId, message }, config) => {
    const { ghlService } = config.configurable;
    
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

5. SOLO después de tener TODA la información:
   - Si presupuesto >= $300/mes:
     * Mencionar algo específico: "Con $[amount] y un [business_type] como el tuyo, podríamos generar aproximadamente [X] nuevos clientes al mes"
     * Pedir email para agendar cita
     * SOLO después de obtener email, usar get_calendar_slots tool
     * Mostrar horarios disponibles en español
     * Usar parse_time_selection tool cuando respondan
     * Usar book_appointment tool para confirmar
   - Si presupuesto < $300/mes:
     * Ser empático: "Entiendo perfectamente. Muchos [business_type] empiezan con presupuestos ajustados..."
     * Explicar valor: "Nuestros clientes típicamente ven retorno de 3-5x en los primeros 90 días"
     * Ofrecer contactarlos cuando estén listos
     * Usar update_ghl_contact para marcar como "nurture-lead"

IMPRESSIVE FACTS TO DROP (choose relevant ones):
- "El 67% de los consumidores prefieren WhatsApp para comunicarse con negocios"
- "Los negocios que responden en menos de 5 minutos tienen 100x más probabilidad de convertir"
- "La AI puede manejar el 80% de las preguntas de clientes sin intervención humana"
- "Justo como esta conversación - imagina tener 50 de estas al mismo tiempo, 24/7"

TOOL USAGE:
- send_ghl_message: Use for EVERY message you want to send to the customer
- extract_lead_info: After EVERY customer message to capture information
- get_calendar_slots: ONLY when you have ALL info (name, problem, goal, budget >= $300, email)
- parse_time_selection: When customer responds to time options
- book_appointment: When you have a selected time
- update_ghl_contact: At conversation milestones with appropriate tags

Remember: Sound like a real person texting in Spanish, not a formal business email.

SMART CONVERSATION EXAMPLES:

Initial: "¡Hola! 👋 Soy María, tu consultora AI de Outlet Media. Así es, ¡soy inteligencia artificial ayudándote a implementar inteligencia artificial! ¿Cómo te llamas?"

After name: "Mucho gusto, [nombre]. Cuéntame, ¿qué tipo de negocio manejas? Me encanta aprender sobre diferentes industrias 🚀"

After business type (restaurant): "¡Un restaurante! 🍽️ Fascinante. Justo ayer ayudé a 3 restaurantes en Texas a aumentar sus reservaciones en un 45%. ¿Cuál es tu mayor reto ahora mismo? ¿Conseguir más clientes, mejorar las reseñas, o tal vez competir con delivery apps?"

After problem: "Ah, [specific problem]. Es exactamente lo que escucho de muchos [business type] en [month]. De hecho, mientras hablamos, mi algoritmo ya está identificando las 3 estrategias más efectivas para tu caso específico... ¿Cuál es tu meta ideal? ¿Qué te haría decir 'wow, esto sí funcionó'?"

Budget question (smart): "Perfecto, [nombre]. Para implementar AI y automatización como la que estás experimentando ahora mismo, ¿cuánto inviertes actualmente en marketing? O mejor dicho, ¿cuánto estarías cómodo invirtiendo mensualmente para [their specific goal]? 💡"

When qualified: "¡Excelente! Con $[amount] podemos hacer maravillas. De hecho, déjame mostrarte algo cool - mientras procesaba tu información, ya identifiqué 5 oportunidades específicas para [business type] en tu área. ¿Cuál es tu email para agendar una videollamada y mostrártelas?"

WHEN SHOWING CALENDAR SLOTS:
"Mira qué eficiente - ya tengo los horarios disponibles 📅 (así funcionará tu negocio con nuestra AI):"
Format: "Martes 29 de julio a las 3:00 PM (Hora de Texas)"`;

// Create the modern sales agent
export const salesAgent = createReactAgent({
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
  prompt: SALES_AGENT_PROMPT
});

// Export tools for testing
export const tools = {
  sendGHLMessage,
  extractLeadInfo,
  getCalendarSlots,
  bookAppointment,
  updateGHLContact,
  parseTimeSelection
};