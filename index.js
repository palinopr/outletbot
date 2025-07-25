require('dotenv').config();
const express = require('express');
const { createSalesAgent } = require('./agents/salesAgent');
const { GHLService, formatPhoneNumber } = require('./services/ghlService');
const { checkCalendarAvailability, bookAppointment, parseTimeSelection } = require('./agents/tools/calendarTool');
const { HumanMessage } = require('@langchain/core/messages');
const { initLangSmith } = require('./langsmith-config');
const { validateEnv } = require('./utils/validateEnv');
const ConversationManager = require('./services/conversationManager');

// Validate environment variables
validateEnv();

const app = express();
app.use(express.json());

// Initialize LangSmith for deployment
initLangSmith();

// Initialize GHL Service
const ghlService = new GHLService(
  process.env.GHL_API_KEY,
  process.env.GHL_LOCATION_ID
);

// Initialize conversation manager (uses GHL as source of truth)
const conversationManager = new ConversationManager(ghlService);

// Keep a temporary cache for performance (optional)
const responseCache = new Map();

// Create sales agent instance
const salesAgent = createSalesAgent();

// Webhook endpoint for Meta ads via GHL
app.post('/webhook/meta-lead', async (req, res) => {
  try {
    const { phone, message, contactId, conversationId } = req.body;
    
    // Validate required fields
    if (!phone || !message || !contactId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: phone, message, or contactId' 
      });
    }
    
    console.log('Received webhook:', { phone, message, contactId });
    
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
    
    // Check if we need to book an appointment
    if (result.currentStep === 'scheduling' && result.availableSlots && result.availableSlots.length > 0 && !result.appointmentScheduled) {
      // Check if the message contains a time selection
      const selectedSlot = parseTimeSelection(message, result.availableSlots);
      
      if (selectedSlot) {
        try {
          // Book the real appointment in GHL
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
            
            // Clear cache after appointment booking
            conversationManager.clearCache(contactId, conversationId);
            
            // Send confirmation
            const confirmationMessage = `Perfect! I've scheduled your appointment for ${selectedSlot.display}. You'll receive a calendar invite at ${result.leadEmail}. Looking forward to speaking with you!`;
            await sendGHLResponse(contactId, confirmationMessage);
            
            // Add appointment confirmation tag
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
    
    // Update GHL contact with tags and notes
    try {
      if (result.ghlTags && result.ghlTags.length > 0) {
        await ghlService.addTags(contactId, result.ghlTags);
      }
    } catch (tagError) {
      console.error('Error adding tags:', tagError);
    }
    
    try {
      if (result.ghlNotes && result.ghlNotes.length > 0) {
        for (const note of result.ghlNotes) {
          await ghlService.addNote(contactId, note);
        }
      }
    } catch (noteError) {
      console.error('Error adding notes:', noteError);
    }
    
    // Update contact information in GHL
    try {
      const contactUpdate = {};
      if (result.leadName) contactUpdate.firstName = result.leadName;
      if (result.leadEmail) contactUpdate.email = result.leadEmail;
      if (Object.keys(contactUpdate).length > 0) {
        await ghlService.updateContact(contactId, contactUpdate);
      }
    } catch (updateError) {
      console.error('Error updating contact:', updateError);
      // Continue execution even if update fails
    }
    
    res.json({ success: true, message: 'Processed successfully' });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to send response back to GHL
async function sendGHLResponse(contactId, message) {
  try {
    await ghlService.sendSMS(contactId, message);
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Sales agent bot running on port ${PORT}`);
  
  // Send ready signal to PM2
  if (process.send) {
    process.send('ready');
  }
});

// Cleanup cache interval
const cleanupInterval = setInterval(() => {
  conversationManager.cleanupCache();
  // Also clean response cache
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [id, data] of responseCache.entries()) {
    if (data.timestamp < oneHourAgo) {
      responseCache.delete(id);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed');
  });
  
  // Clear intervals
  clearInterval(cleanupInterval);
  
  // Give ongoing requests 5 seconds to complete
  setTimeout(() => {
    console.log('Forcing shutdown after timeout');
    process.exit(0);
  }, 5000);
  
  // Clean up resources
  try {
    // Close any database connections here if needed
    console.log('Cleanup completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});