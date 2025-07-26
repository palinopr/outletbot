/**
 * Performance Metrics Tracking
 * Monitors optimization effectiveness
 */

class PerformanceMetrics {
  constructor() {
    this.metrics = {
      conversations: {
        total: 0,
        completed: 0,
        terminated: 0,
        errors: 0
      },
      toolCalls: {
        extractLeadInfo: 0,
        sendGHLMessage: 0,
        updateGHLContact: 0,
        getCalendarSlots: 0,
        bookAppointment: 0,
        parseTimeSelection: 0
      },
      optimizations: {
        circuitBreakerTriggered: 0,
        duplicatesSkipped: 0,
        cacheHits: 0,
        cacheMisses: 0
      },
      costs: {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        estimatedCost: 0
      },
      performance: {
        avgResponseTime: 0,
        avgToolCallsPerConversation: 0,
        avgTokensPerConversation: 0
      }
    };
    
    // Response time tracking
    this.responseTimes = [];
  }
  
  // Track conversation lifecycle
  conversationStarted() {
    this.metrics.conversations.total++;
  }
  
  conversationCompleted() {
    this.metrics.conversations.completed++;
  }
  
  conversationTerminated() {
    this.metrics.conversations.terminated++;
  }
  
  conversationError() {
    this.metrics.conversations.errors++;
  }
  
  // Track tool usage
  toolCalled(toolName) {
    if (this.metrics.toolCalls[toolName] !== undefined) {
      this.metrics.toolCalls[toolName]++;
    }
  }
  
  // Track optimizations
  circuitBreakerTriggered() {
    this.metrics.optimizations.circuitBreakerTriggered++;
  }
  
  duplicateSkipped() {
    this.metrics.optimizations.duplicatesSkipped++;
  }
  
  cacheHit() {
    this.metrics.optimizations.cacheHits++;
  }
  
  cacheMiss() {
    this.metrics.optimizations.cacheMisses++;
  }
  
  // Track costs
  addTokenUsage(promptTokens, completionTokens) {
    this.metrics.costs.promptTokens += promptTokens;
    this.metrics.costs.completionTokens += completionTokens;
    this.metrics.costs.totalTokens += (promptTokens + completionTokens);
    
    // Estimate cost (GPT-4 pricing as of 2024)
    const promptCost = (promptTokens / 1000) * 0.03;
    const completionCost = (completionTokens / 1000) * 0.06;
    this.metrics.costs.estimatedCost += (promptCost + completionCost);
  }
  
  // Track response times
  addResponseTime(ms) {
    this.responseTimes.push(ms);
    // Keep only last 100 for memory efficiency
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
    this.updateAverages();
  }
  
  // Update averages
  updateAverages() {
    // Average response time
    if (this.responseTimes.length > 0) {
      const sum = this.responseTimes.reduce((a, b) => a + b, 0);
      this.metrics.performance.avgResponseTime = Math.round(sum / this.responseTimes.length);
    }
    
    // Average tool calls per conversation
    if (this.metrics.conversations.completed > 0) {
      const totalToolCalls = Object.values(this.metrics.toolCalls).reduce((a, b) => a + b, 0);
      this.metrics.performance.avgToolCallsPerConversation = 
        Math.round(totalToolCalls / this.metrics.conversations.completed * 10) / 10;
    }
    
    // Average tokens per conversation
    if (this.metrics.conversations.completed > 0) {
      this.metrics.performance.avgTokensPerConversation = 
        Math.round(this.metrics.costs.totalTokens / this.metrics.conversations.completed);
    }
  }
  
  // Get summary report
  getSummary() {
    this.updateAverages();
    
    const cacheHitRate = this.metrics.optimizations.cacheHits + this.metrics.optimizations.cacheMisses > 0
      ? Math.round((this.metrics.optimizations.cacheHits / 
          (this.metrics.optimizations.cacheHits + this.metrics.optimizations.cacheMisses)) * 100)
      : 0;
    
    const avgCostPerConversation = this.metrics.conversations.completed > 0
      ? (this.metrics.costs.estimatedCost / this.metrics.conversations.completed).toFixed(2)
      : 0;
    
    return {
      conversations: this.metrics.conversations,
      performance: {
        ...this.metrics.performance,
        avgCostPerConversation: `$${avgCostPerConversation}`,
        cacheHitRate: `${cacheHitRate}%`
      },
      optimizations: this.metrics.optimizations,
      toolUsage: this.metrics.toolCalls,
      totalCost: `$${this.metrics.costs.estimatedCost.toFixed(2)}`
    };
  }
  
  // Reset metrics (for testing)
  reset() {
    this.constructor.call(this);
  }
}

// Export singleton instance
export const performanceMetrics = new PerformanceMetrics();