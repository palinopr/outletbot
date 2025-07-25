const { HumanMessage, AIMessage } = require('@langchain/core/messages');
const redis = require('redis');

class RedisConversationManager {
  constructor(ghlService, redisUrl) {
    this.ghlService = ghlService;
    this.client = redis.createClient({ url: redisUrl });
    this.client.on('error', (err) => console.error('Redis Client Error', err));
    this.connected = false;
  }

  async connect() {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }

  // Get conversation state with Redis caching
  async getConversationState(contactId, conversationId) {
    await this.connect();
    
    try {
      const cacheKey = `conv:${contactId}:${conversationId || 'default'}`;
      
      // Try to get from Redis first
      const cached = await this.client.get(cacheKey);
      if (cached) {
        const state = JSON.parse(cached);
        // Convert messages back to proper format
        state.messages = this.deserializeMessages(state.messages);
        return state;
      }

      // If not in cache, get from GHL
      const state = await this.fetchFromGHL(contactId, conversationId);
      
      // Cache for 15 minutes
      await this.client.setex(
        cacheKey,
        900, // 15 minutes
        JSON.stringify({
          ...state,
          messages: this.serializeMessages(state.messages)
        })
      );

      return state;
    } catch (error) {
      console.error('Error in getConversationState:', error);
      // Fallback to direct GHL fetch
      return await this.fetchFromGHL(contactId, conversationId);
    }
  }

  // Fetch conversation state from GHL
  async fetchFromGHL(contactId, conversationId) {
    try {
      // Get or create conversation
      let conversation;
      if (conversationId) {
        conversation = await this.ghlService.getConversation(conversationId);
      } else {
        conversation = await this.ghlService.getOrCreateConversation(contactId);
        conversationId = conversation.id;
      }

      // Get messages from GHL
      const ghlMessages = await this.ghlService.getConversationMessages(conversationId);
      const messages = this.convertGHLMessages(ghlMessages);
      
      // Get contact details
      const contact = await this.ghlService.findContactByPhone(contactId);
      
      // Extract lead information
      const leadInfo = this.extractLeadInfoFromContact(contact);
      const messageInfo = this.extractInfoFromMessages(messages);
      
      return {
        conversationId,
        leadPhone: contact?.phone,
        ghlContactId: contactId,
        messages,
        messageCount: messages.length,
        ...leadInfo,
        ...messageInfo,
        lastActivity: Date.now()
      };
    } catch (error) {
      console.error('Error fetching from GHL:', error);
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
    
    const sortedMessages = [...ghlMessages].sort((a, b) => 
      new Date(a.dateAdded) - new Date(b.dateAdded)
    );
    
    for (const msg of sortedMessages) {
      const content = msg.body || msg.message || msg.text;
      if (!content) continue;
      
      if (msg.direction === 'inbound' || msg.type === 'inbound') {
        messages.push(new HumanMessage(content));
      } else if (msg.direction === 'outbound' || msg.type === 'outbound') {
        messages.push(new AIMessage(content));
      }
    }
    
    return messages;
  }

  // Extract lead info from GHL contact
  extractLeadInfoFromContact(contact) {
    const info = {
      leadName: null,
      leadEmail: null,
      leadPhone: null,
      ghlTags: [],
      appointmentScheduled: false,
      qualificationStatus: 'in_progress'
    };

    if (!contact) return info;

    info.leadName = contact.firstName || contact.name || null;
    info.leadEmail = contact.email || null;
    info.leadPhone = contact.phone || null;
    
    if (contact.tags && Array.isArray(contact.tags)) {
      info.ghlTags = contact.tags;
      
      // Check qualification status from tags
      if (contact.tags.includes('qualified-lead')) {
        info.qualificationStatus = 'qualified';
      } else if (contact.tags.includes('under-budget')) {
        info.qualificationStatus = 'unqualified';
      }
      
      if (contact.tags.includes('appointment-scheduled') || 
          contact.tags.includes('appointment-booked')) {
        info.appointmentScheduled = true;
      }
    }

    // Check custom fields if available
    if (contact.customFields) {
      if (contact.customFields.budget) {
        info.leadBudget = parseFloat(contact.customFields.budget);
      }
      if (contact.customFields.problem) {
        info.leadProblem = contact.customFields.problem;
      }
      if (contact.customFields.goal) {
        info.leadGoal = contact.customFields.goal;
      }
    }

    return info;
  }

  // Extract information from message history
  extractInfoFromMessages(messages) {
    const info = {
      leadProblem: null,
      leadGoal: null,
      leadBudget: null,
      currentStep: 'greeting'
    };

    if (messages.length === 0) return info;

    // Analyze recent messages for context
    const recentMessages = messages.slice(-10); // Last 10 messages
    const conversationText = recentMessages
      .map(m => m.content)
      .join('\n')
      .toLowerCase();

    // Look for budget mentions
    const budgetPatterns = [
      /\$(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:per\s*month|\/month|monthly)?/i,
      /budget.*?(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
      /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars|usd)/i
    ];

    for (const pattern of budgetPatterns) {
      const match = conversationText.match(pattern);
      if (match) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(amount) && amount > 0) {
          info.leadBudget = amount;
          break;
        }
      }
    }

