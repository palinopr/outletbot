// Find all custom fields in GHL location
import { GHLService } from './services/ghlService.js';
import dotenv from 'dotenv';

dotenv.config();

async function findCustomFields() {
  console.log('Searching for custom fields in GHL...\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  try {
    // Get custom fields from the location
    const response = await ghlService.makeRequest(
      'GET',
      `/locations/${process.env.GHL_LOCATION_ID}/customFields`
    );
    
    console.log('Custom Fields Found:');
    console.log('==================\n');
    
    if (response.customFields && response.customFields.length > 0) {
      response.customFields.forEach((field, index) => {
        console.log(`${index + 1}. ${field.name}`);
        console.log(`   ID: ${field.id}`);
        console.log(`   Key: ${field.key}`);
        console.log(`   Type: ${field.dataType}`);
        if (field.options && field.options.length > 0) {
          console.log(`   Options: ${field.options.join(', ')}`);
        }
        console.log('');
      });
      
      console.log('\nFields for Lead Qualification:');
      console.log('==============================');
      
      // Look for specific fields we need
      const importantFields = [
        'name', 'business', 'problem', 'goal', 'budget', 
        'email', 'phone', 'lead_name', 'lead_problem', 
        'lead_goal', 'lead_budget', 'lead_email'
      ];
      
      response.customFields.forEach(field => {
        const fieldNameLower = field.name.toLowerCase();
        if (importantFields.some(term => fieldNameLower.includes(term))) {
          console.log(`✅ ${field.name}: ${field.id}`);
        }
      });
      
    } else {
      console.log('No custom fields found.');
      
      // Try to get a contact to see what fields exist
      console.log('\nChecking contact structure...');
      const contact = await ghlService.getContact('cL2khoCZCL0VC3DwgtK8');
      
      if (contact && contact.customFields) {
        console.log('\nCustom fields in contact:');
        Object.entries(contact.customFields).forEach(([key, value]) => {
          console.log(`- ${key}: ${value}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error fetching custom fields:', error.response?.data || error.message);
    
    // Try alternative endpoint
    console.log('\nTrying alternative approach...');
    try {
      // Get a contact to see its structure
      const contact = await ghlService.getContact('cL2khoCZCL0VC3DwgtK8');
      
      console.log('\nContact structure:');
      console.log('Name:', contact.firstName || contact.name);
      console.log('Email:', contact.email);
      console.log('Phone:', contact.phone);
      
      if (contact.customField) {
        console.log('\nCustom fields in contact:');
        Object.entries(contact.customField).forEach(([key, value]) => {
          console.log(`- ${key}: ${value}`);
        });
      }
      
      // Also check for customFields (plural)
      if (contact.customFields) {
        console.log('\nCustomFields (plural):');
        Object.entries(contact.customFields).forEach(([key, value]) => {
          console.log(`- ${key}: ${value}`);
        });
      }
      
    } catch (err) {
      console.error('Alternative approach failed:', err.message);
    }
  }
}

findCustomFields();