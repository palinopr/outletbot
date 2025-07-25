// Get custom fields from GHL location using the correct API endpoint
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function getCustomFields() {
  console.log('Fetching custom fields from GHL...\n');
  
  try {
    // According to the API docs, the endpoint is:
    // GET /locations/:locationId/customFields
    const response = await axios.get(
      `https://services.leadconnectorhq.com/locations/${process.env.GHL_LOCATION_ID}/customFields`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      }
    );
    
    console.log('Custom Fields Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.customFields) {
      console.log('\n=== CUSTOM FIELDS FOUND ===');
      response.data.customFields.forEach((field, idx) => {
        console.log(`\n${idx + 1}. ${field.name || field.fieldKey}`);
        console.log(`   ID: ${field.id}`);
        console.log(`   Key: ${field.fieldKey || field.key}`);
        console.log(`   Type: ${field.dataType || field.type}`);
        console.log(`   Model: ${field.model}`);
      });
    }
    
  } catch (error) {
    if (error.response) {
      console.error('API Error:', error.response.status);
      console.error('Response:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    
    // Try alternative approach - check what's in a contact
    console.log('\n=== Checking Contact Structure ===');
    try {
      const contactResponse = await axios.get(
        `https://services.leadconnectorhq.com/contacts/cL2khoCZCL0VC3DwgtK8`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
            'Version': '2021-07-28',
            'Accept': 'application/json'
          }
        }
      );
      
      const contact = contactResponse.data.contact;
      console.log('\nContact has these fields:');
      console.log('- Standard fields:', Object.keys(contact).filter(k => !['customField', 'customFields'].includes(k)).join(', '));
      
      if (contact.customField) {
        console.log('\n- Custom fields (customField):');
        Object.entries(contact.customField).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      }
      
      if (contact.customFields) {
        console.log('\n- Custom fields (customFields):');
        if (Array.isArray(contact.customFields)) {
          contact.customFields.forEach(field => {
            console.log(`  ID: ${field.id}, Value: ${field.value}`);
          });
        } else {
          Object.entries(contact.customFields).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        }
      }
      
    } catch (err) {
      console.error('Contact check failed:', err.message);
    }
  }
}

getCustomFields();