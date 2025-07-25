// Test different ways to store lead data in GHL
import { GHLService } from './services/ghlService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testStorageOptions() {
  console.log('Testing GHL storage options for lead data...\n');
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  const contactId = 'cL2khoCZCL0VC3DwgtK8';
  
  try {
    // Option 1: Store in tags
    console.log('1. TAGS APPROACH:');
    console.log('=================');
    const tags = [
      'qualified-lead',
      'budget:500',
      'business:restaurant',
      'problem:needs-more-customers',
      'goal:increase-sales-50%'
    ];
    
    await ghlService.addTags(contactId, tags);
    console.log('✅ Tags added successfully');
    console.log('Tags:', tags.join(', '));
    
    // Option 2: Store in notes
    console.log('\n2. NOTES APPROACH:');
    console.log('==================');
    const leadData = {
      name: 'Jaime',
      business_type: 'Restaurante',
      problem: 'Necesito más clientes para mi restaurante',
      goal: 'Aumentar ventas en 50%',
      budget: 500,
      email: 'jaime@example.com',
      qualified: true,
      qualification_date: new Date().toISOString()
    };
    
    const noteContent = `LEAD QUALIFICATION DATA
${JSON.stringify(leadData, null, 2)}`;
    
    await ghlService.addNote(contactId, noteContent);
    console.log('✅ Note with JSON data added successfully');
    
    // Option 3: Update standard fields
    console.log('\n3. STANDARD FIELDS APPROACH:');
    console.log('============================');
    const updateData = {
      email: 'jaime@example.com',
      companyName: 'Restaurante de Jaime',
      website: 'https://example.com',
      address1: 'Budget: $500/month | Goal: Increase sales 50%'
    };
    
    const updated = await ghlService.updateContact(contactId, updateData);
    console.log('✅ Standard fields updated successfully');
    
    // Get updated contact
    console.log('\n4. VERIFYING ALL DATA:');
    console.log('======================');
    const contact = await ghlService.getContact(contactId);
    
    console.log('Contact Data:');
    console.log('- Name:', contact.firstName || contact.name);
    console.log('- Email:', contact.email);
    console.log('- Company:', contact.companyName);
    console.log('- Tags:', contact.tags?.slice(0, 5).join(', ') + '...');
    console.log('- Total Tags:', contact.tags?.length);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testStorageOptions();