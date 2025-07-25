const { HumanMessage, AIMessage } = require('@langchain/core/messages');

class ConversationManager {
  constructor(ghlService) {
    this.ghlService = ghlService;
    // Keep a small cache for performance (5 minute TTL)
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  // Get conversation state from GHL
  async getConversationState(contactId, conversationId) {
    try {
      // Check cache first
      const cacheKey = `${contactId}-${conversationId}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.state;
      }

      // Get conversation from GHL
      let conversation;
      if (conversationId) {
        conversation = await this.ghlService.getConversation(conversationId);
      } else {
        conversation = await this.ghlService.getOrCreateConversation(contactId);
        conversationId = conversation.id;
      }

      // Get conversation messages from GHL
      const ghlMessages = await this.ghlService.getConversationMessages(conversationId);
      
      // Convert GHL messages to LangChain format
      const messages = this.convertGHLMessages(ghlMessages);
      
      // Extract lead information from messages and contact
      const leadInfo = await this.extractLeadInfo(messages, contactId);
      
      // Build conversation state
      const state = {
        conversationId,
        leadPhone: conversation.contactPhone || leadInfo.phone,
        ghlContactId: contactId,
        messages,
        messageCount: messages.length,
        ...leadInfo,
        lastActivity: Date.now()
      };

      // Cache the state
      this.cache.set(cacheKey, {
        state,
        timestamp: Date.now()
      });

      return state;
    } catch (error) {
      console.error('Error getting conversation state:', error);
      // Return minimal state on error
      return {
        conversationId,
        ghlContactId: contactId,
        messages: [],
        messageCount: 0,
        lastActivity: Date.now()
      };
    }
  }

  // Convert GHL messages to LangChain format
  convertGHLMessages(ghlMessages) {
    const messages = [];
    
    // Sort messages by date (oldest first)
    const sortedMessages = [...ghlMessages].sort((a, b) => 
      new Date(a.dateAdded) - new Date(b.dateAdded)
    );
    
    for (const msg of sortedMessages) {
      if (msg.direction === 'inbound') {
        messages.push(new HumanMessage(msg.body || msg.message));
      } else if (msg.direction === 'outbound') {
        messages.push(new AIMessage(msg.body || msg.message));
      }
    }
    
    return messages;
  }

  // Extract lead information from conversation history
  async extractLeadInfo(messages, contactId) {
    const info = {
      leadName: null,
      leadProblem: null,
      leadGoal: null,
      leadBudget: null,
      leadEmail: null,
      currentStep: 'greeting',
      qualificationStatus: 'in_progress',
      ghlTags: [],
      ghlNotes: [],
      appointmentScheduled: false
    };

    try {
      // Get contact details from GHL
      const contact = await this.ghlService.findContactByPhone(contactId);
      if (contact) {
        info.leadName = contact.firstName || contact.name;
        info.leadEmail = contact.email;
        info.leadPhone = contact.phone;
        
        // Check tags for qualification status
        if (contact.tags) {
          info.ghlTags = contact.tags;
          if (contact.tags.includes('qualified-lead')) {
            info.qualificationStatus = 'qualified';
          }
          if (contact.tags.includes('appointment-scheduled')) {
            info.appointmentScheduled = true;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching contact details:', error);
    }

    // Analyze messages to extract missing information
    const conversationText = messages.map(m => m.content).join('\n');
    
    // Look for budget mentions
    const budgetMatch = conversationText.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:per\s*month|\/month|monthly)?/i);
    if (budgetMatch) {
      info.leadBudget = parseFloat(budgetMatch[1].replace(',', ''));
    }

    // Determine current step based on what we have
    if (!info.leadName) {
      info.currentStep = 'getting_name';
    } else if (!info.leadProblem) {
      info.currentStep = 'getting_problem';
    } else if (!info.leadGoal) {
      info.currentStep = 'getting_goal';
    } else if (!info.leadBudget) {
      info.currentStep = 'getting_budget';
    } else if (info.leadBudget >= 300 && !info.leadEmail) {
      info.currentStep = 'getting_email';
    } else if (info.leadEmail && !info.appointmentScheduled) {
      info.currentStep = 'scheduling';
    } else if (info.appointmentScheduled) {
      info.currentStep = 'confirmed';
    }

    return info;
  }

  // Clear cache for a specific conversation
  clearCache(contactId, conversationId) {
    const cacheKey = `${contactId}-${conversationId}`;
    this.cache.delete(cacheKey);
  }

  // Clear old cache entries
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }
}

module.exports = ConversationManager;