const { StateGraph, END } = require("@langchain/langgraph");
const { ChatOpenAI } = require("@langchain/openai");
const { HumanMessage, SystemMessage, AIMessage } = require("@langchain/core/messages");

// Define conversation state for the sales agent
const SalesAgentState = {
  // Conversation data
  conversationId: {
    value: (x, y) => y ?? x,
    default: () => null,
  },
  messages: {
    value: (x, y) => x.concat(y),
    default: () => [],
  },
  messageCount: {
    value: (x, y) => (y ?? x) + 1,
    default: () => 0,
  },
  
  // Lead information
  leadPhone: {
    value: (x, y) => y ?? x,
    default: () => null,
  },
  leadName: {
    value: (x, y) => y ?? x,
    default: () => null,
  },
  leadProblem: {
    value: (x, y) => y ?? x,
    default: () => null,
  },
  leadGoal: {
    value: (x, y) => y ?? x,
    default: () => null,
  },
  leadBudget: {
    value: (x, y) => y ?? x,
    default: () => null,
  },
  leadEmail: {
    value: (x, y) => y ?? x,
    default: () => null,
  },
  
  // Conversation flow control
  currentStep: {
    value: (x, y) => y ?? x,
    default: () => "greeting",
  },
  qualificationStatus: {
    value: (x, y) => y ?? x,
    default: () => "in_progress",
  },
  
  // GHL data
  ghlContactId: {
    value: (x, y) => y ?? x,
    default: () => null,
  },
  ghlTags: {
    value: (x, y) => x.concat(y),
    default: () => [],
  },
  ghlNotes: {
    value: (x, y) => x.concat(y),
    default: () => [],
  },
  appointmentScheduled: {
    value: (x, y) => y ?? x,
    default: () => false,
  },
  availableSlots: {
    value: (x, y) => y ?? x,
    default: () => [],
  },
  
  // GHL configuration (passed from index.js)
  ghlConfig: {
    value: (x, y) => y ?? x,
    default: () => null,
  }
};

// Initialize LLM
const llm = new ChatOpenAI({
  modelName: "gpt-4",
  temperature: 0.7,
});

// System prompt for the sales agent
const SALES_AGENT_PROMPT = `You are a friendly, professional sales representative. Your goal is to qualify leads and schedule appointments.

IMPORTANT RULES:
1. Be conversational and human-like, not robotic
2. Ask ONE question at a time
3. Show empathy and understanding
4. Build rapport before asking for information
5. Use the person's name once you know it
6. Keep responses short and natural (1-2 sentences)

QUALIFICATION FLOW:
1. Greeting and ask for name
2. Ask about their problem/pain point
3. Ask about their goals
4. Ask about their budget
5. If budget >= $300/month, ask for email to schedule appointment
6. If email provided, offer available times
7. Confirm appointment

Remember: Sound like a real person texting, not a formal business email.`;

// Analyze incoming message and extract information
async function analyzeMessage(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  
  const analysisPrompt = `Analyze this customer message and extract any information provided:
  Message: "${lastMessage.content}"
  
  Current step: ${state.currentStep}
  
  Extract (if mentioned):
  - Name
  - Problem/Pain point
  - Goal
  - Budget (extract number if mentioned)
  - Email
  
  Respond in JSON format: {"name": null, "problem": null, "goal": null, "budget": null, "email": null}`;
  
  const response = await llm.invoke([
    new SystemMessage("You are an assistant that extracts information from messages."),
    new HumanMessage(analysisPrompt)
  ]);
  
  try {
    const extracted = JSON.parse(response.content);
    
    // Update state with extracted information
    const updates = {};
    if (extracted.name && !state.leadName) updates.leadName = extracted.name;
    if (extracted.problem && !state.leadProblem) updates.leadProblem = extracted.problem;
    if (extracted.goal && !state.leadGoal) updates.leadGoal = extracted.goal;
    if (extracted.budget && !state.leadBudget) {
      // Parse budget to ensure it's a number
      const budgetValue = typeof extracted.budget === 'string' 
        ? parseFloat(extracted.budget.replace(/[^0-9.]/g, ''))
        : extracted.budget;
      if (!isNaN(budgetValue)) {
        updates.leadBudget = budgetValue;
      }
    }
    if (extracted.email && !state.leadEmail) updates.leadEmail = extracted.email;
    
    // Update conversation timestamp
    updates.lastActivity = Date.now();
    
    return updates;
  } catch (e) {
    console.error("Failed to parse extraction:", e);
    return {};
  }
}

