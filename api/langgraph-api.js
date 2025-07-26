// LangGraph Platform API handler following best practices
import { graph } from '../agents/salesAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import { validateEnvironment } from '../validateEnv.js';
import { Logger } from '../services/logger.js';
import { validateRequest, webhookRequestSchema } from '../services/validation.js';
import { createRateLimiter, createContactRateLimiter, createPhoneRateLimiter } from '../services/rateLimiter.js';
import { metrics, metricsMiddleware, metricsHandler } from '../services/monitoring.js';
import { trackRequest, initializeShutdownHandlers, onShutdown } from '../services/shutdown.js';
import { AppError, ValidationError, NotFoundError } from '../services/errors.js';
import healthHandler from './health.js';

// Initialize logger
const logger = new Logger('langgraph-api');

// Validate environment on startup
validateEnvironment();

// Initialize shutdown handlers
initializeShutdownHandlers({ timeout: 30000 });

// Request locking to prevent concurrent processing
const activeLocks = new Map();
const LOCK_TIMEOUT = 30000; // 30 seconds

// Register cleanup for active locks on shutdown
onShutdown(async () => {
  logger.info('Clearing active conversation locks', { count: activeLocks.size });
  activeLocks.clear();
});

/**
 * Apply middleware chain to a handler
 * Includes request tracking, metrics, and rate limiting
 * @param {Function} handler - The handler function to wrap
 * @returns {Function} Wrapped handler with middleware applied
 */
export function applyMiddleware(handler) {
  return async (req, res) => {
    // Track request for graceful shutdown
    await new Promise((resolve, reject) => {
      trackRequest(req, res, (err) => err ? reject(err) : resolve());
    });
    
    // Apply metrics middleware
    await new Promise((resolve, reject) => {
      metricsMiddleware()(req, res, (err) => err ? reject(err) : resolve());
    });
    
    // Apply rate limiting
    const rateLimiters = [
      createRateLimiter(),
      createContactRateLimiter(),
      createPhoneRateLimiter()
    ];
    
    for (const limiter of rateLimiters) {
      await new Promise((resolve, reject) => {
        limiter(req, res, (err) => err ? reject(err) : resolve());
      });
    }
    
    // Call the actual handler
    return handler(req, res);
  };
}

