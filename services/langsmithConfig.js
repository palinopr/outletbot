// LangSmith configuration to handle multipart run ingestion errors
import { Logger } from './logger.js';

const logger = new Logger('langsmithConfig');

// Configure LangSmith client options to handle large payloads
export const langsmithConfig = {
  // Reduce payload size by filtering large content
  maxPayloadSize: 1024 * 1024, // 1MB limit
  
  // Batch configuration to prevent multipart errors
  batchSize: 10,
  flushInterval: 1000, // 1 second
  
  // Retry configuration for failed uploads
  maxRetries: 3,
  retryDelay: 1000,
  
  // Filter out large message content to prevent multipart errors
  sanitizePayload: (payload) => {
    if (!payload) return payload;
    
    try {
      // Deep clone to avoid modifying original
      const sanitized = JSON.parse(JSON.stringify(payload));
      
      // Truncate large string fields
      const truncateStrings = (obj, maxLength = 1000) => {
        if (typeof obj === 'string' && obj.length > maxLength) {
          return obj.substring(0, maxLength) + '... [truncated]';
        }
        if (Array.isArray(obj)) {
          return obj.map(item => truncateStrings(item, maxLength));
        }
        if (obj && typeof obj === 'object') {
          const result = {};
          for (const [key, value] of Object.entries(obj)) {
            result[key] = truncateStrings(value, maxLength);
          }
          return result;
        }
        return obj;
      };
      
      return truncateStrings(sanitized);
    } catch (error) {
      logger.warn('Failed to sanitize payload', { error: error.message });
      return payload;
    }
  },
  
  // Configure callbacks to handle trace errors
  callbacks: {
    onError: (error) => {
      if (error.message?.includes('multipart') || error.message?.includes('ingestion')) {
        logger.warn('LangSmith multipart ingestion error - payload too large', {
          error: error.message,
          suggestion: 'Consider reducing message history or tool response sizes'
        });
      } else {
        logger.error('LangSmith error', { error: error.message });
      }
    }
  }
};

// Helper to configure LangSmith environment
export function configureLangSmith() {
  // Set conservative limits to prevent multipart errors
  if (process.env.LANGCHAIN_TRACING_V2 === 'true') {
    // Reduce trace verbosity
    process.env.LANGCHAIN_VERBOSE = 'false';
    
    // Set project name if not set
    if (!process.env.LANGCHAIN_PROJECT) {
      process.env.LANGCHAIN_PROJECT = 'outlet-media-bot';
    }
    
    logger.info('LangSmith tracing configured', {
      project: process.env.LANGCHAIN_PROJECT,
      maxPayloadSize: langsmithConfig.maxPayloadSize
    });
  }
}