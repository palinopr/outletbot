import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function checkLocationResources() {
  console.log('🔍 Checking GHL Location Resources\n');
  console.log('Location ID:', process.env.GHL_LOCATION_ID);
  console.log('API Key:', process.env.GHL_API_KEY.substring(0, 20) + '...');
  
  const headers = {
    'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json'
  };
  
  const baseURL = 'https://services.leadconnectorhq.com';
  
  try {
    // 1. Check location details
    console.log('\n📍 Checking location...');
    const locationResponse = await axios.get(
      `${baseURL}/locations/${process.env.GHL_LOCATION_ID}`,
      { headers }
    );
    console.log('Location Name:', locationResponse.data.name);
    console.log('Location Active:', locationResponse.data.isActive);
    
    // 2. List calendars
    console.log('\n📅 Listing calendars...');
    try {
      const calendarsResponse = await axios.get(
        `${baseURL}/calendars?locationId=${process.env.GHL_LOCATION_ID}`,
        { headers }
      );
      
      if (calendarsResponse.data.calendars) {
        console.log(`Found ${calendarsResponse.data.calendars.length} calendars:`);
        calendarsResponse.data.calendars.forEach(cal => {
          console.log(`- ${cal.name} (ID: ${cal.id})`);
          console.log(`  Active: ${cal.isActive}, Duration: ${cal.slotDuration}min`);
        });
      } else {
        console.log('No calendars found');
      }
    } catch (e) {
      console.log('Error listing calendars:', e.response?.data || e.message);
    }
    
    // 3. Check specific calendar
    console.log(`\n🔍 Checking calendar ${process.env.GHL_CALENDAR_ID}...`);
    try {
      const calendarResponse = await axios.get(
        `${baseURL}/calendars/${process.env.GHL_CALENDAR_ID}`,
        { headers }
      );
      
      console.log('Calendar found!');
      console.log('Name:', calendarResponse.data.name);
      console.log('Active:', calendarResponse.data.isActive);
      console.log('Team ID:', calendarResponse.data.teamId);
      
      // Check slots
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);
      
      console.log('\n🕐 Checking available slots...');
      const slotsResponse = await axios.get(
        `${baseURL}/calendars/${process.env.GHL_CALENDAR_ID}/free-slots`,
        { 
          headers,
          params: {
            startDate: startDate.getTime(),
            endDate: endDate.getTime(),
            timezone: 'America/New_York'
          }
        }
      );
      
      const slotDays = Object.keys(slotsResponse.data);
      const totalSlots = slotDays.reduce((sum, day) => {
        return sum + (slotsResponse.data[day].slots?.length || 0);
      }, 0);
      
      console.log(`Total slots available in next 7 days: ${totalSlots}`);
      if (totalSlots === 0) {
        console.log('⚠️  No slots available - calendar needs configuration');
      } else {
        console.log('Sample slots:', slotDays[0], slotsResponse.data[slotDays[0]]);
      }
      
    } catch (e) {
      console.log('❌ Calendar error:', e.response?.data || e.message);
      if (e.response?.status === 404) {
        console.log('Calendar not found with ID:', process.env.GHL_CALENDAR_ID);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

checkLocationResources();