// Message Queue Service for handling concurrent messages
import { Logger } from './logger.js';
import { EventEmitter } from 'events';

const logger = new Logger('messageQueue');

class MessageQueueService extends EventEmitter {
  constructor() {
    super();
    this.queues = new Map(); // contactId -> messages[]
    this.processing = new Map(); // contactId -> boolean
    this.maxQueueSize = 10; // Max messages per contact
    this.messageTimeout = 60000; // 1 minute timeout for old messages
  }

  /**
   * Add a message to the queue
   * @param {string} contactId 
   * @param {Object} messageData 
   * @returns {Object} Queue status
   */
  enqueue(contactId, messageData) {
    if (!this.queues.has(contactId)) {
      this.queues.set(contactId, []);
    }

    const queue = this.queues.get(contactId);
    
    // Check queue size limit
    if (queue.length >= this.maxQueueSize) {
      logger.warn('Queue size limit reached', { contactId, size: queue.length });
      return {
        success: false,
        error: 'Queue full',
        position: -1
      };
    }

    // Add message with metadata
    const queuedMessage = {
      ...messageData,
      timestamp: Date.now(),
      id: `${contactId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    queue.push(queuedMessage);
    this.queues.set(contactId, queue);

    logger.info('Message queued', {
      contactId,
      messageId: queuedMessage.id,
      position: queue.length,
      preview: messageData.message?.substring(0, 50)
    });

    // Emit event for monitoring
    this.emit('messageQueued', { contactId, message: queuedMessage, queueLength: queue.length });

    return {
      success: true,
      position: queue.length,
      messageId: queuedMessage.id
    };
  }

  /**
   * Get next message from queue
   * @param {string} contactId 
   * @returns {Object|null} Next message or null
   */
  dequeue(contactId) {
    const queue = this.queues.get(contactId);
    if (!queue || queue.length === 0) {
      return null;
    }

    // Remove expired messages
    const now = Date.now();
    const validMessages = queue.filter(msg => 
      (now - msg.timestamp) < this.messageTimeout
    );

    if (validMessages.length === 0) {
      this.queues.delete(contactId);
      return null;
    }

    // Get next message
    const nextMessage = validMessages.shift();
    
    // Update queue
    if (validMessages.length > 0) {
      this.queues.set(contactId, validMessages);
    } else {
      this.queues.delete(contactId);
    }

    logger.info('Message dequeued', {
      contactId,
      messageId: nextMessage.id,
      remainingInQueue: validMessages.length
    });

    this.emit('messageDequeued', { contactId, message: nextMessage, queueLength: validMessages.length });

    return nextMessage;
  }

  /**
   * Get all queued messages for a contact (without removing)
   * @param {string} contactId 
   * @returns {Array} Queued messages
   */
  getQueue(contactId) {
    const queue = this.queues.get(contactId) || [];
    const now = Date.now();
    
    // Filter out expired messages
    return queue.filter(msg => (now - msg.timestamp) < this.messageTimeout);
  }

  /**
   * Check if contact has queued messages
   * @param {string} contactId 
   * @returns {boolean}
   */
  hasQueuedMessages(contactId) {
    const queue = this.getQueue(contactId);
    return queue.length > 0;
  }

  /**
   * Clear queue for a contact
   * @param {string} contactId 
   */
  clearQueue(contactId) {
    const hadMessages = this.queues.has(contactId);
    this.queues.delete(contactId);
    
    if (hadMessages) {
      logger.info('Queue cleared', { contactId });
      this.emit('queueCleared', { contactId });
    }
  }

  /**
   * Mark contact as processing/not processing
   * @param {string} contactId 
   * @param {boolean} isProcessing 
   */
  setProcessing(contactId, isProcessing) {
    if (isProcessing) {
      this.processing.set(contactId, true);
    } else {
      this.processing.delete(contactId);
    }
  }

  /**
   * Check if contact is currently being processed
   * @param {string} contactId 
   * @returns {boolean}
   */
  isProcessing(contactId) {
    return this.processing.get(contactId) || false;
  }

  /**
   * Get queue statistics
   * @returns {Object} Queue stats
   */
  getStats() {
    const stats = {
      totalQueues: this.queues.size,
      totalMessages: 0,
      processingCount: this.processing.size,
      queuesBySize: {}
    };

    for (const [contactId, queue] of this.queues) {
      const validQueue = this.getQueue(contactId);
      stats.totalMessages += validQueue.length;
      
      const size = validQueue.length;
      stats.queuesBySize[size] = (stats.queuesBySize[size] || 0) + 1;
    }

    return stats;
  }

  /**
   * Clean up expired messages from all queues
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [contactId, queue] of this.queues) {
      const validMessages = queue.filter(msg => 
        (now - msg.timestamp) < this.messageTimeout
      );

      if (validMessages.length < queue.length) {
        cleaned += queue.length - validMessages.length;
        
        if (validMessages.length > 0) {
          this.queues.set(contactId, validMessages);
        } else {
          this.queues.delete(contactId);
        }
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up expired messages', { count: cleaned });
    }

    return cleaned;
  }
}

// Export singleton instance
export const messageQueue = new MessageQueueService();

// Run cleanup every 5 minutes
setInterval(() => {
  messageQueue.cleanup();
}, 5 * 60 * 1000);