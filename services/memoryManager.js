// Memory management service with TTL and cleanup
import { MemorySaver } from '@langchain/langgraph';
import { Logger } from './logger.js';

const logger = new Logger('MemoryManager');

/**
 * Enhanced MemorySaver with TTL and cleanup
 */
export class ManagedMemorySaver extends MemorySaver {
  constructor(options = {}) {
    super();
    
    this.ttl = options.ttl || 3600000; // 1 hour default
    this.maxEntries = options.maxEntries || 1000;
    this.cleanupInterval = options.cleanupInterval || 300000; // 5 minutes
    
    // Track entries with timestamps
    this.entryTimestamps = new Map();
    
    // Start cleanup interval
    this.startCleanup();
    
    logger.info('ManagedMemorySaver initialized', {
      ttl: this.ttl,
      maxEntries: this.maxEntries,
      cleanupInterval: this.cleanupInterval
    });
  }
  
  async put(writes, config) {
    const result = await super.put(writes, config);
    
    // Track timestamp for this thread
    const threadId = config?.configurable?.thread_id;
    if (threadId) {
      this.entryTimestamps.set(threadId, Date.now());
      
      // Check if we need to evict old entries
      if (this.entryTimestamps.size > this.maxEntries) {
        this.evictOldest();
      }
    }
    
    return result;
  }
  
  async get(config) {
    const threadId = config?.configurable?.thread_id;
    
    // Check if entry has expired
    if (threadId && this.entryTimestamps.has(threadId)) {
      const timestamp = this.entryTimestamps.get(threadId);
      if (Date.now() - timestamp > this.ttl) {
        // Entry expired, remove it
        await this.delete(config);
        this.entryTimestamps.delete(threadId);
        return null;
      }
    }
    
    return super.get(config);
  }
  
  async delete(config) {
    const threadId = config?.configurable?.thread_id;
    if (threadId) {
      this.entryTimestamps.delete(threadId);
    }
    return super.delete(config);
  }
  
  startCleanup() {
    this.cleanupIntervalId = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }
  
  async cleanup() {
    const now = Date.now();
    const expiredThreads = [];
    
    // Find expired entries
    for (const [threadId, timestamp] of this.entryTimestamps.entries()) {
      if (now - timestamp > this.ttl) {
        expiredThreads.push(threadId);
      }
    }
    
    // Remove expired entries
    for (const threadId of expiredThreads) {
      try {
        await this.delete({ configurable: { thread_id: threadId } });
        logger.debug('Cleaned up expired thread', { threadId });
      } catch (error) {
        logger.error('Error cleaning up thread', { 
          threadId, 
          error: error.message 
        });
      }
    }
    
    if (expiredThreads.length > 0) {
      logger.info('Memory cleanup completed', {
        cleaned: expiredThreads.length,
        remaining: this.entryTimestamps.size
      });
      
      // Track cleanup completed
    }
    
    // Log active threads count
    logger.debug('Active threads', { count: this.entryTimestamps.size });
  }
  
  evictOldest() {
    // Sort by timestamp and remove oldest
    const sorted = Array.from(this.entryTimestamps.entries())
      .sort((a, b) => a[1] - b[1]);
    
    const toEvict = sorted.slice(0, Math.floor(this.maxEntries * 0.1)); // Evict 10%
    
    for (const [threadId] of toEvict) {
      this.delete({ configurable: { thread_id: threadId } })
        .catch(error => {
          logger.error('Error evicting thread', { 
            threadId, 
            error: error.message 
          });
        });
    }
    
    logger.info('Evicted oldest entries', { count: toEvict.length });
  }
  
  stop() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      logger.info('ManagedMemorySaver cleanup stopped');
    }
  }
  
  getStats() {
    return {
      activeThreads: this.entryTimestamps.size,
      maxEntries: this.maxEntries,
      ttl: this.ttl,
      oldestEntry: this.entryTimestamps.size > 0 
        ? Math.min(...this.entryTimestamps.values())
        : null
    };
  }
}