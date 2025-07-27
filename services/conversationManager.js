import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { config } from './config.js';
import { Logger } from './logger.js';

export class ConversationManager {
  constructor(ghlService) {
    this.ghlService = ghlService;
    this.logger = new Logger('ConversationManager');
    // Keep a small cache for performance (5 minute TTL)
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    // Configuration for conversation windowing
    this.maxMessagesInWindow = config.maxMessagesInConversation;
    this.enableSummarization = config.features.enableSummarization;
    // Context isolation window - only use messages from last N hours
    this.contextWindowHours = config.contextWindowHours || 2; // Default 2 hours
  }

  // Get conversation state from GHL
  async getConversationState(contactId, conversationId, phone = null) {
    const startTime = Date.now();
    let messages = [];
    let conversation = null;
    
    this.logger.info('🔍 GET CONVERSATION STATE START', {
      contactId,
      conversationId: conversationId || 'null',
      phone: phone || 'null',
      timestamp: new Date().toISOString()
    });
    
    try {
      // Check cache first
      const cacheKey = `${contactId}-${conversationId}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        this.logger.info('✅ CACHE HIT', {
          cacheKey,
          cacheAge: Date.now() - cached.timestamp,
          messageCount: cached.state.messages?.length || 0
        });
        return cached.state;
      }
      
      this.logger.debug('❌ CACHE MISS', {
        cacheKey,
        cacheSize: this.cache.size
      });

      // Get conversation from GHL
      this.logger.info('🔄 FETCHING CONVERSATION FROM GHL', {
        contactId,
        conversationId: conversationId || 'not provided',
        needsCreation: !conversationId || conversationId.startsWith('conv_')
      });
      
      const convStartTime = Date.now();
      if (conversationId && !conversationId.startsWith('conv_')) {
        // Real conversation ID provided
        conversation = await this.ghlService.getConversation(conversationId);
        this.logger.info('✅ CONVERSATION FETCHED', {
          conversationId,
          fetchTime: Date.now() - convStartTime
        });
      } else {
        // Need to find or create conversation
        conversation = await this.ghlService.getOrCreateConversation(contactId, phone);
        conversationId = conversation.id;
        this.logger.info('✅ CONVERSATION CREATED/RETRIEVED', { 
          conversationId,
          isNew: !conversation.dateAdded || (Date.now() - new Date(conversation.dateAdded).getTime() < 1000),
          fetchTime: Date.now() - convStartTime
        });
      }

      // Get conversation messages from GHL
      const msgStartTime = Date.now();
      const allGhlMessages = await this.ghlService.getConversationMessages(conversationId);
      
      // CRITICAL FIX: Only use recent messages to prevent context contamination
      const contextWindowMs = this.contextWindowHours * 60 * 60 * 1000;
      const cutoffTime = new Date(Date.now() - contextWindowMs);
      const ghlMessages = allGhlMessages.filter(msg => {
        const messageTime = new Date(msg.dateAdded);
        return messageTime > cutoffTime;
      });
      
      this.logger.info('✅ MESSAGES FETCHED FROM GHL', {
        totalMessages: allGhlMessages.length,
        recentMessages: ghlMessages.length,
        conversationId,
        fetchTime: Date.now() - msgStartTime,
        inbound: ghlMessages.filter(m => m.direction === 'inbound').length,
        outbound: ghlMessages.filter(m => m.direction === 'outbound').length,
        windowApplied: allGhlMessages.length > ghlMessages.length
      });
      
      // Apply windowing if needed
      let processedMessages = ghlMessages;
      let summaryPrefix = null;
      
      if (ghlMessages.length > this.maxMessagesInWindow && this.enableSummarization) {
        // Generate summary of older messages
        const olderMessages = ghlMessages.slice(0, -this.maxMessagesInWindow);
        const recentMessages = ghlMessages.slice(-this.maxMessagesInWindow);
        
        this.logger.info('📊 MESSAGE WINDOWING NEEDED', {
          totalMessages: ghlMessages.length,
          maxWindow: this.maxMessagesInWindow,
          olderMessages: olderMessages.length,
          recentMessages: recentMessages.length
        });
        
        try {
          const sumStartTime = Date.now();
          summaryPrefix = await this.generateConversationSummary(olderMessages);
          this.logger.info('✅ SUMMARY GENERATED', {
            olderMessageCount: olderMessages.length,
            summaryLength: summaryPrefix.length,
            generationTime: Date.now() - sumStartTime
          });
          processedMessages = recentMessages;
        } catch (error) {
          this.logger.error('❌ SUMMARY GENERATION FAILED', {
            error: error.message,
            usingAllMessages: true
          });
          processedMessages = ghlMessages;
        }
      }
      
      // Convert GHL messages to LangChain format
      messages = this.convertGHLMessages(processedMessages);
      
      // Add summary as first message if generated
      if (summaryPrefix) {
        messages.unshift(new SystemMessage(
          `[Resumen de conversación anterior: ${summaryPrefix}]`
        ));
      }
      
      this.logger.debug('Converted messages to LangChain format', {
        messageCount: messages.length,
        hasSummary: !!summaryPrefix
      });
      
      // Extract lead information from messages and contact
      const leadStartTime = Date.now();
      const leadInfo = await this.extractLeadInfo(messages, contactId);
      this.logger.info('✅ LEAD INFO EXTRACTED', {
        extractionTime: Date.now() - leadStartTime,
        hasName: !!leadInfo.leadName,
        hasProblem: !!leadInfo.leadProblem,
        hasGoal: !!leadInfo.leadGoal,
        hasBudget: !!leadInfo.leadBudget,
        hasEmail: !!leadInfo.leadEmail,
        currentStep: leadInfo.currentStep,
        qualificationStatus: leadInfo.qualificationStatus
      });
      
      // Build conversation state
      const state = {
        conversationId,
        leadPhone: conversation.phone || (leadInfo && leadInfo.phone) || phone,
        ghlContactId: contactId,
        messages,
        messageCount: messages.length,
        ...(leadInfo || {}),
        lastActivity: Date.now()
      };

      // Cache the state
      this.cache.set(cacheKey, {
        state,
        timestamp: Date.now()
      });
      
      this.logger.info('✅ CONVERSATION STATE COMPLETE', {
        totalTime: Date.now() - startTime,
        conversationId,
        messageCount: messages.length,
        cacheKey,
        cached: true
      });

      return state;
    } catch (error) {
      this.logger.error('❌ ERROR GETTING CONVERSATION STATE', {
        error: error.message,
        stack: error.stack,
        contactId,
        conversationId,
        totalTime: Date.now() - startTime
      });
      // Return state with whatever we managed to fetch
      return {
        conversationId: conversationId || 'unknown',
        leadPhone: (conversation && conversation.phone) || phone || 'unknown',
        ghlContactId: contactId,
        messages: messages,
        messageCount: messages.length,
        leadName: null,
        leadProblem: null,
        leadGoal: null,
        leadBudget: null,
        leadEmail: null,
        currentStep: 'greeting',
        qualificationStatus: 'in_progress',
        ghlTags: [],
        ghlNotes: [],
        appointmentScheduled: false,
        lastActivity: Date.now()
      };
    }
  }

  // Convert GHL messages to LangChain format
  convertGHLMessages(ghlMessages) {
    const messages = [];
    
    // Debug logging commented out for performance
    // console.log('Converting GHL messages:', ghlMessages.map(m => ({
    //   direction: m.direction,
    //   body: m.body?.substring(0, 50) + '...',
    //   dateAdded: m.dateAdded
    // })));
    
    // Sort messages by date (oldest first)
    const sortedMessages = [...ghlMessages].sort((a, b) => 
      new Date(a.dateAdded) - new Date(b.dateAdded)
    );
    
    for (const msg of sortedMessages) {
      // Filter out system messages and tool responses
      const messageBody = msg.body || msg.message || '';
      
      // Skip messages that are clearly tool responses or system messages
      if (messageBody.includes('{"success":') || 
          messageBody.includes('{"error":') ||
          messageBody.includes('"timestamp":') ||
          messageBody.includes('"sent":') ||
          messageBody.includes('"updated":') ||
          messageBody.startsWith('{') && messageBody.endsWith('}')) {
        this.logger.debug('Skipping tool response/system message', { 
          preview: messageBody.substring(0, 50) + '...' 
        });
        continue;
      }
      
      if (msg.direction === 'inbound') {
        messages.push(new HumanMessage(messageBody));
      } else if (msg.direction === 'outbound') {
        messages.push(new AIMessage(messageBody));
      }
    }
    
    this.logger.debug('Message conversion complete', {
      total: messages.length,
      human: messages.filter(m => m instanceof HumanMessage).length,
      ai: messages.filter(m => m instanceof AIMessage).length
    });
    
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
      // Get contact details from GHL using contact ID
      this.logger.debug('🔍 Fetching contact details', { contactId });
      const contact = await this.ghlService.getContact(contactId);
      if (contact) {
        info.leadName = contact.firstName || contact.name || contact.contactName;
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
        
        this.logger.debug('✅ Contact details retrieved', {
          hasName: !!info.leadName,
          hasEmail: !!info.leadEmail,
          tagCount: info.ghlTags.length,
          qualificationStatus: info.qualificationStatus
        });
      }
    } catch (error) {
      this.logger.error('❌ Error fetching contact details', {
        contactId,
        error: error.message
      });
      // Continue without contact details - we can still use message history
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
      info.currentStep = 'completed';
    }

    return info;
  }

  // Clear cache for a specific conversation
  clearCache(contactId, conversationId) {
    const cacheKey = `${contactId}-${conversationId}`;
    this.cache.delete(cacheKey);
  }

  // Generate a summary of older messages
  async generateConversationSummary(olderMessages) {
    try {
      const llm = new ChatOpenAI({ 
        model: 'gpt-3.5-turbo', 
        temperature: 0,
        maxTokens: 200
      });
      
      // Convert messages to readable format
      const conversationText = olderMessages.map(msg => {
        const sender = msg.direction === 'inbound' ? 'Cliente' : 'Agente';
        return `${sender}: ${msg.body || msg.message || ''}`;
      }).join('\n');
      
      const prompt = `Resume esta conversación en 2-3 oraciones, enfocándote en:
- Nombre del cliente
- Tipo de negocio
- Problema principal mencionado
- Presupuesto si se mencionó
- Cualquier decisión importante

Conversación:
${conversationText.substring(0, 2000)}...`; // Limit context to avoid token issues
      
      const response = await llm.invoke([
        new SystemMessage('Eres un asistente que resume conversaciones de ventas. Sé conciso y específico.'),
        new HumanMessage(prompt)
      ]);
      
      return response.content;
    } catch (error) {
      this.logger.error('Error generating conversation summary', {
        error: error.message,
        messageCount: olderMessages.length
      });
      // Return a basic summary on error
      return `Conversación previa con ${olderMessages.length} mensajes. Cliente en proceso de calificación.`;
    }
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

export default ConversationManager;