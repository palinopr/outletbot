/**
 * LangGraph Platform API Handler - UPDATED
 * Fixes thread continuity and state persistence
 */

import { graph as webhookHandler } from '../agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import { Logger } from '../services/logger.js';

const logger = new Logger('langgraph-api');

/**
 * Main webhook endpoint for LangGraph Platform
 * FIXED: Maintains conversation continuity using conversationId
 */
export default async function handler(req, res) {
  logger.info('Webhook received', {
    method: req.method,
    path: req.path,
    headers: req.headers,
    bodyKeys: Object.keys(req.body || {})
  });

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Handle both direct webhook and LangGraph platform formats
    const webhookData = req.body.input || req.body;
    const { phone, message, contactId, conversationId, locationId } = webhookData;

    // Validate required fields
    if (!message || !contactId) {
      logger.error('Missing required fields', { 
        hasMessage: !!message, 
        hasContactId: !!contactId,
        hasConversationId: !!conversationId,
        hasPhone: !!phone 
      });
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['message', 'contactId'],
        optional: ['phone', 'conversationId', 'locationId']
      });
    }

    // CRITICAL FIX: Use conversationId as thread_id for continuity
    // If no conversationId, use contactId to ensure same contact keeps same thread
    const threadId = conversationId || `thread_${contactId}`;
    
    logger.info('Using thread ID for continuity', {
      threadId,
      conversationId,
      contactId,
      isNewThread: !conversationId
    });

    // CRITICAL FIX: Pass the actual message content, not JSON
    const state = {
      messages: [new HumanMessage(message)],
      contactId,
      phone: phone || '',
      conversationId: conversationId || contactId,
      // Pass thread_id in state for tools to access
      threadId: threadId
    };

    // Process through webhook handler
    logger.info('Processing webhook', { 
      contactId, 
      conversationId,
      threadId,
      phone, 
      messageLength: message.length 
    });
    
    // FIXED: Use consistent thread_id for conversation continuity
    const result = await webhookHandler.invoke(state, {
      configurable: {
        thread_id: threadId,  // CRITICAL: Use consistent thread ID
        contactId,
        conversationId: conversationId || contactId,
        phone,
        locationId,
        // Pass thread info for tools
        __pregel_thread_id: threadId
      }
    });

    logger.info('Webhook processed successfully', { 
      contactId, 
      threadId,
      messagesProcessed: result.messages?.length,
      leadInfoCollected: Object.keys(result.leadInfo || {}).filter(k => result.leadInfo[k]).length
    });

    // Return success response with thread info
    return res.status(200).json({ 
      success: true,
      message: 'Webhook processed successfully',
      contactId,
      threadId,  // Return thread ID for debugging
      leadInfo: result.leadInfo  // Return collected info
    });

  } catch (error) {
    logger.error('Webhook processing error', {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}