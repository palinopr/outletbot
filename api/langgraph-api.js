// LangGraph Platform API handler following best practices
import { graph } from '../agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';

// Request locking to prevent concurrent processing
const activeLocks = new Map();
const LOCK_TIMEOUT = 30000; // 30 seconds

export default async function handler(req, res) {
  console.log('\n=== LANGGRAPH WEBHOOK RECEIVED ===');
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract webhook data
    const { phone, message, contactId } = req.body;
    
    // Validate required fields
    if (!phone || !message || !contactId) {
      console.error('Missing required fields:', { 
        phone: !!phone, 
        message: !!message, 
        contactId: !!contactId 
      });
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['phone', 'message', 'contactId'],
        received: Object.keys(req.body)
      });
    }
    
    console.log('Processing webhook:', {
      contactId,
      phone,
      messagePreview: message.substring(0, 50) + '...'
    });
    
    // Check if this conversation is already being processed
    const lockKey = `${contactId}-lock`;
    if (activeLocks.has(lockKey)) {
      console.log('Conversation already being processed, returning early:', contactId);
      return res.status(200).json({ 
        success: true,
        message: 'Already processing',
        contactId
      });
    }
    
    // Acquire lock for this conversation
    activeLocks.set(lockKey, Date.now());
    
    // Set timeout to remove lock in case of unexpected errors
    const lockTimeout = setTimeout(() => {
      activeLocks.delete(lockKey);
      console.log('Lock timeout reached, removing lock:', contactId);
    }, LOCK_TIMEOUT);
    
    try {
      // Prepare input for the webhook handler graph following MessagesAnnotation pattern
      const input = {
        messages: [new HumanMessage({
          content: JSON.stringify({
            phone,
            message,
            contactId
          })
        })],
        contactId,
        phone
      };
      
      // Invoke the webhook handler graph with proper configuration
      const result = await graph.invoke(input, {
        configurable: {
          contactId,
          phone
        },
        recursionLimit: 30,
        streamMode: 'values' // Following LangGraph best practices
      });
      
      // Clear lock and timeout
      clearTimeout(lockTimeout);
      activeLocks.delete(lockKey);
    
      console.log('Webhook processing complete');
      
      // Check if this was a duplicate message
      if (result.duplicate) {
        return res.status(200).json({ 
          success: true,
          message: 'Duplicate message ignored',
          contactId
        });
      }
      
      // The webhook handler sends messages via tools
      // Return success acknowledgment following LangGraph patterns
      res.status(200).json({ 
        success: true,
        message: 'Webhook processed successfully',
        contactId,
        messageCount: result.messages?.length || 0
      });
    } finally {
      // Always ensure lock is released
      clearTimeout(lockTimeout);
      activeLocks.delete(lockKey);
    }
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Ensure lock is released on error
    activeLocks.delete(lockKey);
    
    // Handle specific error types
    if (error.name === 'CancelledError' || error.message?.includes('cancelled')) {
      return res.status(503).json({ 
        error: 'Service temporarily unavailable',
        message: 'The service is restarting. Please retry in a moment.'
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}