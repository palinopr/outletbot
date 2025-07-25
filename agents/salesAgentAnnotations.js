import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

/**
 * Modern state management using LangGraph Annotations
 * This replaces the complex custom reducers from classic StateGraph
 */

// Define comprehensive state with type-safe annotations
export const SalesAgentAnnotation = Annotation.Root({
  // Inherit base message handling from LangGraph
  ...MessagesAnnotation.spec,
  
  // Conversation metadata
  conversationId: Annotation({
    reducer: (curr, update) => update || curr,
    default: () => null
  }),
  
  contactId: Annotation({
    reducer: (curr, update) => update || curr,
    default: () => null
  }),
  
  // Lead information with structured data
  leadInfo: Annotation({
    reducer: (curr, update) => {
      // Merge updates into existing lead info
      if (!update) return curr;
      return { ...curr, ...update };
    },
    default: () => ({
      name: null,
      problem: null,
      goal: null,
      budget: null,
      email: null,
      phone: null
    })
  }),
  
  // Conversation flow tracking
  currentStep: Annotation({
    reducer: (curr, update) => update || curr,
    default: () => "greeting"
  }),
  
  // Appointment scheduling data
  availableSlots: Annotation({
    reducer: (curr, update) => update || curr,
    default: () => []
  }),
  
  selectedSlot: Annotation({
    reducer: (curr, update) => update || curr,
    default: () => null
  }),
  
  appointmentScheduled: Annotation({
    reducer: (curr, update) => update || curr,
    default: () => false
  }),
  
  appointmentDetails: Annotation({
    reducer: (curr, update) => update || curr,
    default: () => null
  }),
  
  // GHL integration tracking
  ghlTags: Annotation({
    reducer: (curr, update) => {
      if (!update) return curr;
      // Add new tags without duplicates
      const allTags = [...curr, ...update];
      return [...new Set(allTags)];
    },
    default: () => []
  }),
  
  ghlNotes: Annotation({
    reducer: (curr, update) => {
      if (!update) return curr;
      // Append new notes
      return [...curr, update];
    },
    default: () => []
  }),
  
  // Conversation metadata
  messageCount: Annotation({
    reducer: (curr) => curr + 1,
    default: () => 0
  }),
  
  conversationStartTime: Annotation({
    reducer: (curr, update) => curr || update,
    default: () => new Date().toISOString()
  }),
  
  // Qualification status
  qualificationStatus: Annotation({
    reducer: (curr, update) => update || curr,
    default: () => "in_progress"
  }),
  
  // Error tracking
  lastError: Annotation({
    reducer: (curr, update) => update || curr,
    default: () => null
  })
});

/**
 * Helper function to create initial state
 */
export function createInitialState(contactId, conversationId, phone) {
  return {
    messages: [],
    conversationId,
    contactId,
    leadInfo: { phone },
    currentStep: "greeting",
    availableSlots: [],
    selectedSlot: null,
    appointmentScheduled: false,
    appointmentDetails: null,
    ghlTags: [],
    ghlNotes: [],
    messageCount: 0,
    conversationStartTime: new Date().toISOString(),
    qualificationStatus: "in_progress",
    lastError: null
  };
}

/**
 * State validation helpers
 */
export const stateValidators = {
  isQualified: (state) => {
    const { leadInfo } = state;
    return leadInfo.name && 
           leadInfo.problem && 
           leadInfo.goal && 
           leadInfo.budget && 
           leadInfo.budget >= 300;
  },
  
  isUnderBudget: (state) => {
    const { leadInfo } = state;
    return leadInfo.budget && leadInfo.budget < 300;
  },
  
  hasAllInfo: (state) => {
    const { leadInfo } = state;
    return leadInfo.name && 
           leadInfo.problem && 
           leadInfo.goal && 
           leadInfo.budget;
  },
  
  readyToSchedule: (state) => {
    return stateValidators.isQualified(state) && 
           state.leadInfo.email && 
           !state.appointmentScheduled;
  }
};

/**
 * Conversation step definitions
 */
export const CONVERSATION_STEPS = {
  GREETING: "greeting",
  GETTING_NAME: "getting_name",
  GETTING_PROBLEM: "getting_problem",
  GETTING_GOAL: "getting_goal",
  GETTING_BUDGET: "getting_budget",
  GETTING_EMAIL: "getting_email",
  SHOWING_CALENDAR: "showing_calendar",
  BOOKING_APPOINTMENT: "booking_appointment",
  CONFIRMED: "confirmed",
  DECLINED: "declined",
  ERROR: "error"
};

/**
 * Tag definitions for GHL
 */
export const GHL_TAGS = {
  QUALIFIED: "qualified-lead",
  BUDGET_300_PLUS: "budget-300-plus",
  UNDER_BUDGET: "under-budget",
  NURTURE: "nurture-lead",
  APPOINTMENT_SCHEDULED: "appointment-scheduled",
  NEEDS_MARKETING: "needs-marketing",
  NEEDS_SALES: "needs-sales",
  NEEDS_BOTH: "needs-marketing-and-sales"
};