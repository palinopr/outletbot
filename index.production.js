require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createSalesAgent } = require('./agents/salesAgent');
const { GHLService, formatPhoneNumber } = require('./services/ghlService');
const { checkCalendarAvailability, bookAppointment, parseTimeSelection } = require('./agents/tools/calendarTool');
const { HumanMessage } = require('@langchain/core/messages');
const { initLangSmith } = require('./langsmith-config');
const { validateEnv } = require('./utils/validateEnv');
const ConversationManager = require('./services/conversationManager');
const RedisConversationManager = require('./services/redisConversationManager');

// Validate environment variables
validateEnv();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ 
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true 
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX || 100,
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/webhook', limiter);

// Initialize LangSmith for deployment
initLangSmith();

// Initialize GHL Service
const ghlService = new GHLService(
  process.env.GHL_API_KEY,
  process.env.GHL_LOCATION_ID
);

// Initialize conversation manager based on environment
let conversationManager;
if (process.env.REDIS_URL) {
  console.log('Using Redis for conversation management');
  conversationManager = new RedisConversationManager(ghlService, process.env.REDIS_URL);
} else {
  console.log('Using in-memory conversation management');
  conversationManager = new ConversationManager(ghlService);
}

// Create sales agent instance
const salesAgent = createSalesAgent();

// Webhook verification middleware
function verifyWebhook(req, res, next) {
  if (process.env.WEBHOOK_SECRET) {
    const signature = req.headers['x-ghl-signature'] || req.headers['x-webhook-signature'];
    
    if (!signature) {
      return res.status(401).json({ error: 'Missing webhook signature' });
    }
    
    // Add your signature verification logic here
    // This is a placeholder - implement based on GHL's webhook signature format
  }
  
  next();
}

// Webhook endpoint for Meta ads via GHL
app.post('/webhook/meta-lead', verifyWebhook, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { phone, message, contactId, conversationId } = req.body;
    
    // Validate required fields
    if (!phone || !message || !contactId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: phone, message, or contactId' 
      });
    }
    
    console.log(`[${new Date().toISOString()}] Webhook received:`, { 
      contactId, 
      conversationId,
      messageLength: message.length 
    });
    
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
    if (conversationManager.clearCache) {
      await conversationManager.clearCache(contactId, conversationId);
    }
    
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
            if (conversationManager.clearCache) {
              await conversationManager.clearCache(contactId, conversationId);
            }
            
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
    
    // Update GHL contact with tags and notes (non-blocking)
    updateGHLContact(contactId, result).catch(error => {
      console.error('Error updating GHL contact:', error);
    });
    
    // Log processing time
    const processingTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Request processed in ${processingTime}ms`);
    
    res.json({ 
      success: true, 
      message: 'Processed successfully',
      processingTime: `${processingTime}ms`
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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

// Helper function to send response back to GHL
async function sendGHLResponse(contactId, message) {
  try {
    await ghlService.sendSMS(contactId, message);
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error; // Re-throw to handle in calling function
  }
}

// Health check endpoint with detailed status
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  };
  
  // Check GHL connection
  try {
    await ghlService.getHeaders(); // Simple check
    health.ghl = 'connected';
  } catch (error) {
    health.ghl = 'disconnected';
    health.status = 'degraded';
  }
  
  // Check Redis connection if using Redis
  if (process.env.REDIS_URL && conversationManager.connected !== undefined) {
    health.redis = conversationManager.connected ? 'connected' : 'disconnected';
  }
  
  res.json(health);
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    pid: process.pid,
    version: process.version,
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Sales agent bot running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`LangSmith: ${process.env.LANGCHAIN_TRACING_V2 === 'true' ? 'enabled' : 'disabled'}`);
  
  // Send ready signal to PM2
  if (process.send) {
    process.send('ready');
  }
});

// Cleanup interval for cache
const cleanupInterval = setInterval(() => {
  if (conversationManager.cleanupCache) {
    conversationManager.cleanupCache();
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
  
  // Give ongoing requests 10 seconds to complete
  setTimeout(() => {
    console.log('Forcing shutdown after timeout');
    process.exit(0);
  }, 10000);
  
  // Clean up resources
  try {
    // Disconnect Redis if using it
    if (conversationManager.disconnect) {
      await conversationManager.disconnect();
      console.log('Redis disconnected');
    }
    
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
  // Log to monitoring service if configured
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log to monitoring service if configured
  // Don't exit on unhandled rejections in production
});

module.exports = app; // For testing