/**
 * Main webhook handler for processing Meta lead webhooks
 * Validates requests, manages conversation locks, and invokes the sales agent
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function webhookHandler(req, res) {
  const startTime = Date.now();
  
  logger.info('LANGGRAPH WEBHOOK RECEIVED', {
    method: req.method,
    path: req.url,
    headers: req.headers
  });
  
  if (req.method !== 'POST') {
    metrics.recordApiRequest('/webhook/meta-lead', req.method, 405, Date.now() - startTime);
    return res.status(405).json({ 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      allowed: ['POST']
    });
  }

  try {
    // Validate request body
    const validationResult = validateRequest(req.body, webhookRequestSchema);
    
    if (!validationResult.success) {
      logger.error('Request validation failed', { 
        errors: validationResult.errors 
      });
      metrics.recordApiRequest('/webhook/meta-lead', req.method, 400, Date.now() - startTime);
      throw new ValidationError(validationResult.errors);
    }
    
    const validatedBody = validationResult.data;
    const { phone, message, contactId, conversationId } = validatedBody;
    
    // Store validated body for other middleware
    req.validatedBody = validatedBody;
    
    logger.info('Processing webhook', {
      contactId,
      conversationId,
      phone,
      messagePreview: message.substring(0, 50) + '...'
    });
    
    // Check if this conversation is already being processed
    const lockKey = `${contactId}-lock`;
    if (activeLocks.has(lockKey)) {
      logger.info('Conversation already being processed, returning early', { contactId });
      metrics.recordApiRequest('/webhook/meta-lead', req.method, 200, Date.now() - startTime);
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
      logger.warn('Lock timeout reached, removing lock', { contactId });
    }, LOCK_TIMEOUT);
    
    // Record business metrics
    metrics.recordConversationStarted();
    
    try {
      // Prepare input for the webhook handler graph following MessagesAnnotation pattern
      const input = {
        messages: [new HumanMessage({
          content: JSON.stringify({
            phone,
            message,
            contactId,
            conversationId
          })
        })],
        contactId,
        conversationId,
        phone
      };
      
      // Invoke the webhook handler graph with proper configuration
      const invocationStartTime = Date.now();
      const result = await graph.invoke(input, {
        configurable: {
          contactId,
          conversationId,
          phone,
          // Use contactId as thread_id for checkpointing
          thread_id: contactId
        },
        recursionLimit: 30,
        streamMode: 'values' // Following LangGraph best practices
      });
      
      // Record successful invocation
      const invocationLatency = Date.now() - invocationStartTime;
      logger.info('Graph invocation completed', {
        latency: invocationLatency,
        contactId
      });
      
      // Clear lock and timeout
      clearTimeout(lockTimeout);
      activeLocks.delete(lockKey);
    
      logger.info('Webhook processing complete');
      
      // Check if this was a duplicate message
      if (result.duplicate) {
        metrics.recordApiRequest('/webhook/meta-lead', req.method, 200, Date.now() - startTime);
        return res.status(200).json({ 
          success: true,
          message: 'Duplicate message ignored',
          contactId
        });
      }
      
      // Check if lead was qualified
      if (result.leadInfo?.budget >= 300) {
        metrics.recordQualifiedLead();
      } else if (result.leadInfo?.budget && result.leadInfo.budget < 300) {
        metrics.recordUnderBudgetLead();
      }
      
      // Check if appointment was booked
      if (result.appointmentBooked) {
        metrics.recordAppointmentBooked();
      }
      
      // Record successful completion
      metrics.recordConversationCompleted();
      metrics.recordApiRequest('/webhook/meta-lead', req.method, 200, Date.now() - startTime);
      
      // The webhook handler sends messages via tools
      // Return success acknowledgment following LangGraph patterns
      res.status(200).json({ 
        success: true,
        message: 'Webhook processed successfully',
        contactId,
        messageCount: result.messages?.length || 0,
        processingTime: Date.now() - startTime
      });
    } finally {
      // Always ensure lock is released
      clearTimeout(lockTimeout);
      activeLocks.delete(lockKey);
    }
    
  } catch (error) {
    const errorLatency = Date.now() - startTime;
    
    logger.error('Webhook processing error', { 
      error: error.message,
      stack: error.stack,
      code: error.code,
      contactId: req.validatedBody?.contactId
    });
    
    // Ensure lock is released on error
    if (req.validatedBody?.contactId) {
      const lockKey = `${req.validatedBody.contactId}-lock`;
      activeLocks.delete(lockKey);
    }
    
    // Handle AppError instances
    if (error instanceof AppError) {
      metrics.recordApiRequest('/webhook/meta-lead', req.method, error.statusCode, errorLatency);
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        timestamp: error.timestamp,
        ...(error instanceof ValidationError && { validation: error.validationErrors })
      });
    }
    
    // Handle specific error types
    if (error.name === 'CancelledError' || error.message?.includes('cancelled')) {
      metrics.recordApiRequest('/webhook/meta-lead', req.method, 503, errorLatency);
      return res.status(503).json({ 
        error: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
        message: 'The service is restarting. Please retry in a moment.',
        retryAfter: 5
      });
    }
    
    // Generic error response
    metrics.recordApiRequest('/webhook/meta-lead', req.method, 500, errorLatency);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Main route handler with path-based routing
 * Routes requests to appropriate handlers based on URL path
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
  // Route to appropriate handler
  if (req.url === '/health' || req.url === '/api/health') {
    return healthHandler(req, res);
  }
  
  if (req.url === '/metrics' || req.url === '/api/metrics') {
    return metricsHandler(req, res);
  }
  
  if (req.url === '/webhook/meta-lead' || req.url === '/api/webhook/meta-lead') {
    return applyMiddleware(webhookHandler)(req, res);
  }
  
  // 404 for unknown routes
  metrics.recordApiRequest(req.url, req.method, 404, 0);
  return res.status(404).json({
    error: 'Not found',
    code: 'NOT_FOUND',
    message: `Route ${req.url} not found`,
    availableRoutes: [
      '/webhook/meta-lead',
      '/health',
      '/metrics'
    ]
  });
}