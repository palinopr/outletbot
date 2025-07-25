const axios = require('axios');

class GHLService {
  constructor(apiKey, locationId) {
    this.apiKey = apiKey;
    this.locationId = locationId;
    this.baseURL = 'https://services.leadconnectorhq.com';
  }

  // Get headers for GHL API requests
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
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
      const response = await axios.get(
        `${this.baseURL}/calendars/${calendarId}/appointments/slots`,
        {
          headers: this.getHeaders(),
          params: {
            startDate,
            endDate,
            timezone: 'America/New_York' // Adjust as needed
          }
        }
      );
      return response.data.data; // GHL API returns data in a data property
    } catch (error) {
      console.error('Error getting calendar slots:', error.response?.data);
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

  // Send SMS via GHL
  async sendSMS(contactId, message) {
    try {
      const response = await axios.post(
        `${this.baseURL}/conversations/messages`,
        {
          type: 'SMS',
          locationId: this.locationId,
          contactId,
          message: message
        },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending SMS:', error.response?.data);
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
          }
        }
      );
      return response.data.messages || [];
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
      const response = await axios.get(
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
      return response.data.conversations || [];
    } catch (error) {
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
      
      // If no active conversation, create a new one
      return await this.createConversation(contactId);
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      // Fallback to creating new conversation
      return await this.createConversation(contactId);
    }
  }
}

// Helper function to format phone numbers for GHL
function formatPhoneNumber(phone) {
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

module.exports = { 
  GHLService,
  formatPhoneNumber
};