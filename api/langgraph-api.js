const { createSalesAgent } = require('../agents/salesAgent');
const { GHLService, formatPhoneNumber } = require('../services/ghlService');
const ConversationManager = require('../services/conversationManager');
const { HumanMessage } = require('@langchain/core/messages');
const { parseTimeSelection } = require('../agents/tools/calendarTool');

// Initialize services
let ghlService;
let conversationManager;
let salesAgent;

// Initialize on cold start
async function initialize() {
  if (!ghlService) {
    ghlService = new GHLService(
      process.env.GHL_API_KEY,
      process.env.GHL_LOCATION_ID
    );
    
    conversationManager = new ConversationManager(ghlService);
    salesAgent = createSalesAgent();
  }
}

// Main webhook handler for LangGraph Platform
async function handleWebhook(req) {
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
    
    console.log('Webhook received:', { contactId, conversationId, message });
    
    // Format phone number
    const formattedPhone = formatPhoneNumber(phone);
    
    // Get conversation state from GHL
    let conversationState = await conversationManager.getConversationState(contactId, conversationId);
    
    // Add the new incoming message
    conversationState.messages.push(new HumanMessage(message));
    conversationState.messageCount = conversationState.messages.length;
    
    // Add GHL configuration to state
    conversationState.ghlConfig = {
      ghlService,
      calendarId: process.env.GHL_CALENDAR_ID
    };
    
    // Process message through sales agent
    const result = await salesAgent.invoke(conversationState);
    
    // Clear cache to ensure fresh data on next request
    conversationManager.clearCache(contactId, conversationId);
    
    // Get the AI response (last message)
    const aiResponse = result.messages[result.messages.length - 1].content;
    
    // Handle appointment scheduling
    if (result.currentStep === 'scheduling' && result.availableSlots && result.availableSlots.length > 0 && !result.appointmentScheduled) {
      const selectedSlot = parseTimeSelection(message, result.availableSlots);
      
      if (selectedSlot) {
        try {
          // Book the appointment in GHL
          const bookingResult = await ghlService.bookAppointment(
            process.env.GHL_CALENDAR_ID,
            contactId,
            {
              title: `Sales Call with ${result.leadName}`,
              appointmentStatus: 'confirmed',
              startTime: selectedSlot.startTime,
              endTime: selectedSlot.endTime
            }
          );
          
          if (bookingResult) {
            result.appointmentScheduled = true;
            conversationManager.clearCache(contactId, conversationId);
            
            // Send confirmation
            const confirmationMessage = `Perfect! I've scheduled your appointment for ${selectedSlot.display}. You'll receive a calendar invite at ${result.leadEmail}. Looking forward to speaking with you!`;
            await sendGHLResponse(contactId, confirmationMessage);
            
            result.ghlTags.push("appointment-booked");
          }
        } catch (error) {
          console.error("Error booking appointment:", error);
          await sendGHLResponse(contactId, "I encountered an issue booking your appointment. Our team will reach out to you directly to schedule.");
        }
      } else {
        // No time selected yet, send the response with available times
        await sendGHLResponse(contactId, aiResponse);
      }
    } else {
      // Send regular response
      await sendGHLResponse(contactId, aiResponse);
    }
    
    // Update GHL contact (non-blocking)
    updateGHLContact(contactId, result).catch(error => {
      console.error('Error updating GHL contact:', error);
    });
    
    return {
      statusCode: 200,
      body: { 
        success: true, 
        message: 'Processed successfully',
        response: aiResponse
      }
    };
    
  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 500,
      body: { success: false, error: error.message }
    };
  }
}

// Helper function to send response back to GHL
async function sendGHLResponse(contactId, message) {
  try {
    await ghlService.sendSMS(contactId, message);
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
}

// Helper function to update GHL contact
async function updateGHLContact(contactId, result) {
  const updatePromises = [];
  
  // Update tags
  if (result.ghlTags && result.ghlTags.length > 0) {
    updatePromises.push(
      ghlService.addTags(contactId, result.ghlTags).catch(err => 
        console.error('Error adding tags:', err)
      )
    );
  }
  
  // Add notes
  if (result.ghlNotes && result.ghlNotes.length > 0) {
    for (const note of result.ghlNotes) {
      updatePromises.push(
        ghlService.addNote(contactId, note).catch(err => 
          console.error('Error adding note:', err)
        )
      );
    }
  }
  
  // Update contact information
  const contactUpdate = {};
  if (result.leadName) contactUpdate.firstName = result.leadName;
  if (result.leadEmail) contactUpdate.email = result.leadEmail;
  
  if (Object.keys(contactUpdate).length > 0) {
    updatePromises.push(
      ghlService.updateContact(contactId, contactUpdate).catch(err => 
        console.error('Error updating contact:', err)
      )
    );
  }
  
  await Promise.all(updatePromises);
}

// Health check handler
async function healthCheck(req) {
  return {
    statusCode: 200,
    body: {
      status: 'ok',
      version: '1.0.0',
      platform: 'langgraph',
      timestamp: new Date().toISOString()
    }
  };
}

module.exports = {
  handleWebhook,
  healthCheck
};