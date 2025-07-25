import axios from 'axios';

export class GHLService {
  constructor(apiKey, locationId) {
    this.apiKey = apiKey;
    this.locationId = locationId;
    this.baseURL = 'https://services.leadconnectorhq.com';
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
      console.error('Error creating/updating contact:', error);
      throw error;
    }
  }

  // Find contact by phone number
  async findContactByPhone(phoneNumber) {
    try {
      const response = await axios.get(
        `${this.baseURL}/contacts/search/duplicate`,
        {
          headers: this.getHeaders(),
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
      const response = await axios.post(
        `${this.baseURL}/contacts`,
        {
          locationId: this.locationId,
          ...data
        },
        { headers: this.getHeaders() }
      );
      return response.data.contact;
    } catch (error) {
      console.error('Error creating contact:', error.response?.data);
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
      
      const response = await axios.put(
        `${this.baseURL}/contacts/${contactId}`,
        data,
        { headers: this.getHeaders() }
      );
      return response.data.contact;
    } catch (error) {
      console.error('Error updating contact:', error.response?.data);
      throw error;
    }
  }

  // Get contact by ID
  async getContact(contactId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/contacts/${contactId}`,
        { headers: this.getHeaders() }
      );
      return response.data.contact;
    } catch (error) {
      console.error('Error getting contact:', error.response?.data);
      throw error;
    }
  }

  // Add tags to contact
  async addTags(contactId, tags) {
    try {
      const response = await axios.post(
        `${this.baseURL}/contacts/${contactId}/tags`,
        { tags },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error adding tags:', error.response?.data);
      throw error;
    }
  }

  // Add note to contact
  async addNote(contactId, note) {
    try {
      const response = await axios.post(
        `${this.baseURL}/contacts/${contactId}/notes`,
        { 
          body: note,
          userId: this.locationId // Using location ID as fallback
        },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error adding note:', error.response?.data);
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
      const response = await axios.get(
        `${this.baseURL}/calendars/${calendarId}/free-slots`,
        {
          headers: this.getHeaders(),
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
      console.error('Error getting calendar slots:', error.response?.data);
      
      // If v2 endpoint fails, try v1 endpoint
      if (error.response?.status === 404 || error.response?.status === 422) {
        try {
          const startTimestamp = new Date(startDate).getTime();
          const endTimestamp = new Date(endDate).getTime();
          
          const altResponse = await axios.get(
            `${this.baseURL}/appointments/slots`,
            {
              headers: this.getHeaders(),
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
          console.error('Alternative endpoint also failed:', altError.response?.data);
          throw altError;
        }
      }
      
      throw error;
    }
  }

  // Book appointment
  async bookAppointment(calendarId, contactId, slotData) {
    try {
      const response = await axios.post(
        `${this.baseURL}/calendars/events/appointments`,
        {
          calendarId,
          locationId: this.locationId,
          contactId,
          title: slotData.title,
          appointmentStatus: slotData.appointmentStatus || 'confirmed',
          startTime: slotData.startTime,
          endTime: slotData.endTime,
          toNotify: true
        },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error booking appointment:', error.response?.data);
      throw error;
    }
  }

  // Send WhatsApp message via GHL
  async sendSMS(contactId, message) {
    try {
      const response = await axios.post(
        `${this.baseURL}/conversations/messages`,
        {
          type: 'WhatsApp',
          locationId: this.locationId,
          contactId,
          message: message
        },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error.response?.data);
      throw error;
    }
  }

  // Create conversation for tracking
  async createConversation(contactId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/conversations`,
        {
          locationId: this.locationId,
          contactId
        },
        { headers: this.getHeaders() }
      );
      return response.data.conversation;
    } catch (error) {
      console.error('Error creating conversation:', error.response?.data);
      throw error;
    }
  }

  // Get conversation messages from GHL
  async getConversationMessages(conversationId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/conversations/${conversationId}/messages`,
        {
          headers: this.getHeaders(),
          params: {
            limit: 100 // Get last 100 messages
            // Don't filter by type - GHL shows WhatsApp as TYPE_PHONE
          }
        }
      );
      
      console.log('GHL messages response structure:', {
        hasMessages: !!response.data.messages,
        hasNestedMessages: !!(response.data.messages && response.data.messages.messages),
        dataKeys: Object.keys(response.data)
      });
      
      // Handle nested response structure
      if (response.data.messages && response.data.messages.messages) {
        console.log(`Found ${response.data.messages.messages.length} messages in nested structure`);
        return response.data.messages.messages;
      }
      
      // Handle direct messages array
      const messages = response.data.messages || response.data.data || response.data;
      const result = Array.isArray(messages) ? messages : [];
      console.log(`Returning ${result.length} messages from GHL`);
      return result;
    } catch (error) {
      console.error('Error fetching conversation messages:', error.response?.data);
      throw error;
    }
  }

  // Get conversation by ID
  async getConversation(conversationId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/conversations/${conversationId}`,
        { headers: this.getHeaders() }
      );
      return response.data.conversation;
    } catch (error) {
      console.error('Error fetching conversation:', error.response?.data);
      throw error;
    }
  }

  // Get contact's active conversations
  async getContactConversations(contactId) {
    try {
      // Try the contact-specific endpoint first
      const response = await axios.get(
        `${this.baseURL}/contacts/${contactId}/conversations`,
        {
          headers: this.getHeaders(),
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
          const searchResponse = await axios.get(
            `${this.baseURL}/conversations/search`,
            {
              headers: this.getHeaders(),
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
          console.error('Error searching conversations:', searchError.response?.data);
          throw searchError;
        }
      }
      console.error('Error fetching contact conversations:', error.response?.data);
      throw error;
    }
  }

  // Search for conversations by phone number
  async searchConversationsByPhone(phone) {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      console.log(`Searching conversations for phone: ${formattedPhone}`);
      
      const response = await axios.get(
        `${this.baseURL}/conversations/search`,
        {
          headers: this.getHeaders(),
          params: {
            locationId: this.locationId,
            q: formattedPhone,
            limit: 10
          }
        }
      );
      
      const conversations = response.data.conversations || response.data || [];
      console.log(`Found ${conversations.length} conversations for phone ${formattedPhone}`);
      
      return conversations;
    } catch (error) {
      console.error('Error searching conversations:', error.response?.data);
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
          console.log(`Using existing conversation ${sortedConvs[0].id} found by phone search`);
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
        console.log(`Created new conversation ${newConversation.id}`);
        return newConversation;
      } catch (createError) {
        console.error('Failed to create conversation:', createError.response?.data);
      }
      
      // If all else fails, return a mock conversation object
      // This should rarely happen
      console.warn('Using mock conversation ID as last resort');
      return {
        id: `conv_${contactId}`,
        contactId: contactId,
        status: 'active',
        locationId: this.locationId
      };
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      // Return a mock conversation object as fallback
      return {
        id: `conv_${contactId}`,
        contactId: contactId,
        status: 'active',
        locationId: this.locationId
      };
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