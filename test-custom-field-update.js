// Test updating contact with custom fields
import { GHLService } from './services/ghlService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testCustomFieldUpdate() {
  console.log('Testing custom field updates...\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  const contactId = 'cL2khoCZCL0VC3DwgtK8';
  
  try {
    // Test data simulating what the bot collected
    const leadData = {
      firstName: 'Jaime',
      email: 'jaime@restaurante.com',
      companyName: 'Mi Restaurante Mexicano',
      customFields: {
        goal: 'Necesito más clientes para mi restaurante',
        budget: '500',
        businessType: 'RESTAURANTE',
        urgencyLevel: 'HIGH',
        verifiedName: 'Jaime'
      }
    };
    
    console.log('Updating contact with lead data...');
    console.log('Standard fields:', {
      firstName: leadData.firstName,
      email: leadData.email,
      companyName: leadData.companyName
    });
    console.log('Custom fields:', leadData.customFields);
    
    // Update the contact
    const updated = await ghlService.updateContact(contactId, leadData);
    console.log('\n✅ Contact updated successfully!');
    
    // Add tags
    console.log('\nAdding qualification tags...');
    const tags = [
      'qualified-lead',
      'budget:500',
      'business:restaurant',
      'urgency:high',
      'needs-marketing'
    ];
    await ghlService.addTags(contactId, tags);
    console.log('✅ Tags added:', tags.join(', '));
    
    // Add note with qualification summary
    console.log('\nAdding qualification note...');
    const note = `Lead Qualification Summary (${new Date().toLocaleString()})
━━━━━━━━━━━━━━━━━━━━━━
👤 Name: Jaime
🏢 Business: Mi Restaurante Mexicano (RESTAURANTE)
🎯 Goal: Necesito más clientes para mi restaurante
💰 Budget: $500/month
⚡ Urgency: HIGH
✅ Status: QUALIFIED LEAD

Next Steps: Schedule sales call to discuss marketing strategy`;
    
    await ghlService.addNote(contactId, note);
    console.log('✅ Note added to contact timeline');
    
    // Verify the update
    console.log('\n=== Verifying Updates ===');
    const contact = await ghlService.getContact(contactId);
    
    console.log('Contact updated:');
    console.log('- Name:', contact.firstName);
    console.log('- Email:', contact.email);
    console.log('- Company:', contact.companyName);
    console.log('- Tags:', contact.tags?.length || 0);
    
    if (contact.customFields && Array.isArray(contact.customFields)) {
      console.log('\nCustom fields saved:');
      contact.customFields.forEach(field => {
        // Find field name from our mapping
        const fieldNames = {
          'r7jFiJBYHiEllsGn7jZC': 'goal',
          '4Qe8P25JRLW0IcZc5iOs': 'budget',
          'HtoheVc48qvAfvRUKhfG': 'business_type',
          'dXasgCZFgqd62psjw7nd': 'urgency_level',
          'TjB0I5iNfVwx3zyxZ9sW': 'verified_name'
        };
        const fieldName = fieldNames[field.id] || field.id;
        console.log(`- ${fieldName}: ${field.value}`);
      });
    }
    
    console.log('\n✅ All updates completed successfully!');
    console.log('\nThe bot will automatically save this data during conversations.');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testCustomFieldUpdate();