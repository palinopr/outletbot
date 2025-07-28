import { GHLService } from './services/ghlService.js';
import dotenv from 'dotenv';

dotenv.config();

async function debugCalendarIssue() {
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  const calendarId = process.env.GHL_CALENDAR_ID;
  console.log('🔍 Debugging Calendar Issue');
  console.log('Calendar ID:', calendarId);
  console.log('Location ID:', process.env.GHL_LOCATION_ID);
  
  try {
    // Try different date ranges
    const now = new Date();
    console.log('\nCurrent time:', now.toISOString());
    console.log('Timezone:', process.env.TIMEZONE || 'America/New_York');
    
    // Test 1: Next 7 days
    console.log('\n📅 Test 1: Getting slots for next 7 days...');
    const slots7days = await ghlService.getAvailableSlots(calendarId, now, 7);
    console.log('Result:', Object.keys(slots7days).length, 'days with slots');
    if (Object.keys(slots7days).length > 0) {
      const firstDay = Object.keys(slots7days)[0];
      console.log(`First day with slots: ${firstDay}`);
      console.log(`Number of slots: ${slots7days[firstDay].slots.length}`);
      console.log('Sample slots:', slots7days[firstDay].slots.slice(0, 3));
    }
    
    // Test 2: Starting tomorrow
    console.log('\n📅 Test 2: Getting slots starting tomorrow...');
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const slotsTomorrow = await ghlService.getAvailableSlots(calendarId, tomorrow, 7);
    console.log('Result:', Object.keys(slotsTomorrow).length, 'days with slots');
    
    // Test 3: Raw API call to see what we get
    console.log('\n📅 Test 3: Raw API call...');
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // 30 days out
    
    const rawResponse = await ghlService.makeRequest(
      `/calendars/${calendarId}/free-slots`,
      'GET',
      {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timezone: process.env.TIMEZONE || 'America/New_York'
      }
    );
    
    console.log('Raw response:', JSON.stringify(rawResponse, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugCalendarIssue();