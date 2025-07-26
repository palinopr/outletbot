// Production deployment fixes for LangGraph
// This addresses the initialization timeout issues

export const PRODUCTION_CONFIG = {
  // Increase all timeouts for production cloud environment
  timeouts: {
    serviceInit: 30000,      // 30s for cold starts (was 10s)
    conversation: 20000,     // 20s for conversation fetch
    llm: 30000,             // 30s for LLM calls
    ghlApi: 15000,          // 15s for each GHL API call
    overall: 60000          // 60s overall timeout
  },
  
  // Retry configuration for GHL API
  ghlRetry: {
    maxRetries: 3,
    retryDelay: 2000,       // 2s between retries
    backoffMultiplier: 2
  },
  
  // Warm-up configuration
  warmup: {
    enabled: true,
    preloadServices: true,
    testEndpoints: false    // Don't test endpoints during init
  }
};

// Helper to initialize services with better error handling
export async function initializeServicesWithRetry(apiKey, locationId, maxAttempts = 3) {
  const { GHLService } = await import('./services/ghlService.js');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Service initialization attempt ${attempt}/${maxAttempts}`);
      
      const ghlService = new GHLService(apiKey, locationId);
      
      // Don't test the connection during init - just return the service
      // This avoids timeout during cold starts
      return ghlService;
      
    } catch (error) {
      console.error(`Init attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxAttempts) {
        throw new Error(`Service initialization failed after ${maxAttempts} attempts: ${error.message}`);
      }
      
      // Exponential backoff
      const delay = 1000 * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Lazy initialization pattern for production
export class LazyGHLService {
  constructor(apiKey, locationId) {
    this.apiKey = apiKey;
    this.locationId = locationId;
    this.service = null;
    this.initializing = null;
  }
  
  async getService() {
    if (this.service) return this.service;
    
    if (!this.initializing) {
      this.initializing = initializeServicesWithRetry(this.apiKey, this.locationId);
    }
    
    this.service = await this.initializing;
    return this.service;
  }
  
  // Proxy all methods to lazy-load the service
  async sendSMS(...args) {
    const service = await this.getService();
    return service.sendSMS(...args);
  }
  
  async getAvailableSlots(...args) {
    const service = await this.getService();
    return service.getAvailableSlots(...args);
  }
  
  async getConversationMessages(...args) {
    const service = await this.getService();
    return service.getConversationMessages(...args);
  }
  
  // Add other methods as needed...
}