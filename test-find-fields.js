// Find custom fields and update contact with lead data
import { GHLService } from './services/ghlService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testFieldsAndUpdate() {
  console.log('Testing GHL fields and contact update...\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  const contactId = 'cL2khoCZCL0VC3DwgtK8';
  
  try {
    // First, get the current contact
    console.log('1. Getting current contact...');
    const contact = await ghlService.getContact(contactId);
    console.log('Current contact:', {
      name: contact.firstName || contact.name,
      email: contact.email,
      phone: contact.phone,
      tags: contact.tags || []
    });
    
    // Try to update contact with custom fields
    console.log('\n2. Testing contact update with lead data...');
    
    const updateData = {
      firstName: 'Jaime',
      email: 'jaime@example.com',
      customField: {
        lead_problem: 'Necesito más clientes para mi restaurante',
        lead_goal: 'Aumentar ventas en 50%',
        lead_budget: '500',
        business_type: 'Restaurante'
      }
    };
    
    console.log('Updating with:', updateData);
    
    const updated = await ghlService.updateContact(contactId, updateData);
    console.log('\n✅ Contact updated successfully!');
    
    // Add a note with the qualification details
    console.log('\n3. Adding qualification note...');
    const note = `Lead Qualification Summary:
- Name: Jaime
- Business: Restaurante  
- Problem: Necesito más clientes
- Goal: Aumentar ventas en 50%
- Budget: $500/month
- Status: Qualified Lead`;
    
    await ghlService.addNote(contactId, note);
    console.log('✅ Note added successfully!');
    
    // Add relevant tags
    console.log('\n4. Adding tags...');
    const tags = ['qualified-lead', 'budget-500', 'restaurant', 'needs-marketing'];
    await ghlService.addTags(contactId, tags);
    console.log('✅ Tags added:', tags.join(', '));
    
    // Get updated contact to verify
    console.log('\n5. Verifying updates...');
    const updatedContact = await ghlService.getContact(contactId);
    console.log('Updated contact:', {
      name: updatedContact.firstName,
      email: updatedContact.email,
      customField: updatedContact.customField,
      tags: updatedContact.tags
    });
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testFieldsAndUpdate();