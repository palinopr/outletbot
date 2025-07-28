/**
 * Production fixes and utilities
 * Contains helper functions for timeout management and error handling
 */

// Timeout configurations for different operations
const TIMEOUTS = {
  serviceInit: 10000,    // 10 seconds for service initialization
  conversation: 5000,    // 5 seconds for conversation fetch
  webhook: 30000,        // 30 seconds for webhook processing
  ghlApi: 10000,         // 10 seconds for GHL API calls
  default: 5000          // 5 seconds default
};

/**
 * Get timeout duration for a specific operation
 * @param {string} operation - The operation name
 * @returns {number} Timeout in milliseconds
 */
export function getTimeout(operation) {
  return TIMEOUTS[operation] || TIMEOUTS.default;
}

/**
 * Extract error message from various error types
 * @param {Error|string|any} error - The error to extract message from
 * @returns {string} The error message
 */
export function getErrorMessage(error) {
  if (!error) return 'Unknown error';
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error instanceof Error) {
    return error.message || error.toString();
  }
  
  if (error.message) {
    return error.message;
  }
  
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}