import { Logger } from './logger.js';

const logger = new Logger('toolResponseCompressor');

/**
 * Compress tool responses to save tokens
 * Maintains semantic meaning while reducing verbosity
 */
export class ToolResponseCompressor {
  constructor() {
    this.compressionPatterns = {
      // Extract lead info responses
      'Extracted:': (content) => {
        // Keep only the JSON part
        const match = content.match(/Extracted:\s*({[^}]+})/);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            const fields = Object.keys(data).filter(k => data[k]);
            return fields.length > 0 ? `+${fields.join(',')}` : 'NoInfo';
          } catch (e) {
            return 'ExtractOK';
          }
        }
        return 'ExtractOK';
      },
      
      'No new information': () => 'NoInfo',
      'No extraction needed': () => 'Skip',
      'Max extraction attempts': () => 'MaxAttempts',
      'Message already processed': () => 'Duplicate',
      
      // GHL message responses
      'Message sent successfully': () => 'SentOK',
      'Failed to send message': (content) => {
        const error = content.match(/Error: (.+)/)?.[1] || 'SendFail';
        return `Fail:${error.substring(0, 20)}`;
      },
      
      // Calendar responses
      'Calendar slots formatted': (content) => {
        const count = content.match(/(\d+) slots/)?.[1] || '?';
        return `Cal:${count}slots`;
      },
      'No available slots': () => 'NoSlots',
      
      // Appointment responses
      'Appointment booked successfully': () => 'BookedOK',
      'Failed to book appointment': () => 'BookFail',
      
      // Update contact responses
      'Contact updated with tags': (content) => {
        const tags = content.match(/Tags: \[([^\]]+)\]/)?.[1] || '';
        return `Tag:${tags.split(',').length}`;
      },
      'Contact update failed': () => 'UpdateFail',
      
      // Parse time responses
      'Selected slot index': (content) => {
        const index = content.match(/index (\d+)/)?.[1] || '?';
        return `Slot:${index}`;
      },
      'Could not understand time selection': () => 'ParseFail'
    };
    
    this.stats = {
      original: 0,
      compressed: 0,
      savings: 0
    };
  }

  /**
   * Compress a tool response
   */
  compress(content) {
    if (!content || typeof content !== 'string') {
      return content;
    }
    
    const originalLength = content.length;
    let compressed = content;
    
    // Try each compression pattern
    for (const [pattern, compressor] of Object.entries(this.compressionPatterns)) {
      if (content.includes(pattern)) {
        compressed = typeof compressor === 'function' ? compressor(content) : compressor;
        break;
      }
    }
    
    // If no pattern matched but content is long, truncate
    if (compressed === content && content.length > 100) {
      // Keep first 80 chars
      compressed = content.substring(0, 80) + '...';
    }
    
    // Update stats
    this.stats.original += originalLength;
    this.stats.compressed += compressed.length;
    this.stats.savings += (originalLength - compressed.length);
    
    // Log significant compressions
    if (originalLength > 50 && compressed.length < originalLength * 0.5) {
      logger.debug('Significant compression', {
        original: originalLength,
        compressed: compressed.length,
        ratio: `${Math.round((1 - compressed.length / originalLength) * 100)}%`
      });
    }
    
    return compressed;
  }

  /**
   * Compress tool message format
   */
  compressToolMessage(message) {
    if (message.role !== 'tool') {
      return message;
    }
    
    return {
      ...message,
      content: this.compress(message.content),
      compressed: true
    };
  }

  /**
   * Get compression statistics
   */
  getStats() {
    const ratio = this.stats.original > 0 
      ? (1 - this.stats.compressed / this.stats.original) * 100
      : 0;
    
    return {
      totalOriginal: this.stats.original,
      totalCompressed: this.stats.compressed,
      totalSavings: this.stats.savings,
      compressionRatio: `${ratio.toFixed(1)}%`,
      avgSavingsPerMessage: this.stats.savings > 0 
        ? Math.round(this.stats.savings / (this.stats.original / 100))
        : 0
    };
  }

  /**
   * Decompress for human readability (if needed)
   */
  decompress(compressed) {
    const expansions = {
      'NoInfo': 'No new information extracted',
      'Skip': 'No extraction needed for simple message',
      'MaxAttempts': 'Maximum extraction attempts reached',
      'Duplicate': 'Message already processed',
      'SentOK': 'Message sent successfully',
      'BookedOK': 'Appointment booked successfully',
      'NoSlots': 'No available calendar slots',
      'UpdateFail': 'Failed to update contact',
      'ParseFail': 'Could not understand time selection'
    };
    
    // Check for simple expansions
    if (expansions[compressed]) {
      return expansions[compressed];
    }
    
    // Handle parameterized compressions
    if (compressed.startsWith('+')) {
      const fields = compressed.substring(1).split(',');
      return `Extracted: ${fields.join(', ')}`;
    }
    
    if (compressed.startsWith('Cal:')) {
      const count = compressed.match(/Cal:(\d+)slots/)?.[1];
      return `Calendar slots formatted: ${count} slots available`;
    }
    
    if (compressed.startsWith('Slot:')) {
      const index = compressed.match(/Slot:(\d+)/)?.[1];
      return `Selected slot index ${index}`;
    }
    
    if (compressed.startsWith('Tag:')) {
      const count = compressed.match(/Tag:(\d+)/)?.[1];
      return `Contact updated with ${count} tags`;
    }
    
    if (compressed.startsWith('Fail:')) {
      const error = compressed.substring(5);
      return `Failed: ${error}`;
    }
    
    // Return as-is if no decompression needed
    return compressed;
  }
}

// Export singleton instance
export const toolResponseCompressor = new ToolResponseCompressor();