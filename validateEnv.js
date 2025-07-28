/**
 * Environment validation utility
 * Ensures all required environment variables are present
 */

export function validateEnvironment() {
  const requiredVars = [
    'OPENAI_API_KEY',
    'GHL_API_KEY', 
    'GHL_LOCATION_ID',
    'GHL_CALENDAR_ID'
  ];

  const optionalVars = [
    'LANGSMITH_API_KEY',
    'LANGSMITH_PROJECT',
    'NODE_ENV',
    'LOG_LEVEL',
    'TIMEZONE',
    'MIN_BUDGET',
    'SKIP_ENV_VALIDATION'
  ];

  // Check if validation should be skipped
  if (process.env.SKIP_ENV_VALIDATION === 'true') {
    console.log('⚠️  Environment validation skipped (SKIP_ENV_VALIDATION=true)');
    return process.env;
  }

  const missing = [];
  
  // Check required variables
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Log warning for missing optional variables (but don't fail)
  for (const varName of optionalVars) {
    if (!process.env[varName]) {
      console.log(`⚠️  Optional env var ${varName} not set`);
    }
  }

  // Throw error if required variables are missing
  if (missing.length > 0) {
    const errorMessage = `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please ensure all required variables are set in your .env file or environment.\n' +
      'To skip validation during testing, set SKIP_ENV_VALIDATION=true';
    
    console.error('❌ ' + errorMessage);
    throw new Error(errorMessage);
  }

  console.log('✅ Environment validation passed');
  return process.env;
}