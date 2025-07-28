import { Logger } from './logger.js';

const logger = new Logger('messageCompressor');

/**
 * Compress conversation history to reduce token usage
 * Keeps recent messages intact, compresses older ones
 */
export class MessageCompressor {
  constructor(options = {}) {
    this.recentMessageCount = options.recentMessageCount || 3;
    this.compressionRatio = options.compressionRatio || 0.3; // Target 30% of original size
  }

  /**
   * Compress conversation history
   * @param {Array} messages - Array of message objects
   * @returns {Array} Compressed messages
   */
  compressHistory(messages) {
    if (!messages || messages.length <= this.recentMessageCount) {
      return messages; // Too few messages to compress
    }

    const startTime = Date.now();
    const originalTokens = this.estimateTokens(messages);

    // Split messages into old and recent
    const cutoff = messages.length - this.recentMessageCount;
    const oldMessages = messages.slice(0, cutoff);
    const recentMessages = messages.slice(cutoff);

    // Compress old messages
    const compressedOld = oldMessages.map((msg, idx) => this.compressMessage(msg, idx));
    
    // Combine compressed and recent
    const result = [...compressedOld, ...recentMessages];
    
    const compressedTokens = this.estimateTokens(result);
    const savings = ((originalTokens - compressedTokens) / originalTokens * 100).toFixed(1);

    logger.debug('Message history compressed', {
      originalCount: messages.length,
      compressedCount: oldMessages.length,
      originalTokens,
      compressedTokens,
      savings: `${savings}%`,
      duration: Date.now() - startTime + 'ms'
    });

    return result;
  }

  /**
   * Compress a single message
   */
  compressMessage(message, index) {
    const content = message.content || '';
    const role = message.role || message._getType?.() || 'unknown';

    // Extract key information based on role
    if (role === 'human') {
      return {
        ...message,
        content: this.extractKeyInfoHuman(content),
        compressed: true
      };
    } else if (role === 'assistant' || role === 'ai') {
      return {
        ...message,
        content: this.extractKeyInfoAssistant(content),
        compressed: true
      };
    }

    // Tool messages - keep tool name and result
    if (role === 'tool') {
      return {
        ...message,
        content: this.extractKeyInfoTool(content),
        compressed: true
      };
    }

    return message;
  }

  /**
   * Extract key info from human messages
   */
  extractKeyInfoHuman(content) {
    // Common patterns to extract
    const patterns = {
      name: /(?:soy|me llamo|mi nombre es)\s+(\w+)/i,
      budget: /\$?(\d+)\s*(?:mensuales|al mes|por mes)?/i,
      problem: /(?:problema|no puedo|necesito|quiero)\s+(.+?)(?:\.|$)/i,
      business: /(?:tengo un?a?|mi)\s+(restaurante|tienda|negocio|salon|clinica)/i,
      email: /[\w.-]+@[\w.-]+\.\w+/i,
      phone: /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/,
      rejection: /(no me interesa|no gracias|ahora no)/i
    };

    const extracted = [];

    // Extract matching patterns
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = content.match(pattern);
      if (match) {
        switch(key) {
          case 'name':
            extracted.push(`Nombre: ${match[1]}`);
            break;
          case 'budget':
            extracted.push(`Presupuesto: $${match[1]}`);
            break;
          case 'problem':
            extracted.push(`Problema: ${match[1].substring(0, 50)}`);
            break;
          case 'business':
            extracted.push(`Negocio: ${match[1]}`);
            break;
          case 'email':
            extracted.push(`Email: ${match[0]}`);
            break;
          case 'rejection':
            extracted.push('Rechazó oferta');
            break;
        }
      }
    }

    // If no patterns found, return shortened version
    if (extracted.length === 0) {
      return content.substring(0, 50) + (content.length > 50 ? '...' : '');
    }

    return extracted.join(', ');
  }

  /**
   * Extract key info from assistant messages
   */
  extractKeyInfoAssistant(content) {
    // Key phrases to preserve
    if (content.includes('calendario') || content.includes('disponibles')) {
      return 'Mostró calendario';
    }
    if (content.includes('presupuesto') || content.includes('budget')) {
      return 'Preguntó presupuesto';
    }
    if (content.includes('problema') || content.includes('desafío')) {
      return 'Preguntó problema';
    }
    if (content.includes('email') || content.includes('correo')) {
      return 'Pidió email';
    }
    if (content.includes('nombre')) {
      return 'Pidió nombre';
    }
    if (content.includes('nurture-lead')) {
      return 'Bajo presupuesto - nurture';
    }

    // Default: first 40 chars
    return content.substring(0, 40) + '...';
  }

  /**
   * Extract key info from tool messages
   */
  extractKeyInfoTool(content) {
    // Tool results
    if (content.includes('Message sent successfully')) {
      return 'Mensaje enviado';
    }
    if (content.includes('Extracted:')) {
      // Extract the JSON part
      const match = content.match(/Extracted:\s*({[^}]+})/);
      if (match) {
        return `Extraído: ${match[1]}`;
      }
    }
    if (content.includes('Contact updated')) {
      return 'Contacto actualizado';
    }
    if (content.includes('appointment booked')) {
      return 'Cita agendada';
    }
    if (content.includes('No new information')) {
      return 'Sin info nueva';
    }

    return content.substring(0, 30) + '...';
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(messages) {
    let total = 0;
    messages.forEach(msg => {
      const content = msg.content || '';
      // Rough estimate: 1 token per 4 characters
      total += Math.ceil(content.length / 4);
    });
    return total;
  }

  /**
   * Create a summary of compressed messages
   */
  createSummary(messages) {
    const compressed = messages.filter(m => m.compressed);
    if (compressed.length === 0) return null;

    const summary = {
      messageCount: compressed.length,
      keyInfo: [],
      timeline: []
    };

    compressed.forEach((msg, idx) => {
      if (msg.content.includes(':')) {
        summary.keyInfo.push(msg.content);
      }
    });

    return summary;
  }
}

// Export singleton instance with default settings
export const messageCompressor = new MessageCompressor({
  recentMessageCount: 3,
  compressionRatio: 0.3
});