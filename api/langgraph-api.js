/**
 * LangGraph Platform API Handler
 * This file handles webhook requests for the LangGraph platform deployment
 */

import { graph as webhookHandler } from '../agents/webhookHandler.js';
import { HumanMessage } from '@langchain/core/messages';
import { Logger } from '../services/logger.js';

const logger = new Logger('langgraph-api');

/**
 * Main webhook endpoint for LangGraph Platform
 * Receives webhooks from GHL and processes them through the sales agent
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
    const { phone, message, contactId } = req.body;

    // Validate required fields
    if (!phone || !message || !contactId) {
      logger.error('Missing required fields', { phone: !!phone, message: !!message, contactId: !!contactId });
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['phone', 'message', 'contactId']
      });
    }

    // Prepare state for webhook handler
    const state = {
      messages: [new HumanMessage(JSON.stringify({ phone, message, contactId }))],
      contactId,
      phone
    };

    // Process through webhook handler
    logger.info('Processing webhook', { contactId, phone, messageLength: message.length });
    
    const result = await webhookHandler.invoke(state, {
      configurable: {
        thread_id: contactId
      }
    });

    logger.info('Webhook processed successfully', { 
      contactId, 
      messagesProcessed: result.messages?.length 
    });

    // Return success response
    return res.status(200).json({ 
      success: true,
      message: 'Webhook processed successfully',
      contactId
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