// Validate required environment variables
export function validateEnv() {
  const required = [
    'OPENAI_API_KEY',
    'GHL_API_KEY',
    'GHL_LOCATION_ID',
    'GHL_CALENDAR_ID'
  ];
  
  const missing = [];
  
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n📝 Please create a .env file based on .env.example');
    process.exit(1);
  }
  
  // Validate optional but recommended
  const recommended = [
    'LANGSMITH_API_KEY',
    'LANGSMITH_PROJECT'
  ];
  
  const missingOptional = [];
  
  for (const key of recommended) {
    if (!process.env[key]) {
      missingOptional.push(key);
    }
  }
  
  if (missingOptional.length > 0) {
    console.warn('⚠️  Missing optional environment variables:');
    missingOptional.forEach(key => console.warn(`   - ${key}`));
    console.warn('   (Tracing will be disabled)\n');
  }
  
  console.log('✅ Environment variables validated');
}

