// Centralized configuration service
import { validateEnvironment } from '../validateEnv.js';

// Validate environment on module load
const env = validateEnvironment();

export const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // API Keys
  openaiApiKey: process.env.OPENAI_API_KEY,
  ghlApiKey: process.env.GHL_API_KEY,
  ghlLocationId: process.env.GHL_LOCATION_ID,
  ghlCalendarId: process.env.GHL_CALENDAR_ID,
  
  // Localization
  timezone: process.env.TIMEZONE || 'America/Chicago',
  language: process.env.LANGUAGE || 'es',
  
  // Business Rules
  minBudget: parseInt(process.env.MIN_BUDGET || '300'),
  slotDuration: parseInt(process.env.SLOT_DURATION || '30'),
  maxMessagesInConversation: parseInt(process.env.MAX_MESSAGES || '15'),
  
  // Timeouts
  conversationTimeout: parseInt(process.env.CONVERSATION_TIMEOUT || '300000'), // 5 minutes
  apiTimeout: parseInt(process.env.API_TIMEOUT || '10000'), // 10 seconds
  
  // Retry Configuration
  maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.RETRY_DELAY || '1000'),
  
  // Calendar Configuration
  calendar: {
    daysAhead: parseInt(process.env.CALENDAR_DAYS_AHEAD || '7'),
    maxSlotsToShow: parseInt(process.env.MAX_SLOTS_TO_SHOW || '5'),
    timeFormat: process.env.TIME_FORMAT || '12' // 12 or 24 hour format
  },
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // LangSmith (optional)
  langsmithApiKey: process.env.LANGSMITH_API_KEY,
  langsmithTracing: process.env.LANGCHAIN_TRACING_V2 === 'true',
  
  // Error Tracking (optional)
  sentryDsn: process.env.SENTRY_DSN,
  
  // Feature Flags
  features: {
    enableSummarization: process.env.ENABLE_SUMMARIZATION !== 'false',
    enableParallelTools: process.env.ENABLE_PARALLEL_TOOLS !== 'false',
    enableCircuitBreaker: process.env.ENABLE_CIRCUIT_BREAKER !== 'false',
    enableDeduplication: process.env.ENABLE_DEDUPLICATION !== 'false',
    useCompressedPrompt: process.env.USE_COMPRESSED_PROMPT === 'true'  // Default false for safety
  },
  
  // Spanish language configuration
  spanish: {
    days: {
      'Monday': 'Lunes',
      'Tuesday': 'Martes',
      'Wednesday': 'Miércoles',
      'Thursday': 'Jueves',
      'Friday': 'Viernes',
      'Saturday': 'Sábado',
      'Sunday': 'Domingo'
    },
    months: {
      'Jan': 'enero',
      'Feb': 'febrero',
      'Mar': 'marzo',
      'Apr': 'abril',
      'May': 'mayo',
      'Jun': 'junio',
      'Jul': 'julio',
      'Aug': 'agosto',
      'Sep': 'septiembre',
      'Oct': 'octubre',
      'Nov': 'noviembre',
      'Dec': 'diciembre'
    }
  }
};

// Helper function to get calendar slot display format
export function formatSlotDisplay(date) {
  const dayName = date.toLocaleString('en-US', { weekday: 'long', timeZone: config.timezone });
  const monthName = date.toLocaleString('en-US', { month: 'short', timeZone: config.timezone });
  const formattedTime = date.toLocaleString('es-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: config.calendar.timeFormat === '12',
    timeZone: config.timezone
  });
  
  const spanishDay = config.spanish.days[dayName];
  const spanishMonth = config.spanish.months[monthName];
  
  return `${spanishDay} ${formattedTime.split(',')[0]} de ${spanishMonth} a las ${formattedTime.split(',')[1].trim()}`;
}

// Export for backward compatibility
export default config;