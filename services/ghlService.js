import axios from 'axios';
import http from 'http';
import https from 'https';
import { config } from './config.js';
import { Logger } from './logger.js';
import { metrics } from './monitoring.js';

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: config.maxRetries,
  retryDelay: config.retryDelay,
  retryMultiplier: 2, // exponential backoff
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ENOTFOUND'],
  retryableStatusCodes: [408, 429, 500, 502, 503, 504]
};

// Circuit breaker configuration
const CIRCUIT_BREAKER = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenRequests: 3,
  enabled: config.features.enableCircuitBreaker
};

// Connection pooling configuration
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,          // Max concurrent connections
  maxFreeSockets: 10,      // Max idle connections
  timeout: 60000,          // Socket timeout
  scheduling: 'lifo'       // Last-in-first-out for better connection reuse
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  scheduling: 'lifo',
  rejectUnauthorized: true // SSL certificate validation
});

export class GHLService {
  constructor(apiKey, locationId) {
    this.apiKey = apiKey;
    this.locationId = locationId;
    this.baseURL = 'https://services.leadconnectorhq.com';
    this.logger = new Logger('GHLService');
    
    // Initialize circuit breaker state
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: null,
      state: 'closed', // closed, open, half-open
      halfOpenRequests: 0
    };
    
    // Queue for failed messages to retry later
    this.retryQueue = [];
    
