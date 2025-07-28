import { Logger } from './logger.js';
import { GHLService } from './ghlService.js';

const logger = new Logger('calendarCache');

/**
 * Global calendar cache shared across all conversations
 * Refreshes automatically every 15 minutes
 */
class CalendarCache {
  constructor() {
    this.cache = null;
    this.lastUpdate = 0;
    this.TTL = 15 * 60 * 1000; // 15 minutes
    this.refreshInterval = null;
    this.isRefreshing = false;
    this.subscribers = new Set(); // For cache invalidation callbacks
  }

  /**
   * Start automatic refresh interval
   */
  startAutoRefresh(calendarId, ghlService) {
    if (this.refreshInterval) {
      return; // Already running
    }

    this.calendarId = calendarId;
    this.ghlService = ghlService;

    // Initial load
    this.refresh();

    // Set up interval
    this.refreshInterval = setInterval(() => {
      this.refresh();
    }, this.TTL);

    logger.info('Calendar cache auto-refresh started', { 
      ttl: this.TTL,
      calendarId 
    });
  }

  /**
   * Stop auto refresh
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      logger.info('Calendar cache auto-refresh stopped');
    }
  }

  /**
   * Get cached slots or trigger refresh if needed
   */
  async getSlots(startDate, endDate) {
    // Check if cache is valid
    if (this.cache && (Date.now() - this.lastUpdate < this.TTL)) {
      logger.debug('Returning cached calendar slots', {
        age: Math.floor((Date.now() - this.lastUpdate) / 1000) + 's',
        slotCount: this.cache.length
      });
      return this.filterSlotsByDateRange(this.cache, startDate, endDate);
    }

    // Need refresh
    if (!this.isRefreshing) {
      await this.refresh();
    } else {
      // Wait for ongoing refresh
      logger.debug('Waiting for ongoing calendar refresh');
      await this.waitForRefresh();
    }

    return this.filterSlotsByDateRange(this.cache, startDate, endDate);
  }

  /**
   * Force refresh the cache
   */
  async refresh() {
    if (!this.ghlService || !this.calendarId) {
      logger.error('Cannot refresh - missing GHL service or calendar ID');
      return;
    }

    if (this.isRefreshing) {
      logger.debug('Refresh already in progress');
      return;
    }

    this.isRefreshing = true;
    const startTime = Date.now();

    try {
      logger.info('Refreshing calendar cache');
      
      // Fetch next 7 days of slots
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const slots = await this.ghlService.getAvailableSlots(
        this.calendarId,
        start,
        end
      );

      this.cache = slots;
      this.lastUpdate = Date.now();
      
      logger.info('Calendar cache refreshed', {
        slotCount: slots.length,
        duration: Date.now() - startTime + 'ms',
        nextRefresh: new Date(this.lastUpdate + this.TTL).toISOString()
      });

      // Notify subscribers
      this.notifySubscribers();

    } catch (error) {
      logger.error('Failed to refresh calendar cache', {
        error: error.message,
        duration: Date.now() - startTime + 'ms'
      });
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Wait for ongoing refresh to complete
   */
  async waitForRefresh(timeout = 5000) {
    const start = Date.now();
    while (this.isRefreshing && (Date.now() - start < timeout)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Filter slots by date range
   */
  filterSlotsByDateRange(slots, startDate, endDate) {
    if (!slots) return [];
    
    const start = new Date(startDate || Date.now());
    const end = new Date(endDate || Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    return slots.filter(slot => {
      const slotDate = new Date(slot.startTime);
      return slotDate >= start && slotDate <= end;
    });
  }

  /**
   * Subscribe to cache updates
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers of cache update
   */
  notifySubscribers() {
    this.subscribers.forEach(callback => {
      try {
        callback(this.cache);
      } catch (error) {
        logger.error('Subscriber callback error', { error: error.message });
      }
    });
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      hasCache: !!this.cache,
      slotCount: this.cache?.length || 0,
      lastUpdate: this.lastUpdate,
      age: this.lastUpdate ? Date.now() - this.lastUpdate : null,
      isRefreshing: this.isRefreshing,
      ttl: this.TTL,
      autoRefresh: !!this.refreshInterval
    };
  }

  /**
   * Clear cache manually
   */
  clear() {
    this.cache = null;
    this.lastUpdate = 0;
    logger.info('Calendar cache cleared');
  }
}

// Export singleton instance
export const calendarCache = new CalendarCache();

// Helper to initialize cache with GHL service
export function initializeCalendarCache(ghlService, calendarId) {
  calendarCache.startAutoRefresh(calendarId, ghlService);
  return calendarCache;
}