// Generate sales response based on current state
async function generateResponse(state) {
  // Determine what information we still need
  const conversationContext = state.messages.map(m => 
    `${m._getType() === 'human' ? 'Customer' : 'Agent'}: ${m.content}`
  ).join('\n');
  
  let nextStepPrompt = "";
  
  if (!state.leadName) {
    nextStepPrompt = "Ask for their name in a friendly way.";
  } else if (!state.leadProblem) {
    nextStepPrompt = `Use their name (${state.leadName}) and ask about what challenges they're facing or what brought them here.`;
  } else if (!state.leadGoal) {
    nextStepPrompt = "Show understanding of their problem and ask what they hope to achieve or their ideal outcome.";
  } else if (!state.leadBudget) {
    nextStepPrompt = "Transition naturally to asking about their budget for solving this problem.";
  } else if (state.leadBudget >= 300 && !state.leadEmail) {
    nextStepPrompt = "Great! They qualify. Enthusiastically mention you can help and ask for their email to schedule a call.";
  } else if (state.leadBudget < 300) {
    nextStepPrompt = "Politely let them know our services start at $300/month and offer to follow up when they're ready.";
  } else if (state.leadEmail && state.availableSlots && state.availableSlots.length > 0 && !state.appointmentScheduled) {
    const slotsText = state.availableSlots
      .map((slot, index) => `${index + 1}. ${slot.display}`)
      .join('\n');
    nextStepPrompt = `Great! Show them these available times and ask which works best:\n${slotsText}`;
  } else if (state.leadEmail && state.availableSlots && state.availableSlots.length === 0) {
    nextStepPrompt = "Apologize that no slots are currently available and offer to have someone from the team reach out directly to schedule.";
  } else if (state.leadEmail && !state.appointmentScheduled && !state.availableSlots) {
    nextStepPrompt = "Tell them you're checking the calendar for available times.";
  } else if (state.appointmentScheduled) {
    nextStepPrompt = "Confirm the appointment details and thank them warmly.";
  }
  
  const response = await llm.invoke([
    new SystemMessage(SALES_AGENT_PROMPT),
    new HumanMessage(`Conversation so far:\n${conversationContext}\n\nYour task: ${nextStepPrompt}`)
  ]);
  
  // Determine current step for state management
  let currentStep = state.currentStep;
  if (!state.leadName) currentStep = "getting_name";
  else if (!state.leadProblem) currentStep = "getting_problem";
  else if (!state.leadGoal) currentStep = "getting_goal";
  else if (!state.leadBudget) currentStep = "getting_budget";
  else if (state.leadBudget >= 300 && !state.leadEmail) currentStep = "getting_email";
  else if (state.leadEmail && !state.appointmentScheduled) currentStep = "scheduling";
  else if (state.appointmentScheduled) currentStep = "confirmed";
  
  return {
    messages: [new AIMessage(response.content)],
    currentStep: currentStep
  };
}

