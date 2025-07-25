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
            limit: 100, // Get last 100 messages
            type: 'TYPE_WHATSAPP,TYPE_SMS' // Get WhatsApp and SMS messages
          }
        }
      );
      
      // Handle nested response structure
      if (response.data.messages && response.data.messages.messages) {
        return response.data.messages.messages;
      }
      
      // Handle direct messages array
      const messages = response.data.messages || response.data.data || response.data;
      return Array.isArray(messages) ? messages : [];
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

  // Get or create conversation for contact
  async getOrCreateConversation(contactId) {
    try {
      // First try to get existing conversations
      const conversations = await this.getContactConversations(contactId);
      
      // Find the most recent active conversation
      const activeConversation = conversations.find(conv => 
        conv.status === 'open' || conv.status === 'active'
      );
      
      if (activeConversation) {
        return activeConversation;
      }
      
      // If no conversations API available, return a mock conversation object
      // GHL handles conversations internally when sending messages
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