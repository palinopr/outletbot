import { GHLService } from './services/ghlService.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const CALENDAR_ID = 'eIHCWiTQjE1lTzjdz4xi';

async function debugCalendar() {
  console.log('🔍 Calendar Debug Test\n');
  console.log(`Calendar ID: ${CALENDAR_ID}`);
  
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );

  // Test different date formats and endpoints
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  console.log('Date formats being tested:');
  console.log(`- ISO String: ${now.toISOString()} to ${nextWeek.toISOString()}`);
  console.log(`- Unix timestamp (ms): ${now.getTime()} to ${nextWeek.getTime()}`);
  console.log(`- Unix timestamp (seconds): ${Math.floor(now.getTime()/1000)} to ${Math.floor(nextWeek.getTime()/1000)}\n`);

  // Test 1: Direct API call with different endpoints
  console.log('1. Testing direct API calls...\n');
  
  const endpoints = [
    `/calendars/${CALENDAR_ID}/free-slots`,
    `/calendars/${CALENDAR_ID}/appointments/slots`,
    `/appointments/slots?calendarId=${CALENDAR_ID}`,
    `/calendars/${CALENDAR_ID}/availability`,
    `/calendars/events/slots?calendarId=${CALENDAR_ID}`
  ];

  for (const endpoint of endpoints) {
    console.log(`Testing endpoint: ${endpoint}`);
    try {
      const response = await axios.get(
        `https://services.leadconnectorhq.com${endpoint}`,
        {
          headers: ghlService.getHeaders(),
          params: {
            startDate: now.getTime(),
            endDate: nextWeek.getTime(),
            timezone: 'America/New_York'
          }
        }
      );
      console.log(`✅ Success! Response structure:`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Data type: ${typeof response.data}`);
      console.log(`   Data keys: ${Object.keys(response.data).join(', ')}`);
      if (response.data.slots) {
        console.log(`   Slots found: ${response.data.slots.length}`);
      }
      console.log(`   Full response:`, JSON.stringify(response.data, null, 2).substring(0, 500));
      break; // Found working endpoint
    } catch (error) {
      console.log(`❌ Failed: ${error.response?.status} ${error.response?.statusText}`);
      if (error.response?.data) {
        console.log(`   Error:`, error.response.data);
      }
    }
    console.log('');
  }

  // Test 2: Try with service method
  console.log('\n2. Testing via GHLService.getAvailableSlots()...');
  try {
    const slots = await ghlService.getAvailableSlots(
      CALENDAR_ID,
      now.toISOString(),
      nextWeek.toISOString()
    );
    console.log(`✅ Got slots:`, slots);
    console.log(`   Total slots: ${slots.length}`);
    if (slots.length > 0) {
      console.log(`   First slot:`, slots[0]);
    }
  } catch (error) {
    console.log(`❌ Error:`, error.message);
  }

  // Test 3: Get calendar info
  console.log('\n3. Trying to get calendar info...');
  try {
    const calendarResponse = await axios.get(
      `https://services.leadconnectorhq.com/calendars/${CALENDAR_ID}`,
      { headers: ghlService.getHeaders() }
    );
    console.log('✅ Calendar info:', calendarResponse.data);
  } catch (error) {
    console.log(`❌ Calendar info error: ${error.response?.status}`);
  }
}

debugCalendar().catch(console.error);