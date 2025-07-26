#!/usr/bin/env node
import axios from 'axios';

console.log('🔍 TESTING CALENDAR WITH CORRECT FORMAT');
console.log('======================================\n');

const GHL_API_KEY = 'pit-21cee867-6a57-4eea-b6fa-2bd4462934d0';
const GHL_CALENDAR_ID = 'eIHCWiTQjE1lTzjdz4xi';

const ghlClient = axios.create({
  baseURL: 'https://services.leadconnectorhq.com',
  headers: {
    'Authorization': `Bearer ${GHL_API_KEY}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json'
  }
});

async function testCalendar() {
  // Test with Unix timestamps (milliseconds)
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);
  
  const startTimestamp = startDate.getTime();
  const endTimestamp = endDate.getTime();
  
  console.log('📅 Testing calendar slots...');
  console.log(`   Start: ${startDate.toISOString()} (${startTimestamp})`);
  console.log(`   End: ${endDate.toISOString()} (${endTimestamp})`);
  console.log(`   Calendar ID: ${GHL_CALENDAR_ID}\n`);
  
  try {
    const response = await ghlClient.get(`/calendars/${GHL_CALENDAR_ID}/free-slots`, {
      params: {
        startDate: startTimestamp,
        endDate: endTimestamp,
        timezone: 'America/Chicago'
      }
    });
    
    console.log('✅ Calendar request successful!');
    
    const data = response.data;
    const dateKeys = Object.keys(data);
    console.log(`\n📊 Found slots for ${dateKeys.length} days:`);
    
    let totalSlots = 0;
    dateKeys.slice(0, 3).forEach(date => {
      const daySlots = data[date]?.slots || [];
      totalSlots += daySlots.length;
      console.log(`   ${date}: ${daySlots.length} slots`);
      if (daySlots.length > 0) {
        const firstSlot = new Date(daySlots[0]);
        console.log(`      First: ${firstSlot.toLocaleTimeString()}`);
      }
    });
    
    console.log(`\n   Total: ${totalSlots} slots available`);
    
  } catch (error) {
    console.error('❌ Calendar request failed!');
    console.error(`   Status: ${error.response?.status}`);
    console.error(`   Error: ${error.response?.data?.message || error.message}`);
    
    if (error.response?.status === 422) {
      console.error('\n⚠️  422 Error means:');
      console.error('   - Calendar ID might be invalid');
      console.error('   - Calendar might not be properly configured');
      console.error('   - Calendar might not have availability set up');
    }
  }
}

// Also test if we can list calendars
async function listCalendars() {
  console.log('\n\n📋 Listing all calendars...');
  
  try {
    const response = await ghlClient.get('/calendars', {
      params: {
        locationId: 'sHFG9Rw6BdGh6d6bfMqG'
      }
    });
    
    const calendars = response.data.calendars || [];
    console.log(`✅ Found ${calendars.length} calendars:\n`);
    
    calendars.forEach(cal => {
      console.log(`   Name: ${cal.name}`);
      console.log(`   ID: ${cal.id}`);
      console.log(`   Type: ${cal.calendarType || 'N/A'}`);
      console.log(`   Active: ${cal.isActive ? 'Yes' : 'No'}\n`);
    });
    
    if (calendars.length > 0) {
      const validCalendar = calendars.find(c => c.isActive);
      if (validCalendar && validCalendar.id !== GHL_CALENDAR_ID) {
        console.log('⚠️  The calendar ID in your deployment might be wrong!');
        console.log(`   Try using: ${validCalendar.id}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to list calendars:', error.response?.data || error.message);
  }
}

(async () => {
  await testCalendar();
  await listCalendars();
  
  console.log('\n📌 DEPLOYMENT FIX:');
  console.log('==================');
  console.log('If calendar is failing, update GHL_CALENDAR_ID in your deployment');
  console.log('to one of the active calendar IDs listed above.');
})().catch(console.error);