// UUID Interceptor to fix any invalid UUIDs before they reach LangSmith
import crypto from 'crypto';

// Store original methods
const originalStringify = JSON.stringify;
const originalFetch = global.fetch;

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// List of fields that should contain UUIDs
const UUID_FIELDS = ['id', 'runId', 'run_id', 'traceId', 'trace_id', 'parent_run_id', 'parentRunId'];

/**
 * Validate and fix UUID values in an object
 */
function fixUUIDs(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => fixUUIDs(item));
  }
  
  // Handle objects
  const fixed = {};
  for (const [key, value] of Object.entries(obj)) {
    if (UUID_FIELDS.includes(key) && typeof value === 'string') {
      // Check if it's a valid UUID
      if (!UUID_REGEX.test(value)) {
        // Replace invalid UUIDs with valid ones
        if (value === 'no-trace-id' || value === 'undefined' || value === 'null' || !value) {
          fixed[key] = crypto.randomUUID();
          console.warn(`Fixed invalid UUID in field '${key}': ${value} -> ${fixed[key]}`);
        } else {
          fixed[key] = value; // Keep other values as-is
        }
      } else {
        fixed[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      fixed[key] = fixUUIDs(value);
    } else {
      fixed[key] = value;
    }
  }
  
  return fixed;
}

/**
 * Intercept and fix UUIDs in LangSmith requests
 */
export function interceptLangSmithRequests() {
  // Only intercept if LangSmith tracing is enabled
  if (process.env.LANGCHAIN_TRACING_V2 !== 'true') {
    return;
  }
  
  // Intercept fetch calls to LangSmith
  global.fetch = async function(url, options) {
    // Check if this is a LangSmith request
    if (typeof url === 'string' && url.includes('langsmith') && options?.body) {
      try {
        // Parse and fix the body
        let body = options.body;
        if (typeof body === 'string') {
          const parsed = JSON.parse(body);
          const fixed = fixUUIDs(parsed);
          options.body = JSON.stringify(fixed);
        }
      } catch (error) {
        // If parsing fails, continue with original body
        console.warn('Failed to intercept LangSmith request:', error.message);
      }
    }
    
    // Call original fetch
    return originalFetch.call(this, url, options);
  };
  
  console.log('UUID interceptor enabled for LangSmith requests');
}

// Auto-enable if imported
interceptLangSmithRequests();