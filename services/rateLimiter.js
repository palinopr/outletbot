/**
 * Rate limiting middleware for API protection
 */
import { RateLimitError } from './errors.js';
import { Logger } from './logger.js';
import { config } from './config.js';

const logger = new Logger('rate-limiter');

// In-memory store for rate limiting (use Redis in production)
class RateLimitStore {
  constructor() {
    this.requests = new Map();
    this.cleanupInterval = 60000; // 1 minute
    
    // Periodic cleanup
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }
  
  increment(key, windowMs) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    const timestamps = this.requests.get(key);
    
    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter(ts => ts > windowStart);
    
    // Add current timestamp
    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    
    return validTimestamps.length;
  }
  
  reset(key) {
    this.requests.delete(key);
  }
  
  cleanup() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    
    for (const [key, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(ts => now - ts < maxAge);
      
      if (validTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimestamps);
      }
    }
    
    logger.debug('Rate limit store cleanup completed', {
      entriesRemaining: this.requests.size
    });
  }
}

// Global store instance
const store = new RateLimitStore();

/**
 * Rate limiter configuration
 */
export const RateLimitConfig = {
  // Global rate limit (all requests)
  global: {
    windowMs: 60000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    message: 'Too many requests, please try again later'
  },
  
  // Per-contact rate limit
  perContact: {
    windowMs: 60000, // 1 minute
    max: 10,
    message: 'Too many messages from this contact'
  },
  
  // Per-phone rate limit
  perPhone: {
    windowMs: 300000, // 5 minutes
    max: 20,
    message: 'Too many messages from this phone number'
  },
  
  // Health check rate limit (more permissive)
  health: {
    windowMs: 60000, // 1 minute
    max: 60,
    message: 'Too many health check requests'
  }
};

/**
 * Get client identifier for rate limiting
 */
function getClientId(req) {
  // Try to get from various sources
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         'unknown';
}

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(options = {}) {
  const config = { ...RateLimitConfig.global, ...options };
  
  return async function rateLimiter(req, res, next) {
    try {
      const clientId = getClientId(req);
      const key = `global:${clientId}`;
      
      const count = store.increment(key, config.windowMs);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - count));
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + config.windowMs).toISOString());
      
      if (count > config.max) {
        logger.warn('Rate limit exceeded', {
          clientId,
          count,
          limit: config.max,
          endpoint: req.url
        });
        
        const retryAfter = Math.ceil(config.windowMs / 1000);
        res.setHeader('Retry-After', retryAfter);
        
        throw new RateLimitError(config.max, config.windowMs, retryAfter);
      }
      
      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        return res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
          retryAfter: error.retryAfter,
          timestamp: new Date().toISOString()
        });
      }
      next(error);
    }
  };
}

/**
 * Create contact-specific rate limiter
 */
export function createContactRateLimiter(options = {}) {
  const config = { ...RateLimitConfig.perContact, ...options };
  
  return async function contactRateLimiter(req, res, next) {
    try {
      const contactId = req.body?.contactId || req.validatedBody?.contactId;
      
      if (!contactId) {
        return next();
      }
      
      const key = `contact:${contactId}`;
      const count = store.increment(key, config.windowMs);
      
      if (count > config.max) {
        logger.warn('Contact rate limit exceeded', {
          contactId,
          count,
          limit: config.max
        });
        
        const retryAfter = Math.ceil(config.windowMs / 1000);
        throw new RateLimitError(config.max, config.windowMs, retryAfter);
      }
      
      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        return res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
          retryAfter: error.retryAfter,
          timestamp: new Date().toISOString()
        });
      }
      next(error);
    }
  };
}

/**
 * Create phone-specific rate limiter
 */
export function createPhoneRateLimiter(options = {}) {
  const config = { ...RateLimitConfig.perPhone, ...options };
  
  return async function phoneRateLimiter(req, res, next) {
    try {
      const phone = req.body?.phone || req.validatedBody?.phone;
      
      if (!phone) {
        return next();
      }
      
      // Normalize phone number
      const normalizedPhone = phone.replace(/\D/g, '');
      const key = `phone:${normalizedPhone}`;
      const count = store.increment(key, config.windowMs);
      
      if (count > config.max) {
        logger.warn('Phone rate limit exceeded', {
          phone: normalizedPhone,
          count,
          limit: config.max
        });
        
        const retryAfter = Math.ceil(config.windowMs / 1000);
        throw new RateLimitError(config.max, config.windowMs, retryAfter);
      }
      
      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        return res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
          retryAfter: error.retryAfter,
          timestamp: new Date().toISOString()
        });
      }
      next(error);
    }
  };
}

/**
 * Reset rate limit for a specific key
 */
export function resetRateLimit(type, identifier) {
  const key = `${type}:${identifier}`;
  store.reset(key);
  logger.info('Rate limit reset', { type, identifier });
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(type, identifier) {
  const key = `${type}:${identifier}`;
  const timestamps = store.requests.get(key) || [];
  const config = RateLimitConfig[type] || RateLimitConfig.global;
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const validTimestamps = timestamps.filter(ts => ts > windowStart);
  
  return {
    count: validTimestamps.length,
    limit: config.max,
    remaining: Math.max(0, config.max - validTimestamps.length),
    resetAt: new Date(now + config.windowMs).toISOString(),
    isLimited: validTimestamps.length >= config.max
  };
}