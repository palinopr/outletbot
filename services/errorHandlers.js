// Global error handlers for production stability
import { Logger } from './logger.js';
import { metrics } from './monitoring.js';
import { gracefulShutdown } from './shutdown.js';

const logger = new Logger('ErrorHandlers');

// Track if handlers are already installed
let handlersInstalled = false;

/**
 * Install global error handlers
 */
export function installGlobalErrorHandlers() {
  if (handlersInstalled) {
    logger.warn('Global error handlers already installed');
    return;
  }
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise
    });
    
    // Track in metrics
    metrics.increment('errors.unhandled_rejection');
    
    // In production, we might want to exit after logging
    if (process.env.NODE_ENV === 'production') {
      logger.error('Shutting down due to unhandled rejection');
      gracefulShutdown(1);
    }
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    // Track in metrics
    metrics.increment('errors.uncaught_exception');
    
    // Always exit on uncaught exception
    logger.error('Shutting down due to uncaught exception');
    gracefulShutdown(1);
  });
  
  // Handle SIGTERM for graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, initiating graceful shutdown');
    gracefulShutdown(0);
  });
  
  // Handle SIGINT for graceful shutdown (Ctrl+C)
  process.on('SIGINT', () => {
    logger.info('SIGINT received, initiating graceful shutdown');
    gracefulShutdown(0);
  });
  
  // Handle warning events
  process.on('warning', (warning) => {
    logger.warn('Process Warning', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack
    });
    metrics.increment('warnings.process');
  });
  
  // Memory usage monitoring
  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const rssMB = Math.round(memUsage.rss / 1024 / 1024);
      
      logger.debug('Memory Usage', {
        heapUsedMB,
        heapTotalMB,
        rssMB,
        heapPercentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      });
      
      // Warn if heap usage is too high
      if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
        logger.warn('High memory usage detected', {
          heapPercentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
        });
        metrics.increment('warnings.high_memory');
      }
    }, 60000); // Check every minute
  }
  
  handlersInstalled = true;
  logger.info('Global error handlers installed');
}

/**
 * Error wrapper for async route handlers
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}