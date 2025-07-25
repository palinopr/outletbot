import { salesAgent } from '../agents/modernSalesAgent.js';
import { GHLService, formatPhoneNumber } from '../services/ghlService.js';
import ConversationManager from '../services/conversationManager.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

// Initialize services
let ghlService;
let conversationManager;

// Initialize on cold start
async function initialize() {
  if (!ghlService) {
    ghlService = new GHLService(
      process.env.GHL_API_KEY,
      process.env.GHL_LOCATION_ID
    );
    
    conversationManager = new ConversationManager(ghlService);
  }
}

// Main webhook handler for modern LangGraph
export async function handleWebhook(req) {
  await initialize();
  
  try {
    const { phone, message, contactId, conversationId } = req.body;
    
    // Validate required fields
    if (!phone || !message || !contactId) {
      return {
        statusCode: 400,
        body: { 
          success: false, 
          error: 'Missing required fields: phone, message, or contactId' 
        }
      };
    }
    
    console.log('Modern webhook received:', { contactId, conversationId, message });
    
    // Get conversation state from GHL
    let conversationState = await conversationManager.getConversationState(contactId, conversationId);
    
    // Build messages array for the agent
    const messages = [
      ...conversationState.messages,
      new HumanMessage(message)
    ];
    
    // Extract current lead info for context
    const currentLeadInfo = {
      name: conversationState.leadName,
      problem: conversationState.leadProblem,
      goal: conversationState.leadGoal,
      budget: conversationState.leadBudget,
      email: conversationState.leadEmail,
      phone: formatPhoneNumber(phone)
    };
    
    // Invoke the modern agent
    const result = await salesAgent.invoke({
      messages,
      // Pass current lead info as context
      leadInfo: currentLeadInfo,
      contactId,
      conversationId: conversationState.conversationId
    }, {
      // Configuration for tools
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId,
        currentLeadInfo
      }
    });
    
    // The agent will handle sending messages via send_ghl_message tool
    // We don't send webhook responses - the agent uses GHL's messaging API
    
    // Check if agent used any tools
    const toolCalls = result.messages.filter(m => m.tool_calls?.length > 0);
    
    // Track what happened for logging and state management
    let messageSent = false;
    let appointmentBooked = false;
    
    // Handle specific tool results
    for (const toolCall of toolCalls) {
      const toolResults = toolCall.tool_calls;
      
      for (const tool of toolResults) {
        switch (tool.name) {
          case 'send_ghl_message':
            // Agent sent a message via GHL
            messageSent = true;
            console.log('Message sent via GHL:', tool.args.message);
            break;
            
          case 'extract_lead_info':
            // Tool extracted lead info - update our state
            const extracted = tool.args.result || {};
            if (extracted.name) conversationState.leadName = extracted.name;
            if (extracted.problem) conversationState.leadProblem = extracted.problem;
            if (extracted.goal) conversationState.leadGoal = extracted.goal;
            if (extracted.budget) conversationState.leadBudget = extracted.budget;
            if (extracted.email) conversationState.leadEmail = extracted.email;
            break;
            
          case 'get_calendar_slots':
            // Calendar slots were fetched
            if (tool.args.result?.success) {
              conversationState.availableSlots = tool.args.result.slots || [];
            }
            break;
            
          case 'book_appointment':
            // Appointment was booked
            if (tool.args.result?.success) {
              conversationState.appointmentScheduled = true;
              appointmentBooked = true;
            }
            break;
            
          case 'update_ghl_contact':
            // Contact was updated in GHL
            console.log('GHL contact updated:', tool.args.result);
            break;
        }
      }
    }
    
    // Clear conversation cache
    conversationManager.clearCache(contactId, conversationId);
    
    // Determine if conversation should end
    const shouldEnd = conversationState.appointmentScheduled || 
                     (conversationState.leadBudget && conversationState.leadBudget < 300);
    
    // Final GHL updates if conversation is ending
    if (shouldEnd) {
      const tags = [];
      const notes = [];
      
      // Determine tags
      if (conversationState.leadBudget >= 300) {
        tags.push('qualified-lead', 'budget-300-plus');
        if (conversationState.appointmentScheduled) {
          tags.push('appointment-scheduled');
        }
      } else if (conversationState.leadBudget < 300) {
        tags.push('under-budget', 'nurture-lead');
      }
      
      if (conversationState.leadProblem?.toLowerCase().includes('marketing')) {
        tags.push('needs-marketing');
      }
      if (conversationState.leadProblem?.toLowerCase().includes('sales')) {
        tags.push('needs-sales');
      }
      
      // Create summary note
      const note = `Lead Qualification Summary:
Name: ${conversationState.leadName || 'Not provided'}
Problem: ${conversationState.leadProblem || 'Not provided'}
Goal: ${conversationState.leadGoal || 'Not provided'}
Budget: ${conversationState.leadBudget ? `$${conversationState.leadBudget}/month` : 'Not provided'}
Email: ${conversationState.leadEmail || 'Not provided'}
Appointment: ${conversationState.appointmentScheduled ? 'Scheduled' : 'Not scheduled'}`;
      
      // Update GHL asynchronously
      updateGHLAsync(contactId, tags, note, conversationState).catch(err => 
        console.error('Error updating GHL:', err)
      );
    }
    
    return {
      statusCode: 200,
      body: { 
        success: true, 
        message: 'Webhook processed - agent handled messaging via GHL',
        messageSent,
        appointmentBooked,
        leadStatus: {
          hasName: !!conversationState.leadName,
          hasProblem: !!conversationState.leadProblem,
          hasGoal: !!conversationState.leadGoal,
          hasBudget: !!conversationState.leadBudget,
          hasEmail: !!conversationState.leadEmail,
          qualified: conversationState.leadBudget >= 300
        }
      }
    };
    
  } catch (error) {
    console.error('Modern webhook error:', error);
    return {
      statusCode: 500,
      body: { success: false, error: error.message }
    };
  }
}

// Async GHL update function
async function updateGHLAsync(contactId, tags, note, leadInfo) {
  try {
    // Add tags
    if (tags.length > 0) {
      await ghlService.addTags(contactId, tags);
    }
    
    // Add note
    if (note) {
      await ghlService.addNote(contactId, note);
    }
    
    // Update contact info
    const updates = {};
    if (leadInfo.leadName) updates.firstName = leadInfo.leadName;
    if (leadInfo.leadEmail) updates.email = leadInfo.leadEmail;
    
    if (Object.keys(updates).length > 0) {
      await ghlService.updateContact(contactId, updates);
    }
    
    console.log('GHL updated successfully for contact:', contactId);
  } catch (error) {
    console.error('Error in async GHL update:', error);
  }
}

// Health check handler
export async function healthCheck(req) {
  return {
    statusCode: 200,
    body: {
      status: 'ok',
      version: '2.0.0', // Modern version
      platform: 'langgraph',
      pattern: 'createReactAgent',
      timestamp: new Date().toISOString()
    }
  };
}

// Export handlers
export default {
  handleWebhook,
  healthCheck
};