    // Create axios instance with default config and connection pooling
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: config.apiTimeout,
      headers: this.getHeaders(),
      httpAgent: httpAgent,
      httpsAgent: httpsAgent,
      maxRedirects: 5,
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });
    
    // Add request interceptor for circuit breaker
    this.client.interceptors.request.use(
      (config) => this.circuitBreakerInterceptor(config),
      (error) => Promise.reject(error)
    );
    
    // Add response interceptor for retry logic
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => this.retryInterceptor(error)
    );
  }

  // Helper to add minutes to a time string
  addMinutesToTime(timeString, minutes) {
    const date = new Date(timeString);
    date.setMinutes(date.getMinutes() + minutes);
    return date.toISOString();
  }

  // Get headers for GHL API requests
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28' // Required by GHL API
    };
  }
  
  // Circuit breaker interceptor
  circuitBreakerInterceptor(config) {
    const { state, failures, lastFailureTime } = this.circuitBreaker;
    
    // Check if circuit is open
    if (state === 'open') {
      const timeSinceLastFailure = Date.now() - lastFailureTime;
      
      // Check if we should move to half-open
      if (timeSinceLastFailure > CIRCUIT_BREAKER.resetTimeout) {
        this.circuitBreaker.state = 'half-open';
        this.circuitBreaker.halfOpenRequests = 0;
      } else {
        // Circuit is still open, reject immediately
        return Promise.reject(new Error('Circuit breaker is OPEN - GHL API is temporarily unavailable'));
      }
    }
    
    // Check half-open state
    if (state === 'half-open' && this.circuitBreaker.halfOpenRequests >= CIRCUIT_BREAKER.halfOpenRequests) {
      return Promise.reject(new Error('Circuit breaker is HALF-OPEN - limited requests allowed'));
    }
    
    if (state === 'half-open') {
      this.circuitBreaker.halfOpenRequests++;
    }
    
    return config;
  }
  
  // Retry interceptor with exponential backoff
  async retryInterceptor(error) {
    const config = error.config;
    
    // Initialize retry count
    if (!config._retryCount) {
      config._retryCount = 0;
    }
    
    // Check if we should retry
    const shouldRetry = this.shouldRetry(error, config._retryCount);
    
    if (!shouldRetry) {
      // Update circuit breaker on failure
      this.updateCircuitBreaker(false);
      throw error;
    }
    
    // Calculate delay with exponential backoff
    const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.retryMultiplier, config._retryCount);
    config._retryCount++;
    
    this.logger.info('Retrying GHL API request', {
      attempt: config._retryCount,
      maxRetries: RETRY_CONFIG.maxRetries,
      delay
    });
    
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Retry the request
    return this.client.request(config);
  }
  
  // Determine if request should be retried
  shouldRetry(error, retryCount) {
    if (retryCount >= RETRY_CONFIG.maxRetries) {
      return false;
    }
    
    // Check for retryable error codes
    if (error.code && RETRY_CONFIG.retryableErrors.includes(error.code)) {
      return true;
    }
    
    // Check for retryable status codes
    if (error.response && RETRY_CONFIG.retryableStatusCodes.includes(error.response.status)) {
      return true;
    }
    
    // Don't retry on client errors (4xx) except specific ones
    if (error.response && error.response.status >= 400 && error.response.status < 500) {
      return error.response.status === 408 || error.response.status === 429;
    }
    
    return false;
  }
  
  // Update circuit breaker state
  updateCircuitBreaker(success) {
    if (success) {
      // Reset on success
      if (this.circuitBreaker.state === 'half-open') {
        this.logger.info('Circuit breaker state change: HALF-OPEN -> CLOSED');
        this.circuitBreaker.state = 'closed';
      }
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.lastFailureTime = null;
    } else {
      // Increment failures
      this.circuitBreaker.failures++;
      this.circuitBreaker.lastFailureTime = Date.now();
      
      // Check if we should open the circuit
      if (this.circuitBreaker.failures >= CIRCUIT_BREAKER.failureThreshold) {
        this.logger.warn('Circuit breaker state change: -> OPEN', {
          failures: this.circuitBreaker.failures,
          threshold: CIRCUIT_BREAKER.failureThreshold
        });
        this.circuitBreaker.state = 'open';
      }
    }
  }
  
  // Queue message for retry
  async queueForRetry(data) {
    this.retryQueue.push({
      ...data,
      timestamp: Date.now(),
      attempts: 0
    });
    
    // Process retry queue asynchronously
    setTimeout(() => this.processRetryQueue(), 30000); // Try again in 30 seconds
  }
  
  // Process queued messages
  async processRetryQueue() {
    if (this.retryQueue.length === 0 || this.circuitBreaker.state === 'open') {
      return;
    }
    
    const batch = this.retryQueue.splice(0, 5); // Process up to 5 at a time
    
    for (const item of batch) {
      try {
        if (item.type === 'sms') {
          await this.sendSMS(item.contactId, item.message);
        } else if (item.type === 'tag') {
          await this.addTags(item.contactId, item.tags);
        } else if (item.type === 'note') {
          await this.addNote(item.contactId, item.note);
        }
      } catch (error) {
        // Re-queue if still failing and under max attempts
        if (item.attempts < 3) {
          item.attempts++;
          this.retryQueue.push(item);
        } else {
          this.logger.error('Failed to process queued item after max attempts', {
            item,
            attempts: item.attempts
          });
        }
      }
    }
  }
  
  // Wrapper for all API requests with monitoring
  async makeRequest(method, url, options = {}) {
    const startTime = Date.now();
    const endpoint = `${method.toUpperCase()} ${url}`;
    
    try {
      const response = await this.client.request({
        method,
        url,
        ...options
      });
      
      // Record successful request
      const latency = Date.now() - startTime;
      metrics.recordGhlApiCall(endpoint, method, true, latency);
      
      // Update circuit breaker on success
      this.updateCircuitBreaker(true);
      
      return response;
    } catch (error) {
      // Record failed request
      const latency = Date.now() - startTime;
      metrics.recordGhlApiCall(endpoint, method, false, latency);
      
      // Log error details
      this.logger.error('GHL API request failed', {
        endpoint,
        method,
        error: error.message,
        status: error.response?.status,
        latency
      });
      
      throw error;
    }
  }

  // Create or update contact
  async createOrUpdateContact(phoneNumber, data) {
    try {
      // First, try to find existing contact
      const existingContact = await this.findContactByPhone(phoneNumber);
      
      if (existingContact) {
        // Update existing contact
        return await this.updateContact(existingContact.id, data);
      } else {
        // Create new contact
        return await this.createContact({ ...data, phone: phoneNumber });
      }
    } catch (error) {
      this.logger.error('Error creating/updating contact', {
        error: error.message,
        phoneNumber
      });
      throw error;
    }
  }

  // Find contact by phone number
  async findContactByPhone(phoneNumber) {
    try {
      const response = await this.client.get(
        `/contacts/search/duplicate`,
        {
          params: {
            locationId: this.locationId,
            phone: phoneNumber
          }
        }
      );
      return response.data.contact;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // Create new contact
  async createContact(data) {
    try {
      const response = await this.client.post(
        `/contacts`,
        {
          locationId: this.locationId,
          ...data
        },
        { headers: this.getHeaders() }
      );
      return response.data.contact;
    } catch (error) {
      this.logger.error('Error creating contact', {
        error: error.message,
        responseData: error.response?.data
      });
      throw error;
    }
  }

  // Update contact
  async updateContact(contactId, data) {
    try {
      // If custom field data is provided, format it properly
      if (data.customFields) {
        const customFieldData = [];
        
        // Map our field names to GHL custom field IDs
        const fieldMapping = {
          goal: 'r7jFiJBYHiEllsGn7jZC',
          budget: '4Qe8P25JRLW0IcZc5iOs',
          businessType: 'HtoheVc48qvAfvRUKhfG',
          urgencyLevel: 'dXasgCZFgqd62psjw7nd',
          preferredDay: 'D1aD9KUDNm5Lp4Kz8yAD',
          preferredTime: 'M70lUtadchW4f2pJGDJ5',
          verifiedName: 'TjB0I5iNfVwx3zyxZ9sW',
          problem: 'r7jFiJBYHiEllsGn7jZC' // Map problem to goal field
        };
        
        // Convert to GHL format
        Object.entries(data.customFields).forEach(([key, value]) => {
          if (fieldMapping[key] && value !== null && value !== undefined) {
            customFieldData.push({
              id: fieldMapping[key],
              value: String(value)
            });
          }
        });
        
        // Replace customFields with properly formatted array
        data.customFields = customFieldData;
      }
      
      const response = await this.client.put(
        `/contacts/${contactId}`,
        data
      );
      return response.data.contact;
    } catch (error) {
      this.logger.error('Error updating contact', {
        error: error.message,
        contactId,
        responseData: error.response?.data
      });
      throw error;
    }
  }

  // Get contact by ID
  async getContact(contactId) {
    try {
      const response = await this.client.get(
        `/contacts/${contactId}`
      );
      return response.data.contact;
    } catch (error) {
      this.logger.error('Error getting contact', {
        error: error.message,
        contactId,
        responseData: error.response?.data
      });
      throw error;
    }
  }

  // Add tags to contact
  async addTags(contactId, tags) {
    try {
      const response = await this.client.post(
        `/contacts/${contactId}/tags`,
        { tags }
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error adding tags', {
        error: error.message,
        contactId,
        tags,
        responseData: error.response?.data
      });
      throw error;
    }
  }

  // Add note to contact
  async addNote(contactId, note) {
    try {
      const response = await this.client.post(
        `/contacts/${contactId}/notes`,
        { 
          body: note,
          userId: this.locationId // Using location ID as fallback
        }
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error adding note', {
        error: error.message,
        contactId,
        responseData: error.response?.data
      });
      throw error;
    }
  }

  // Get available calendar slots
  async getAvailableSlots(calendarId, startDate, endDate) {
    try {
      // Convert dates to Unix timestamps (milliseconds)
      const startTimestamp = new Date(startDate).getTime();
      const endTimestamp = new Date(endDate).getTime();
      
      // Try v2 API endpoint structure
      const response = await this.client.get(
        `/calendars/${calendarId}/free-slots`,
        {
          params: {
            startDate: startTimestamp,
            endDate: endTimestamp,
            timezone: 'America/Chicago' // Texas Central Time
          }
        }
      );
      // Handle GHL's date-grouped format
      const data = response.data;
      const allSlots = [];
      
      // If data has date keys (like "2025-07-29"), flatten all slots
      for (const dateKey in data) {
        if (data[dateKey] && data[dateKey].slots && Array.isArray(data[dateKey].slots)) {
          data[dateKey].slots.forEach(slotTime => {
            allSlots.push({
              startTime: slotTime,
              endTime: this.addMinutesToTime(slotTime, 30), // Assuming 30-min slots
              date: dateKey
            });
          });
        }
      }
      
      // If no slots found in date format, try other formats
      if (allSlots.length === 0) {
        const slots = data.slots || data.data || [];
        return Array.isArray(slots) ? slots : [];
      }
      
      return allSlots;
    } catch (error) {
      this.logger.error('Error getting calendar slots', {
        error: error.message,
        calendarId,
        responseData: error.response?.data
      });
      
      // If v2 endpoint fails, try v1 endpoint
      if (error.response?.status === 404 || error.response?.status === 422) {
        try {
          const startTimestamp = new Date(startDate).getTime();
          const endTimestamp = new Date(endDate).getTime();
          
          const altResponse = await this.client.get(
            `/appointments/slots`,
            {
              params: {
                calendarId,
                startDate: startTimestamp,
                endDate: endTimestamp,
                timezone: 'America/Chicago' // Texas Central Time
              }
            }
          );
          // Handle GHL's date-grouped format for fallback endpoint too
          const data = altResponse.data;
          const allSlots = [];
          
          // If data has date keys (like "2025-07-29"), flatten all slots
          for (const dateKey in data) {
            if (data[dateKey] && data[dateKey].slots && Array.isArray(data[dateKey].slots)) {
              data[dateKey].slots.forEach(slotTime => {
                allSlots.push({
                  startTime: slotTime,
                  endTime: this.addMinutesToTime(slotTime, 30), // Assuming 30-min slots
                  date: dateKey
                });
              });
            }
          }
          
          // If no slots found in date format, try other formats
          if (allSlots.length === 0) {
            const slots = data.slots || data.data || [];
            return Array.isArray(slots) ? slots : [];
          }
          
          return allSlots;
        } catch (altError) {
          this.logger.error('Alternative calendar endpoint also failed', {
            error: altError.message,
            responseData: altError.response?.data
          });
          throw altError;
        }
      }
      
      throw error;
    }
  }

  // Book appointment
  async bookAppointment(calendarId, contactId, slotData) {
    try {
      const response = await this.client.post(
        `/calendars/events/appointments`,
        {
          calendarId,
          locationId: this.locationId,
          contactId,
          title: slotData.title,
          appointmentStatus: slotData.appointmentStatus || 'confirmed',
          startTime: slotData.startTime,
          endTime: slotData.endTime,
          toNotify: true
        }
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error booking appointment', {
        error: error.message,
        calendarId,
        contactId,
        responseData: error.response?.data
      });
      throw error;
    }
  }


  // Create conversation for tracking
  async createConversation(contactId) {
    try {
      const response = await this.client.post(
        `/conversations`,
        {
          locationId: this.locationId,
          contactId
        }
      );
      return response.data.conversation;
    } catch (error) {
      this.logger.error('Error creating conversation', {
        error: error.message,
        contactId,
        responseData: error.response?.data
      });
      throw error;
    }
  }

  // Get conversation messages from GHL
  async getConversationMessages(conversationId) {
    try {
      const response = await this.client.get(
        `/conversations/${conversationId}/messages`,
        {
          params: {
            limit: 100 // Get last 100 messages
            // Don't filter by type - GHL shows WhatsApp as TYPE_PHONE
          }
        }
      );
      
      this.logger.debug('GHL messages response structure', {
        hasMessages: !!response.data.messages,
        hasNestedMessages: !!(response.data.messages && response.data.messages.messages),
        dataKeys: Object.keys(response.data)
      });
      
      // Handle nested response structure
      if (response.data.messages && response.data.messages.messages) {
        this.logger.debug('Found messages in nested structure', {
          messageCount: response.data.messages.messages.length
        });
        return response.data.messages.messages;
      }
      
      // Handle direct messages array
      const messages = response.data.messages || response.data.data || response.data;
      const result = Array.isArray(messages) ? messages : [];
      this.logger.debug('Returning messages from GHL', { count: result.length });
      return result;
    } catch (error) {
      this.logger.error('Error fetching conversation messages', {
        error: error.message,
        conversationId,
        responseData: error.response?.data
      });
      throw error;
    }
  }

  // Get conversation by ID
  async getConversation(conversationId) {
    try {
      const response = await this.client.get(
        `/conversations/${conversationId}`,
        { headers: this.getHeaders() }
      );
      return response.data.conversation;
    } catch (error) {
      this.logger.error('Error fetching conversation', {
        error: error.message,
        conversationId,
        responseData: error.response?.data
      });
      throw error;
    }
  }

  // Get contact's active conversations
  async getContactConversations(contactId) {
    try {
      // Try the contact-specific endpoint first
      const response = await this.client.get(
        `/contacts/${contactId}/conversations`,
        {
          params: {
            limit: 10
          }
        }
      );
      // Handle different response formats from GHL
      const conversations = response.data.conversations || response.data.data || response.data;
      return Array.isArray(conversations) ? conversations : [];
    } catch (error) {
      // If that fails, try the search endpoint
      if (error.response?.status === 404) {
        try {
          const searchResponse = await this.client.get(
            `/conversations/search`,
            {
              params: {
                locationId: this.locationId,
                contactId: contactId,
                limit: 10
              }
            }
          );
          // Handle search response format
          const conversations = searchResponse.data.conversations || searchResponse.data.data || searchResponse.data;
          return Array.isArray(conversations) ? conversations : [];
        } catch (searchError) {
          this.logger.error('Error searching conversations', {
            error: searchError.message,
            contactId,
            responseData: searchError.response?.data
          });
          throw searchError;
        }
      }
      this.logger.error('Error fetching contact conversations', {
        error: error.message,
        contactId,
        responseData: error.response?.data
      });
      throw error;
    }
  }

  // Search for conversations by phone number
  async searchConversationsByPhone(phone) {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      this.logger.debug('Searching conversations by phone', { formattedPhone });
      
      const response = await this.client.get(
        `/conversations/search`,
        {
          params: {
            locationId: this.locationId,
            q: formattedPhone,
            limit: 10
          }
        }
      );
      
      const conversations = response.data.conversations || response.data || [];
      this.logger.debug('Found conversations by phone', {
        count: conversations.length,
        formattedPhone
      });
      
      return conversations;
    } catch (error) {
      this.logger.error('Error searching conversations by phone', {
        error: error.message,
        phone,
        responseData: error.response?.data
      });
      return [];
    }
  }
  
  // Get or create conversation for contact
  async getOrCreateConversation(contactId, phone = null) {
    try {
      // If we have a phone number, try searching by phone first
      if (phone) {
        const conversationsByPhone = await this.searchConversationsByPhone(phone);
        if (conversationsByPhone.length > 0) {
          // Return the most recent conversation
          const sortedConvs = conversationsByPhone.sort((a, b) => 
            new Date(b.dateUpdated || b.dateAdded) - new Date(a.dateUpdated || a.dateAdded)
          );
          this.logger.info('Using existing conversation found by phone search', {
            conversationId: sortedConvs[0].id
          });
          return sortedConvs[0];
        }
      }
      
      // Try to get existing conversations by contact ID
      const conversations = await this.getContactConversations(contactId);
      
      // Find the most recent active conversation
      const activeConversation = conversations.find(conv => 
        conv.status === 'open' || conv.status === 'active'
      );
      
      if (activeConversation) {
        return activeConversation;
      }
      
      // If no conversations found, try to create one
      try {
        const newConversation = await this.createConversation(contactId);
        this.logger.info('Created new conversation', {
          conversationId: newConversation.id,
          contactId
        });
        return newConversation;
      } catch (createError) {
        this.logger.error('Failed to create conversation', {
          error: createError.message,
          contactId,
          responseData: createError.response?.data
        });
      }
      
      // If all else fails, return a mock conversation object
      // This should rarely happen
      this.logger.warn('Using mock conversation ID as last resort', { contactId });
      return {
        id: `conv_${contactId}`,
        contactId: contactId,
        status: 'active',
        locationId: this.locationId
      };
    } catch (error) {
      this.logger.error('Error getting/creating conversation', {
        error: error.message,
        contactId
      });
      // Return a mock conversation object as fallback
      return {
        id: `conv_${contactId}`,
        contactId: contactId,
        status: 'active',
        locationId: this.locationId
      };
    }
  }

  // Send WhatsApp message (with resilience)
  async sendSMS(contactId, message) {
    try {
      const response = await this.client.post(
        '/conversations/messages',
        {
          type: 'WhatsApp', // Using WhatsApp type
          contactId: contactId,
          message: message
        }
      );
      
      // Update circuit breaker on success
      this.updateCircuitBreaker(true);
      
      this.logger.info('WhatsApp message sent successfully', { contactId });
      return response.data;
    } catch (error) {
      this.logger.error('Error sending WhatsApp message', {
        error: error.message,
        contactId,
        responseData: error.response?.data
      });
      
      // If circuit breaker is open or request failed, queue for retry
      if (this.circuitBreaker.state === 'open' || error.code === 'ECONNABORTED') {
        this.logger.info('Queueing WhatsApp message for retry', {
          reason: 'GHL unavailability',
          circuitBreakerState: this.circuitBreaker.state
        });
        await this.queueForRetry({
          type: 'sms',
          contactId,
          message
        });
        return { success: false, queued: true, error: 'Message queued for retry' };
      }
      
      throw error;
    }
  }
}

// Helper function to format phone numbers for GHL
export function formatPhoneNumber(phone) {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Add +1 if not present (assuming US numbers)
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  
  return `+${cleaned}`;
}