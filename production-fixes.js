// Production utility functions for error handling and timeouts

/**
 * Get timeout value for different operations
 * @param {string} operation - The operation type
 * @returns {number} Timeout in milliseconds
 */
export function getTimeout(operation) {
  const timeouts = {
    serviceInit: 5000,      // 5 seconds for service initialization
    conversation: 10000,    // 10 seconds for conversation fetch
    salesAgent: 30000,      // 30 seconds for sales agent response
    webhook: 15000,         // 15 seconds for webhook processing
    default: 10000          // 10 seconds default
  };
  
  return timeouts[operation] || timeouts.default;
}

/**
 * Get formatted error message
 * @param {Error} error - The error object
 * @returns {string} Formatted error message
 */
export function getErrorMessage(error) {
  if (!error) return 'Unknown error';
  
  // Handle different error types
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.message) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unexpected error occurred';
}

/**
 * Production environment check
 * @returns {boolean} True if in production
 */
export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Safe JSON parse with fallback
 * @param {string} str - JSON string to parse
 * @param {*} fallback - Fallback value if parse fails
 * @returns {*} Parsed object or fallback
 */
export function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch (error) {
    return fallback;
  }
}

/**
 * Retry wrapper for async functions
 * @param {Function} fn - Async function to retry
 * @param {number} retries - Number of retries
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise} Result of the function
 */
export async function retryAsync(fn, retries = 3, delay = 1000) {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}