import { Logger } from './logger.js';

const logger = new Logger('stateCache');

/**
 * In-memory state cache for quick access during conversation
 * Prevents redundant state lookups between tool calls
 */
class StateCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.TTL = options.ttl || 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize || 100;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };
  }

  /**
   * Generate cache key from contactId and conversationId
   */
  getCacheKey(contactId, conversationId) {
    return `${contactId}-${conversationId || 'default'}`;
  }

  /**
   * Get state from cache
   */
  get(contactId, conversationId) {
    const key = this.getCacheKey(contactId, conversationId);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      logger.debug('Cache miss', { key, stats: this.stats });
      return null;
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      this.stats.misses++;
      logger.debug('Cache expired', { key, age: Date.now() - entry.timestamp });
      return null;
    }
    
    this.stats.hits++;
    logger.debug('Cache hit', { 
      key, 
      age: Math.floor((Date.now() - entry.timestamp) / 1000) + 's',
      stats: this.stats 
    });
    
    return entry.state;
  }

  /**
   * Set state in cache
   */
  set(contactId, conversationId, state) {
    const key = this.getCacheKey(contactId, conversationId);
    
    // Check size limit
    if (this.cache.size >= this.maxSize) {
      // Evict oldest entry
      const oldestKey = this.findOldestEntry();
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.stats.evictions++;
        logger.debug('Evicted oldest entry', { key: oldestKey });
      }
    }
    
    this.cache.set(key, {
      state: { ...state }, // Clone to prevent mutations
      timestamp: Date.now()
    });
    
    this.stats.sets++;
    logger.debug('State cached', { 
      key, 
      stateKeys: Object.keys(state),
      cacheSize: this.cache.size,
      stats: this.stats 
    });
  }

  /**
   * Update specific fields in cached state
   */
  update(contactId, conversationId, updates) {
    const key = this.getCacheKey(contactId, conversationId);
    const entry = this.cache.get(key);
    
    if (!entry) {
      // No existing entry, create new one
      this.set(contactId, conversationId, updates);
      return;
    }
    
    // Update existing entry
    entry.state = { ...entry.state, ...updates };
    entry.timestamp = Date.now(); // Refresh timestamp
    
    logger.debug('State updated', { 
      key, 
      updatedFields: Object.keys(updates),
      cacheSize: this.cache.size 
    });
  }

  /**
   * Clear specific entry
   */
  clear(contactId, conversationId) {
    const key = this.getCacheKey(contactId, conversationId);
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      logger.debug('Cache entry cleared', { key });
    }
  }

  /**
   * Clear all entries
   */
  clearAll() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cache cleared', { entriesCleared: size });
  }

  /**
   * Find oldest cache entry
   */
  findOldestEntry() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1)
      : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.TTL
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug('Cleaned expired entries', { count: cleaned });
    }
  }
}

// Export singleton instance
export const stateCache = new StateCache({
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 100
});

// Start periodic cleanup
setInterval(() => {
  stateCache.cleanup();
}, 60 * 1000); // Every minute