import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function checkCalendarSettings() {
  console.log('🔍 Checking Calendar Settings in GHL\n');
  
  const headers = {
    'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json'
  };
  
  try {
    // Get calendar details
    console.log('Calendar ID:', process.env.GHL_CALENDAR_ID);
    console.log('Location ID:', process.env.GHL_LOCATION_ID);
    
    // Try to get calendar info
    const calendarUrl = `https://services.leadconnectorhq.com/calendars/${process.env.GHL_CALENDAR_ID}`;
    
    console.log('\nFetching calendar details...');
    const response = await axios.get(calendarUrl, { headers });
    
    if (response.data) {
      console.log('\nCalendar Info:');
      console.log('- Name:', response.data.name);
      console.log('- Active:', response.data.isActive);
      console.log('- Team ID:', response.data.teamId);
      console.log('- Slot Duration:', response.data.slotDuration);
      console.log('- Slot Buffer:', response.data.slotBuffer);
      
      if (response.data.availabilities) {
        console.log('\nAvailability Settings:');
        console.log(JSON.stringify(response.data.availabilities, null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log('\n⚠️  Calendar not found. The calendar ID might be incorrect.');
      console.log('Please check the calendar ID in GHL and update .env file');
    }
  }
}

checkCalendarSettings();