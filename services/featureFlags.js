/**
 * Feature flags system for gradual rollout and A/B testing
 */
import { Logger } from './logger.js';
import { config } from './config.js';

const logger = new Logger('feature-flags');

/**
 * Feature flag definitions with default values
 */
const FEATURE_FLAGS = {
  // Core features
  USE_MEMORY_SAVER: {
    name: 'USE_MEMORY_SAVER',
    description: 'Enable LangGraph MemorySaver for conversation persistence',
    defaultValue: true,
    rolloutPercentage: 100
  },
  
  PARALLEL_TOOL_EXECUTION: {
    name: 'PARALLEL_TOOL_EXECUTION',
    description: 'Execute send_message and update_contact tools in parallel',
    defaultValue: true,
    rolloutPercentage: 100
  },
  
  CONVERSATION_WINDOWING: {
    name: 'CONVERSATION_WINDOWING',
    description: 'Limit conversation history to last 15 messages',
    defaultValue: true,
    rolloutPercentage: 100
  },
  
  CONVERSATION_SUMMARIZATION: {
    name: 'CONVERSATION_SUMMARIZATION',
    description: 'Summarize long conversations beyond window',
    defaultValue: true,
    rolloutPercentage: 100
  },
  
  // Experimental features
  RESPONSE_STREAMING: {
    name: 'RESPONSE_STREAMING',
    description: 'Enable response streaming for large conversations',
    defaultValue: false,
    rolloutPercentage: 0
  },
  
  ADVANCED_LEAD_SCORING: {
    name: 'ADVANCED_LEAD_SCORING',
    description: 'Use advanced ML model for lead scoring',
    defaultValue: false,
    rolloutPercentage: 20
  },
  
  AUTO_FOLLOWUP: {
    name: 'AUTO_FOLLOWUP',
    description: 'Automatically follow up with unresponsive leads',
    defaultValue: false,
    rolloutPercentage: 10
  },
  
  // Performance features
  CONNECTION_POOLING: {
    name: 'CONNECTION_POOLING',
    description: 'Use connection pooling for API clients',
    defaultValue: true,
    rolloutPercentage: 100
  },
  
  AGGRESSIVE_CACHING: {
    name: 'AGGRESSIVE_CACHING',
    description: 'Enable aggressive caching for API responses',
    defaultValue: false,
    rolloutPercentage: 50
  },
  
  // Safety features
  CIRCUIT_BREAKER: {
    name: 'CIRCUIT_BREAKER',
    description: 'Enable circuit breaker for external APIs',
    defaultValue: true,
    rolloutPercentage: 100
  },
  
  RATE_LIMITING: {
    name: 'RATE_LIMITING',
    description: 'Enable rate limiting middleware',
    defaultValue: true,
    rolloutPercentage: 100
  },
  
  // Debug features
  VERBOSE_LOGGING: {
    name: 'VERBOSE_LOGGING',
    description: 'Enable verbose debug logging',
    defaultValue: false,
    rolloutPercentage: 0
  },
  
  TRACE_REQUESTS: {
    name: 'TRACE_REQUESTS',
    description: 'Add detailed request tracing',
    defaultValue: false,
    rolloutPercentage: 5
  }
};

/**
 * Feature flags manager
 */
class FeatureFlagsManager {
  constructor() {
    this.flags = { ...FEATURE_FLAGS };
    this.overrides = {};
    
    // Load overrides from environment
    this.loadEnvironmentOverrides();
    
    // Log active feature flags
    this.logActiveFlags();
  }
  
  /**
   * Load feature flag overrides from environment variables
   */
  loadEnvironmentOverrides() {
    for (const key in this.flags) {
      const envKey = `FEATURE_${key}`;
      const envValue = process.env[envKey];
      
      if (envValue !== undefined) {
        const value = envValue.toLowerCase() === 'true';
        this.overrides[key] = value;
        logger.info(`Feature flag override from env`, {
          flag: key,
          value
        });
      }
    }
  }
  
  /**
   * Log all active feature flags
   */
  logActiveFlags() {
    const activeFlags = {};
    
    for (const key in this.flags) {
      if (this.isEnabled(key)) {
        activeFlags[key] = true;
      }
    }
    
    logger.info('Active feature flags', activeFlags);
  }
  
  /**
   * Check if a feature flag is enabled
   */
  isEnabled(flagName, context = {}) {
    // Check if flag exists
    if (!this.flags[flagName]) {
      logger.warn('Unknown feature flag requested', { flagName });
      return false;
    }
    
    // Check for override
    if (this.overrides[flagName] !== undefined) {
      return this.overrides[flagName];
    }
    
    const flag = this.flags[flagName];
    
    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const hash = this.hashContext(context);
      const bucket = hash % 100;
      return bucket < flag.rolloutPercentage;
    }
    
    return flag.defaultValue;
  }
  
  /**
   * Check if a feature is enabled for a specific user/contact
   */
  isEnabledForUser(flagName, userId) {
    return this.isEnabled(flagName, { userId });
  }
  
  /**
   * Check if a feature is enabled for a specific contact
   */
  isEnabledForContact(flagName, contactId) {
    return this.isEnabled(flagName, { contactId });
  }
  
  /**
   * Hash context for consistent bucketing
   */
  hashContext(context) {
    const str = JSON.stringify(context);
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash);
  }
  
  /**
   * Set a feature flag override (for testing)
   */
  setOverride(flagName, value) {
    this.overrides[flagName] = value;
    logger.info('Feature flag override set', {
      flag: flagName,
      value
    });
  }
  
  /**
   * Clear all overrides
   */
  clearOverrides() {
    this.overrides = {};
    this.loadEnvironmentOverrides();
  }
  
  /**
   * Get all feature flags and their current states
   */
  getAllFlags(context = {}) {
    const result = {};
    
    for (const key in this.flags) {
      result[key] = {
        ...this.flags[key],
        enabled: this.isEnabled(key, context)
      };
    }
    
    return result;
  }
  
  /**
   * Get feature flag metadata
   */
  getFlagMetadata(flagName) {
    return this.flags[flagName] || null;
  }
  
  /**
   * Express middleware for feature flags
   */
  middleware() {
    return (req, res, next) => {
      // Add feature flags to request context
      req.features = {
        isEnabled: (flag) => this.isEnabled(flag, {
          userId: req.user?.id,
          contactId: req.body?.contactId || req.params?.contactId,
          ip: req.ip
        }),
        getAllFlags: () => this.getAllFlags({
          userId: req.user?.id,
          contactId: req.body?.contactId || req.params?.contactId,
          ip: req.ip
        })
      };
      
      next();
    };
  }
}

// Singleton instance
export const featureFlags = new FeatureFlagsManager();

// Export flag names for easy reference
export const FLAGS = Object.keys(FEATURE_FLAGS).reduce((acc, key) => {
  acc[key] = key;
  return acc;
}, {});

// Helper functions
export function isFeatureEnabled(flagName, context) {
  return featureFlags.isEnabled(flagName, context);
}

export function withFeature(flagName, enabledFn, disabledFn = () => {}) {
  return (context) => {
    if (featureFlags.isEnabled(flagName, context)) {
      return enabledFn(context);
    }
    return disabledFn(context);
  };
}

// Export middleware
export const featureFlagsMiddleware = () => featureFlags.middleware();

export default featureFlags;