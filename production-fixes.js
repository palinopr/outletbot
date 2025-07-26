// Production fixes for webhook handler timeouts and error handling

export const PRODUCTION_FIXES = {
  // Increase timeouts for production environment
  timeouts: {
    serviceInit: 30000,     // 30s for service initialization (was 10s) - needed for cold starts
    conversation: 20000,    // 20s for conversation fetch (was 15s)
    llm: 30000,            // 30s for LLM calls (was 20s)
    overall: 90000         // 90s overall timeout
  },
  
  // Better error messages
  errorMessages: {
    initialization: 'El sistema está iniciando. Por favor intenta en unos segundos.',
    timeout: 'La respuesta está tardando más de lo esperado. Por favor intenta nuevamente.',
    ghlService: 'Error conectando con el servicio. Por favor contacta soporte.',
    generic: 'Lo siento, hubo un error procesando tu mensaje. Por favor intenta de nuevo.'
  },
  
  // Circuit breaker configuration
  circuitBreaker: {
    threshold: 5,          // Increase threshold (was 3)
    timeout: 30000,        // 30s cooldown (was 60s)
    halfOpenRequests: 2    // Allow 2 test requests in half-open state
  }
};

// Helper to get appropriate timeout based on environment
export function getTimeout(type) {
  const isProd = process.env.NODE_ENV === 'production' || 
                 process.env.LANGCHAIN_ENV === 'production';
  
  if (isProd) {
    return PRODUCTION_FIXES.timeouts[type];
  }
  
  // Development timeouts (faster)
  const devTimeouts = {
    serviceInit: 3000,
    conversation: 5000,
    llm: 10000,
    overall: 30000
  };
  
  return devTimeouts[type] || 5000;
}

// Helper to get appropriate error message
export function getErrorMessage(errorType, error) {
  console.error(`Production error [${errorType}]:`, error?.message || error);
  
  // Log detailed error for debugging
  if (error?.stack) {
    console.error('Stack trace:', error.stack);
  }
  
  // Return user-friendly message
  return PRODUCTION_FIXES.errorMessages[errorType] || 
         PRODUCTION_FIXES.errorMessages.generic;
}