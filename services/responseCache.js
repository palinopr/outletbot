import { Logger } from './logger.js';

const logger = new Logger('responseCache');

// Cached responses for common messages
export const CACHED_RESPONSES = {
  greetings: {
    "hola": "¡Hola! Soy María, tu consultora de ventas de Outlet Media. ¿Podrías decirme tu nombre, por favor?",
    "buenos dias": "¡Buenos días! Soy María de Outlet Media. ¿Cómo te llamas?",
    "buenos días": "¡Buenos días! Soy María de Outlet Media. ¿Cómo te llamas?",
    "buenas tardes": "¡Buenas tardes! Soy María de Outlet Media. ¿Cuál es tu nombre?",
    "buenas noches": "¡Buenas noches! Soy María de Outlet Media. ¿Me podrías compartir tu nombre?",
    "hi": "¡Hola! Soy María, tu consultora de ventas de Outlet Media. ¿Podrías decirme tu nombre, por favor?",
    "hello": "¡Hola! Soy María de Outlet Media. ¿Cómo te llamas?",
    "hey": "¡Hola! Soy María de Outlet Media. ¿Cómo te llamas?",
    "que tal": "¡Hola! Soy María de Outlet Media. ¿Cómo te llamas?",
    "qué tal": "¡Hola! Soy María de Outlet Media. ¿Cómo te llamas?"
  },
  closings: {
    "gracias": "¡De nada! ¿Hay algo más en lo que pueda ayudarte con tu negocio?",
    "thanks": "¡De nada! ¿Hay algo más en lo que pueda ayudarte con tu negocio?",
    "ok": "Perfecto. ¿Tienes alguna pregunta sobre cómo podemos ayudar a tu negocio?",
    "okay": "Perfecto. ¿Tienes alguna pregunta sobre cómo podemos ayudar a tu negocio?",
    "vale": "Excelente. ¿En qué más puedo ayudarte?",
    "adios": "¡Hasta luego! Si necesitas ayuda con tu negocio, aquí estaré. ¡Mucho éxito!",
    "adiós": "¡Hasta luego! Si necesitas ayuda con tu negocio, aquí estaré. ¡Mucho éxito!",
    "bye": "¡Hasta luego! Si necesitas ayuda con tu negocio, aquí estaré. ¡Mucho éxito!",
    "chao": "¡Hasta luego! Si necesitas ayuda con tu negocio, aquí estaré. ¡Mucho éxito!",
    "hasta luego": "¡Hasta pronto! Cuando estés listo para hacer crecer tu negocio, contáctame. ¡Éxito!"
  },
  rejections: {
    "no me interesa": "Entiendo perfectamente. Si cambias de opinión o tienes preguntas sobre marketing digital, aquí estaré. ¡Mucho éxito con tu negocio!",
    "no gracias": "No hay problema. Si en el futuro necesitas ayuda para atraer más clientes, no dudes en contactarme. ¡Éxito!",
    "no thanks": "No hay problema. Si en el futuro necesitas ayuda para atraer más clientes, no dudes en contactarme. ¡Éxito!",
    "ahora no": "Perfecto, entiendo. Cuando sea el momento adecuado para ti, aquí estaré. ¡Mucho éxito!",
    "tal vez despues": "Claro, sin presión. Guarda mi contacto para cuando estés listo. ¡Éxito con tu negocio!",
    "tal vez después": "Claro, sin presión. Guarda mi contacto para cuando estés listo. ¡Éxito con tu negocio!"
  }
};

/**
 * Get cached response for common messages
 * @param {string} message - User message
 * @param {object} context - Current conversation context
 * @returns {string|null} - Cached response or null
 */
export function getCachedResponse(message, context = {}) {
  if (!message || typeof message !== 'string') {
    return null;
  }
  
  const normalizedMsg = message.toLowerCase().trim();
  const { leadInfo = {}, calendarShown = false, appointmentBooked = false } = context;
  
  // Don't use cache if we're in middle of conversation flow
  if (calendarShown || appointmentBooked) {
    logger.debug('Cache skipped - conversation in progress', { calendarShown, appointmentBooked });
    return null;
  }
  
  // Check greetings (only if no name collected yet)
  if (!leadInfo.name && CACHED_RESPONSES.greetings[normalizedMsg]) {
    logger.info('CACHE_HIT: Greeting', { message: normalizedMsg });
    return CACHED_RESPONSES.greetings[normalizedMsg];
  }
  
  // Check closings/thanks (safe at any point)
  if (CACHED_RESPONSES.closings[normalizedMsg]) {
    logger.info('CACHE_HIT: Closing', { message: normalizedMsg });
    return CACHED_RESPONSES.closings[normalizedMsg];
  }
  
  // Check rejections
  if (CACHED_RESPONSES.rejections[normalizedMsg]) {
    logger.info('CACHE_HIT: Rejection', { message: normalizedMsg });
    return CACHED_RESPONSES.rejections[normalizedMsg];
  }
  
  // Special case for "no" - need context
  if (normalizedMsg === "no") {
    // If we just asked a yes/no question, don't cache
    return null;
  }
  
  // Special case for "si" - always needs context
  if (normalizedMsg === "si" || normalizedMsg === "sí") {
    return null; // Let agent handle based on context
  }
  
  logger.debug('CACHE_MISS', { message: normalizedMsg });
  return null;
}

/**
 * Preload cache and validate responses
 */
export function validateCache() {
  let totalResponses = 0;
  
  Object.entries(CACHED_RESPONSES).forEach(([category, responses]) => {
    const count = Object.keys(responses).length;
    totalResponses += count;
    logger.info(`Cache category loaded: ${category}`, { count });
  });
  
  logger.info('Response cache initialized', { 
    totalResponses,
    categories: Object.keys(CACHED_RESPONSES) 
  });
  
  return totalResponses;
}

// Initialize cache on module load
validateCache();