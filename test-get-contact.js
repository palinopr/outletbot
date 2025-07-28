import { GHLService } from './services/ghlService.js';
import dotenv from 'dotenv';

dotenv.config();

async function getContactInfo() {
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  const contactId = 'Jf5Hc0JRXrnqCjQGHTEU';
  
  try {
    // Get contact details
    const contact = await ghlService.getContact(contactId);
    
    console.log('Contact Information:');
    console.log('ID:', contact.id);
    console.log('Name:', contact.firstName, contact.lastName);
    console.log('Phone:', contact.phone);
    console.log('Email:', contact.email);
    console.log('Tags:', contact.tags || []);
    
    // Get conversation
    try {
      const conversations = await ghlService.getConversations(contactId);
      console.log('\nConversations:', conversations.conversations?.length || 0);
      
      if (conversations.conversations?.[0]) {
        const conv = conversations.conversations[0];
        console.log('Latest conversation ID:', conv.id);
        console.log('Last message:', conv.lastMessageBody);
      }
    } catch (e) {
      console.log('\nNo conversations found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getContactInfo();