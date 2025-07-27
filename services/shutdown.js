/**
 * Graceful shutdown handler
 */
import { Logger } from './logger.js';
import { metrics } from './monitoring.js';

const logger = new Logger('shutdown');

// Track shutdown state
let isShuttingDown = false;
let shutdownCallbacks = [];
let activeRequests = new Set();
let shutdownTimeout = 30000; // 30 seconds default

/**
 * Register a cleanup callback
 */
export function onShutdown(callback) {
  if (typeof callback !== 'function') {
    throw new Error('Shutdown callback must be a function');
  }
  shutdownCallbacks.push(callback);
}

/**
 * Track active request
 */
export function trackRequest(req, res, next) {
  const requestId = `${Date.now()}-${Math.random()}`;
  activeRequests.add(requestId);
  
  // Remove from active requests when done
  const cleanup = () => {
    activeRequests.delete(requestId);
  };
  
  res.on('finish', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
  
  // Block new requests during shutdown
  if (isShuttingDown) {
    res.status(503).json({
      error: 'Service is shutting down',
      message: 'The service is being restarted. Please retry in a moment.',
      retryAfter: 5
    });
    return;
  }
  
  next();
}

/**
 * Wait for active requests to complete
 */
async function waitForActiveRequests(timeout) {
  const startTime = Date.now();
  
  while (activeRequests.size > 0) {
    if (Date.now() - startTime > timeout) {
      logger.warn('Timeout waiting for active requests', {
        activeRequests: activeRequests.size
      });
      break;
    }
    
    logger.info('Waiting for active requests to complete', {
      activeRequests: activeRequests.size
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

/**
 * Perform graceful shutdown
 */
export async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    logger.info('Shutdown already in progress');
    return;
  }
  
  isShuttingDown = true;
  logger.info(`Graceful shutdown initiated by ${signal}`);
  
  try {
    // Log final metrics
    const finalMetrics = metrics.getMetricsSummary();
    logger.info('Final metrics before shutdown', finalMetrics);
    
    // Stop accepting new requests
    logger.info('Stopping new request acceptance');
    
    // Wait for active requests
    await waitForActiveRequests(shutdownTimeout);
    
    // Run cleanup callbacks
    logger.info('Running cleanup callbacks', {
      callbackCount: shutdownCallbacks.length
    });
    
    for (const callback of shutdownCallbacks) {
      try {
        await callback();
      } catch (error) {
        logger.error('Cleanup callback error', {
          error: error.message
        });
      }
    }
    
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

/**
 * Force shutdown after timeout
 */
function forceShutdown() {
  logger.error('Forced shutdown due to timeout');
  process.exit(1);
}

/**
 * Initialize shutdown handlers
 */
export function initializeShutdownHandlers(options = {}) {
  shutdownTimeout = options.timeout || shutdownTimeout;
  
  // Handle different termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack
    });
    gracefulShutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', {
      reason,
      promise
    });
    gracefulShutdown('unhandledRejection');
  });
  
  // Force shutdown after timeout
  process.on('SIGTERM', () => {
    setTimeout(forceShutdown, shutdownTimeout);
  });
  
  logger.info('Shutdown handlers initialized', {
    timeout: shutdownTimeout
  });
}

/**
 * Check if system is shutting down
 */
export function isSystemShuttingDown() {
  return isShuttingDown;
}

// Example cleanup callbacks for common resources
export const cleanupCallbacks = {
  /**
   * Close database connections
   */
  closeDatabase: async (connection) => {
    logger.info('Closing database connection');
    try {
      await connection.close();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database', { error: error.message });
    }
  },
  
  /**
   * Close Redis connection
   */
  closeRedis: async (client) => {
    logger.info('Closing Redis connection');
    try {
      await client.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis', { error: error.message });
    }
  },
  
  /**
   * Save in-memory data
   */
  saveInMemoryData: async (data, saveFunction) => {
    logger.info('Saving in-memory data');
    try {
      await saveFunction(data);
      logger.info('In-memory data saved');
    } catch (error) {
      logger.error('Error saving in-memory data', { error: error.message });
    }
  }
};

export default {
  onShutdown,
  trackRequest,
  initializeShutdownHandlers,
  isSystemShuttingDown,
  cleanupCallbacks
};