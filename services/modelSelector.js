import { ChatOpenAI } from "@langchain/openai";
import { Logger } from './logger.js';

const logger = new Logger('modelSelector');

/**
 * Smart model selector to use cheaper models for simple tasks
 */
export class ModelSelector {
  constructor(options = {}) {
    this.models = {
      'gpt-4-turbo-preview': {
        costPer1K: 0.01,
        quality: 10,
        speed: 7,
        instance: null
      },
      'gpt-3.5-turbo': {
        costPer1K: 0.0005,
        quality: 7,
        speed: 9,
        instance: null
      }
    };
    
    this.taskProfiles = {
      // Simple extractions - GPT-3.5 is sufficient
      'extract_name': {
        patterns: [/soy\s+(\w+)/i, /me llamo\s+(\w+)/i, /^[A-Z][a-z]+$/],
        model: 'gpt-3.5-turbo',
        confidence: 0.95
      },
      'extract_number': {
        patterns: [/^\d+$/, /\$?\d+/, /presupuesto.*\d+/i],
        model: 'gpt-3.5-turbo',
        confidence: 0.95
      },
      'parse_time_selection': {
        patterns: [/^[1-5]$/, /opci[oó]n\s*\d/i, /primera|segunda|tercera/i],
        model: 'gpt-3.5-turbo',
        confidence: 0.90
      },
      'simple_response': {
        patterns: [/^(hola|hi|hey|buenos días|gracias|ok|vale)$/i],
        model: 'gpt-3.5-turbo',
        confidence: 0.98
      },
      
      // Complex tasks - need GPT-4
      'complex_extraction': {
        patterns: [],
        model: 'gpt-4-turbo-preview',
        confidence: 0.80
      },
      'qualification_flow': {
        patterns: [],
        model: 'gpt-4-turbo-preview',
        confidence: 0.85
      },
      'calendar_selection': {
        patterns: [],
        model: 'gpt-4-turbo-preview',
        confidence: 0.90
      }
    };
    
    this.stats = {
      modelUsage: {},
      costSavings: 0,
      decisions: []
    };
  }

  /**
   * Get the appropriate model for a task
   * @param {string} taskType - Type of task
   * @param {string} message - User message
   * @param {object} context - Additional context
   * @returns {ChatOpenAI} Model instance
   */
  getModelForTask(taskType, message = '', context = {}) {
    const startTime = Date.now();
    
    // Determine best model
    let selectedModel = 'gpt-4-turbo-preview'; // Default
    let reason = 'default';
    
    // Check if this is a simple task
    if (this.isSimpleTask(taskType, message, context)) {
      selectedModel = 'gpt-3.5-turbo';
      reason = 'simple_task_detected';
    }
    
    // Override for critical tasks
    if (context.critical || context.appointmentBooking) {
      selectedModel = 'gpt-4-turbo-preview';
      reason = 'critical_task_override';
    }
    
    // Get or create model instance
    const model = this.getOrCreateModel(selectedModel);
    
    // Log decision
    this.logDecision({
      taskType,
      messageLength: message.length,
      selectedModel,
      reason,
      duration: Date.now() - startTime
    });
    
    return model;
  }

  /**
   * Check if task is simple enough for GPT-3.5
   */
  isSimpleTask(taskType, message, context) {
    // Check explicit task profiles
    const profile = this.taskProfiles[taskType];
    if (profile && profile.model === 'gpt-3.5-turbo') {
      // Check if message matches expected patterns
      if (profile.patterns.some(pattern => pattern.test(message))) {
        return true;
      }
    }
    
    // General simple message detection
    if (message.length < 20 && /^[a-zA-Z0-9\s,.!?¿¡]+$/.test(message)) {
      return true;
    }
    
    // Simple extraction scenarios
    if (taskType === 'extraction' && this.isSimpleExtraction(message, context)) {
      return true;
    }
    
    // Time parsing
    if (taskType === 'parse_time' && /^\d+$/.test(message.trim())) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if extraction is simple
   */
  isSimpleExtraction(message, context) {
    const simplePatterns = [
      /^[A-Z][a-z]+\s*[A-Z]?[a-z]*$/, // Names
      /^\d+$/, // Just numbers
      /^(si|sí|no|yes|nope)$/i, // Simple confirmations
      /^[\w.-]+@[\w.-]+\.\w+$/, // Email only
      /^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}$/ // Phone only
    ];
    
    return simplePatterns.some(pattern => pattern.test(message.trim()));
  }

  /**
   * Get or create model instance
   */
  getOrCreateModel(modelName) {
    if (!this.models[modelName].instance) {
      this.models[modelName].instance = new ChatOpenAI({
        model: modelName,
        temperature: modelName === 'gpt-3.5-turbo' ? 0 : 0.7,
        timeout: 10000,
        maxRetries: 2
      });
      
      logger.info(`Model instance created: ${modelName}`);
    }
    
    return this.models[modelName].instance;
  }

  /**
   * Log model selection decision
   */
  logDecision(decision) {
    this.stats.decisions.push({
      ...decision,
      timestamp: Date.now()
    });
    
    // Update usage stats
    this.stats.modelUsage[decision.selectedModel] = 
      (this.stats.modelUsage[decision.selectedModel] || 0) + 1;
    
    // Calculate cost savings
    if (decision.selectedModel === 'gpt-3.5-turbo' && decision.reason !== 'default') {
      const gpt4Cost = this.models['gpt-4-turbo-preview'].costPer1K;
      const gpt35Cost = this.models['gpt-3.5-turbo'].costPer1K;
      this.stats.costSavings += (gpt4Cost - gpt35Cost);
    }
    
    // Log periodically
    if (this.stats.decisions.length % 100 === 0) {
      logger.info('Model selection stats', {
        usage: this.stats.modelUsage,
        costSavings: `$${this.stats.costSavings.toFixed(4)}`,
        decisionsCount: this.stats.decisions.length
      });
    }
  }

  /**
   * Get model for specific tools
   */
  getModelForTool(toolName, args = {}) {
    const toolModelMap = {
      'extract_lead_info': (args) => {
        if (this.isSimpleExtraction(args.message || '', {})) {
          return this.getOrCreateModel('gpt-3.5-turbo');
        }
        return this.getOrCreateModel('gpt-4-turbo-preview');
      },
      'parse_time_selection': () => {
        return this.getOrCreateModel('gpt-3.5-turbo');
      },
      'send_ghl_message': () => {
        // Always use GPT-4 for customer-facing messages
        return this.getOrCreateModel('gpt-4-turbo-preview');
      }
    };
    
    const selector = toolModelMap[toolName];
    if (selector) {
      return selector(args);
    }
    
    // Default to GPT-4
    return this.getOrCreateModel('gpt-4-turbo-preview');
  }

  /**
   * Get usage statistics
   */
  getStats() {
    const totalDecisions = this.stats.decisions.length;
    const gpt35Usage = this.stats.modelUsage['gpt-3.5-turbo'] || 0;
    const savingsPercentage = totalDecisions > 0 
      ? (gpt35Usage / totalDecisions * 100).toFixed(1)
      : 0;
    
    return {
      totalDecisions,
      modelUsage: this.stats.modelUsage,
      costSavings: `$${this.stats.costSavings.toFixed(4)}`,
      gpt35UsagePercentage: `${savingsPercentage}%`,
      recentDecisions: this.stats.decisions.slice(-10)
    };
  }
}

// Export singleton instance
export const modelSelector = new ModelSelector();