    // Determine conversation step based on context
    const hasName = conversationText.includes('my name is') || 
                   conversationText.includes("i'm ") ||
                   conversationText.includes('i am ');
    
    const hasProblem = conversationText.includes('problem') || 
                      conversationText.includes('struggling') ||
                      conversationText.includes('issue') ||
                      conversationText.includes('challenge');
    
    const hasGoal = conversationText.includes('goal') || 
                   conversationText.includes('want to') ||
                   conversationText.includes('hope to') ||
                   conversationText.includes('trying to');
    
    const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(conversationText);

    // Set current step
    if (!hasName) {
      info.currentStep = 'getting_name';
    } else if (!hasProblem) {
      info.currentStep = 'getting_problem';
    } else if (!hasGoal) {
      info.currentStep = 'getting_goal';
    } else if (!info.leadBudget) {
      info.currentStep = 'getting_budget';
    } else if (info.leadBudget >= 300 && !hasEmail) {
      info.currentStep = 'getting_email';
    } else if (hasEmail) {
      info.currentStep = 'scheduling';
    }

    return info;
  }

  // Serialize messages for Redis storage
  serializeMessages(messages) {
    return messages.map(msg => ({
      type: msg._getType(),
      content: msg.content
    }));
  }

  // Deserialize messages from Redis
  deserializeMessages(serialized) {
    return serialized.map(msg => {
      if (msg.type === 'human') {
        return new HumanMessage(msg.content);
      } else {
        return new AIMessage(msg.content);
      }
    });
  }

  // Update conversation state in Redis
  async updateConversationState(contactId, conversationId, updates) {
    await this.connect();
    
    const cacheKey = `conv:${contactId}:${conversationId}`;
    
    try {
      // Get current state
      const current = await this.getConversationState(contactId, conversationId);
      
      // Merge updates
      const updated = {
        ...current,
        ...updates,
        lastActivity: Date.now()
      };
      
      // Save to Redis
      await this.client.setex(
        cacheKey,
        900, // 15 minutes
        JSON.stringify({
          ...updated,
          messages: this.serializeMessages(updated.messages)
        })
      );
      
      return updated;
    } catch (error) {
      console.error('Error updating conversation state:', error);
      throw error;
    }
  }

  // Clear cache for a conversation
  async clearCache(contactId, conversationId) {
    await this.connect();
    
    const cacheKey = `conv:${contactId}:${conversationId || 'default'}`;
    await this.client.del(cacheKey);
  }

  // Close Redis connection
  async disconnect() {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }
}

module.exports = RedisConversationManager;