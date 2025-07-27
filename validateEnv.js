// Environment variable validation
export function validateEnvironment() {
  // Skip validation if explicitly disabled (for testing)
  if (process.env.SKIP_ENV_VALIDATION === 'true') {
    return process.env;
  }
  
  const requiredEnvVars = [
    'OPENAI_API_KEY',
    'GHL_API_KEY',
    'GHL_LOCATION_ID',
    'GHL_CALENDAR_ID'
  ];

  const missingVars = [];
  
  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      missingVars.push(envVar);
    }
  });

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`  - ${varName}`);
    });
    console.error('\nPlease set these variables in your .env file or environment.');
    process.exit(1);
  }

  // Optional environment variables with defaults
  const optionalVars = {
    TIMEZONE: process.env.TIMEZONE || 'America/Chicago',
    LANGUAGE: process.env.LANGUAGE || 'es',
    SLOT_DURATION: process.env.SLOT_DURATION || '30',
    MIN_BUDGET: process.env.MIN_BUDGET || '300',
    NODE_ENV: process.env.NODE_ENV || 'development'
  };

  console.log('✅ Environment validation passed');
  console.log('📋 Configuration:');
  console.log(`  - Timezone: ${optionalVars.TIMEZONE}`);
  console.log(`  - Language: ${optionalVars.LANGUAGE}`);
  console.log(`  - Slot Duration: ${optionalVars.SLOT_DURATION} minutes`);
  console.log(`  - Minimum Budget: $${optionalVars.MIN_BUDGET}`);
  console.log(`  - Environment: ${optionalVars.NODE_ENV}`);

  return {
    ...optionalVars,
    ...process.env
  };
}

// Export configuration
export const config = {
  timezone: process.env.TIMEZONE || 'America/Chicago',
  language: process.env.LANGUAGE || 'es',
  slotDuration: parseInt(process.env.SLOT_DURATION || '30'),
  minBudget: parseInt(process.env.MIN_BUDGET || '300'),
  isProduction: process.env.NODE_ENV === 'production'
};