// Update GHL tags based on conversation
async function updateGHLTags(state) {
  const tags = [];
  
  // Add tags based on qualification
  if (state.leadBudget >= 300) {
    tags.push("qualified-lead");
    tags.push("budget-300-plus");
  } else if (state.leadBudget && state.leadBudget < 300) {
    tags.push("under-budget");
    tags.push("nurture-lead");
  }
  
  if (state.leadProblem) {
    // Tag based on problem keywords
    if (state.leadProblem.toLowerCase().includes("marketing")) {
      tags.push("needs-marketing");
    }
    if (state.leadProblem.toLowerCase().includes("sales")) {
      tags.push("needs-sales");
    }
  }
  
  if (state.appointmentScheduled) {
    tags.push("appointment-scheduled");
  }
  
  // Create note for GHL
  const note = `Lead Qualification Summary:
Name: ${state.leadName || 'Not provided'}
Problem: ${state.leadProblem || 'Not provided'}
Goal: ${state.leadGoal || 'Not provided'}
Budget: ${state.leadBudget ? `$${state.leadBudget}/month` : 'Not provided'}
Email: ${state.leadEmail || 'Not provided'}
Status: ${state.qualificationStatus}
Appointment: ${state.appointmentScheduled ? 'Scheduled' : 'Not scheduled'}`;
  
  return {
    ghlTags: tags,
    ghlNotes: [note]
  };
}

// Determine next step in the conversation
function shouldContinue(state) {
  // Prevent infinite loops
  if (state.messageCount > 10) {
    return "update_ghl";
  }
  
  // End if appointment is confirmed
  if (state.currentStep === "confirmed" || state.appointmentScheduled) {
    return "update_ghl";
  }
  
  // Under budget - end conversation
  if (state.leadBudget && state.leadBudget < 300) {
    return "update_ghl";
  }
  
  // Need to get calendar slots
  if (state.leadEmail && !state.availableSlots && state.leadBudget >= 300) {
    return "get_calendar";
  }
  
  // If we have all info, end the conversation
  if (state.leadName && state.leadProblem && state.leadGoal && state.leadBudget && state.leadEmail) {
    return "update_ghl";
  }
  
  // Continue conversation
  return "update_ghl"; // Always end after one response to prevent loops
}

// Create the sales agent workflow
function createSalesAgent() {
  const workflow = new StateGraph({
    channels: SalesAgentState
  });
  
  // Add nodes
  workflow.addNode("analyze", analyzeMessage);
  workflow.addNode("respond", generateResponse);
  workflow.addNode("update_ghl", updateGHLTags);
  workflow.addNode("get_calendar", async (state) => {
    console.log("Getting real calendar slots from GHL...");
    
    try {
      // This will be injected from index.js
      const { ghlService, calendarId } = state.ghlConfig || {};
      
      if (!ghlService || !calendarId) {
        console.error("GHL service not configured");
        return { availableSlots: [] };
      }
      
      // Get real slots from GHL
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const slots = await ghlService.getAvailableSlots(calendarId, startDate, endDate);
      
      // Format slots for display
      const formattedSlots = slots.slice(0, 5).map((slot, index) => {
        const date = new Date(slot.startTime);
        return {
          display: date.toLocaleString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }),
          startTime: slot.startTime,
          endTime: slot.endTime,
          slotId: slot.id || `slot-${index}`
        };
      });
      
      return { availableSlots: formattedSlots };
      
    } catch (error) {
      console.error("Error fetching calendar slots:", error);
      // Return empty slots if API fails - no mock data
      return { availableSlots: [] };
    }
  });
  
  // Define flow
  workflow.addEdge("__start__", "analyze");
  workflow.addEdge("analyze", "respond");
  
  // Conditional routing after response
  workflow.addConditionalEdges(
    "respond",
    shouldContinue,
    {
      respond: "respond",
      update_ghl: "update_ghl", 
      get_calendar: "get_calendar"
    }
  );
  
  // Calendar leads back to respond to show slots
  workflow.addEdge("get_calendar", "respond");
  
  // Update GHL always ends the flow
  workflow.addEdge("update_ghl", END);
  
  return workflow.compile();
}

module.exports = { 
  createSalesAgent, 
  SalesAgentState,
  SALES_AGENT_PROMPT
};