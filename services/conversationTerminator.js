import { Logger } from './logger.js';

const logger = new Logger('conversationTerminator');

/**
 * Detects terminal conversation states to prevent unnecessary agent calls
 * Saves tokens by ending conversations at natural endpoints
 */
export class ConversationTerminator {
  constructor() {
    // Patterns that indicate conversation should end
    this.terminalPatterns = {
      // Appointment booked - most common terminal state
      appointmentBooked: [
        /cita.*confirmada/i,
        /appointment.*booked/i,
        /te esperamos/i,
        /nos vemos el/i,
        /agendada para/i
      ],
      
      // Under budget rejection
      nurtureLead: [
        /tag.*nurture-lead/i,
        /presupuesto.*bajo/i,
        /cuando.*presupuesto.*mayor/i,
        /mucho éxito con tu negocio/i,
        /estamos aquí.*futuro/i
      ],
      
      // User rejection
      notInterested: [
        /no.*interesa/i,
        /no gracias/i,
        /ahora no/i,
        /déjame pensarlo/i,
        /luego te contacto/i
      ],
      
      // Calendar shown - waiting for selection
      calendarShown: [
        /horarios disponibles/i,
        /slots? disponibles/i,
        /elige.*opción/i,
        /selecciona.*horario/i,
        /CALENDAR_SHOWN/
      ],
      
      // Error states
      errorState: [
        /error.*sistema/i,
        /problema.*técnico/i,
        /intenta.*más tarde/i,
        /temporalmente no disponible/i
      ]
    };
    
    // Messages that should trigger immediate termination
    this.terminalResponses = new Set([
      'Mucho éxito con tu negocio. Estamos aquí cuando estés listo.',
      'Gracias por tu interés. ¡Que tengas un excelente día!',
      'Tu cita ha sido confirmada. ¡Nos vemos pronto!',
      'Sistema temporalmente no disponible. Por favor intenta en unos minutos.'
    ]);
    
    this.stats = {
      conversationsTerminated: 0,
      tokensSaved: 0,
      terminationReasons: {}
    };
  }

  /**
   * Check if conversation should terminate
   * @param {Object} state - Current conversation state
   * @param {string} lastAssistantMessage - Last message sent by assistant
   * @returns {Object} { shouldTerminate: boolean, reason: string }
   */
  shouldTerminate(state, lastAssistantMessage = '') {
    // Check state flags first (most reliable)
    if (state.appointmentBooked) {
      this.logTermination('appointmentBooked', 3500);
      return { shouldTerminate: true, reason: 'appointment_booked' };
    }
    
    if (state.maxExtractionReached && !state.allFieldsCollected) {
      this.logTermination('maxExtractionReached', 2000);
      return { shouldTerminate: true, reason: 'max_extraction_reached' };
    }
    
    // Check if this is a terminal response
    if (this.terminalResponses.has(lastAssistantMessage)) {
      this.logTermination('terminalResponse', 3000);
      return { shouldTerminate: true, reason: 'terminal_response' };
    }
    
    // Check message patterns
    for (const [category, patterns] of Object.entries(this.terminalPatterns)) {
      if (patterns.some(pattern => pattern.test(lastAssistantMessage))) {
        this.logTermination(category, 2500);
        return { shouldTerminate: true, reason: category };
      }
    }
    
    // Check for calendar shown state - special handling
    if (state.calendarShown && !state.appointmentBooked) {
      // Don't terminate, but flag as waiting
      return { shouldTerminate: false, reason: 'waiting_for_selection' };
    }
    
    // Check conversation length (safety valve)
    if (state.messages && state.messages.length > 30) {
      this.logTermination('conversationTooLong', 1500);
      return { shouldTerminate: true, reason: 'conversation_too_long' };
    }
    
    return { shouldTerminate: false, reason: null };
  }

  /**
   * Check if user message indicates they want to end
   */
  isUserTermination(userMessage) {
    const terminationPhrases = [
      /^(no|nope|no gracias|no thanks)$/i,
      /no.*interesa/i,
      /déjame.*pensarlo/i,
      /luego.*hablamos/i,
      /adiós|adios|bye|chao/i,
      /cancelar/i,
      /ya no quiero/i
    ];
    
    return terminationPhrases.some(pattern => pattern.test(userMessage.trim()));
  }

  /**
   * Get appropriate terminal message based on reason
   */
  getTerminalMessage(reason, context = {}) {
    const messages = {
      appointment_booked: '¡Perfecto! Tu cita está confirmada. Te enviaremos un recordatorio antes de la reunión. ¡Nos vemos pronto!',
      nurture_lead: 'Entiendo. Cuando tengas un presupuesto de $300+ mensuales, estaremos aquí para ayudarte a crecer. ¡Mucho éxito!',
      not_interested: 'No hay problema. Si cambias de opinión, aquí estaremos. ¡Que tengas un excelente día!',
      max_extraction_reached: 'Gracias por tu tiempo. Si necesitas más información, no dudes en contactarnos.',
      conversation_too_long: 'Parece que hemos cubierto bastante. Si tienes más preguntas, no dudes en escribirnos.',
      user_rejection: 'Entiendo perfectamente. Gracias por tu tiempo. ¡Mucho éxito con tu negocio!'
    };
    
    return messages[reason] || messages.not_interested;
  }

  /**
   * Log termination for stats
   */
  logTermination(reason, tokensSaved) {
    this.stats.conversationsTerminated++;
    this.stats.tokensSaved += tokensSaved;
    this.stats.terminationReasons[reason] = (this.stats.terminationReasons[reason] || 0) + 1;
    
    logger.info('Conversation terminated', {
      reason,
      tokensSaved,
      totalSaved: this.stats.tokensSaved,
      totalTerminated: this.stats.conversationsTerminated
    });
  }

  /**
   * Get termination statistics
   */
  getStats() {
    return {
      ...this.stats,
      avgTokensSavedPerConversation: this.stats.conversationsTerminated > 0
        ? Math.round(this.stats.tokensSaved / this.stats.conversationsTerminated)
        : 0,
      topReasons: Object.entries(this.stats.terminationReasons)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    };
  }

  /**
   * Check if message indicates calendar selection
   */
  isCalendarSelection(message) {
    const selectionPatterns = [
      /^[1-5]$/,
      /opci[óo]n\s*[1-5]/i,
      /la\s+(primera|segunda|tercera|cuarta|quinta)/i,
      /el\s+(lunes|martes|miércoles|jueves|viernes|sábado|domingo)/i,
      /a las \d+/i,
      /mañana/i
    ];
    
    return selectionPatterns.some(pattern => pattern.test(message.trim()));
  }
}

// Export singleton instance
export const conversationTerminator = new ConversationTerminator();