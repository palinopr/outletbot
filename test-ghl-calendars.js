import { GHLService } from './services/ghlService.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkAllCalendars() {
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  console.log('🔍 Checking GHL Calendars\n');
  console.log('Location ID:', process.env.GHL_LOCATION_ID);
  
  try {
    // 1. List all calendars for the location
    console.log('📅 Fetching all calendars...\n');
    const calendarsResponse = await ghlService.makeRequest(
      'GET',
      '/calendars',
      { params: { locationId: process.env.GHL_LOCATION_ID } }
    );
    
    if (calendarsResponse.calendars && calendarsResponse.calendars.length > 0) {
      console.log(`Found ${calendarsResponse.calendars.length} calendars:\n`);
      
      for (const calendar of calendarsResponse.calendars) {
        console.log(`Calendar: ${calendar.name}`);
        console.log(`  - ID: ${calendar.id}`);
        console.log(`  - Active: ${calendar.isActive}`);
        console.log(`  - Slot Duration: ${calendar.slotDuration} minutes`);
        console.log(`  - Description: ${calendar.description || 'N/A'}`);
        
        // Check if this is our configured calendar
        if (calendar.id === process.env.GHL_CALENDAR_ID) {
          console.log('  ⭐ THIS IS THE CONFIGURED CALENDAR\n');
          
          // Try to get slots for this calendar
          console.log('  Checking available slots...');
          try {
            const slots = await ghlService.getAvailableSlots(calendar.id, new Date(), 7);
            const totalSlots = Object.values(slots).reduce((sum, day) => sum + (day.slots?.length || 0), 0);
            console.log(`  - Available slots in next 7 days: ${totalSlots}`);
            
            if (totalSlots === 0) {
              console.log('  ❌ No slots available - Calendar needs configuration');
            } else {
              console.log('  ✅ Calendar has available slots');
            }
          } catch (e) {
            console.log('  ❌ Error checking slots:', e.message);
          }
        }
        console.log('');
      }
    } else {
      console.log('❌ No calendars found for this location');
    }
    
    // 2. Check specific calendar details
    console.log('\n📋 Checking configured calendar details...');
    console.log('Calendar ID:', process.env.GHL_CALENDAR_ID);
    
    try {
      const calendarDetails = await ghlService.makeRequest(
        'GET',
        `/calendars/${process.env.GHL_CALENDAR_ID}`
      );
      
      console.log('\nCalendar Details:');
      console.log(JSON.stringify(calendarDetails, null, 2));
      
    } catch (error) {
      console.log('❌ Error fetching calendar details:', error.message);
      if (error.response?.status === 404) {
        console.log('\n⚠️  Calendar not found. It may have been deleted or the ID is incorrect.');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

checkAllCalendars();