#!/usr/bin/env node
import axios from 'axios';

console.log('🔍 FIXING CALENDAR ENDPOINT');
console.log('===========================\n');

const GHL_API_KEY = 'pit-21cee867-6a57-4eea-b6fa-2bd4462934d0';
const GHL_LOCATION_ID = 'sHFG9Rw6BdGh6d6bfMqG';
const GHL_CALENDAR_ID = 'eIHCWiTQjE1lTzjdz4xi';

const ghlClient = axios.create({
  baseURL: 'https://services.leadconnectorhq.com',
  headers: {
    'Authorization': `Bearer ${GHL_API_KEY}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json'
  }
});

async function testCalendarEndpoints() {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);

  // Test different calendar endpoints
  const endpoints = [
    {
      name: 'Free Slots (v1)',
      url: `/calendars/${GHL_CALENDAR_ID}/free-slots`,
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    },
    {
      name: 'Available Slots',
      url: `/calendars/events/slots`,
      params: {
        calendarId: GHL_CALENDAR_ID,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timezone: 'America/Chicago'
      }
    },
    {
      name: 'Calendar Groups',
      url: `/calendars/groups`,
      params: {
        locationId: GHL_LOCATION_ID
      }
    }
  ];

  for (const endpoint of endpoints) {
    console.log(`\nTesting: ${endpoint.name}`);
    console.log(`URL: ${endpoint.url}`);
    
    try {
      const response = await ghlClient.get(endpoint.url, { params: endpoint.params });
      console.log('✅ Success!');
      
      if (response.data) {
        if (response.data.data) {
          console.log(`   Data type: ${typeof response.data.data}`);
          if (Array.isArray(response.data.data)) {
            console.log(`   Count: ${response.data.data.length}`);
          } else if (typeof response.data.data === 'object') {
            const keys = Object.keys(response.data.data);
            console.log(`   Date keys: ${keys.slice(0, 3).join(', ')}...`);
            if (keys.length > 0 && response.data.data[keys[0]].slots) {
              console.log(`   Slots on ${keys[0]}: ${response.data.data[keys[0]].slots.length}`);
            }
          }
        }
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    }
  }

  // Now update the GHL service to use the correct endpoint
  console.log('\n\n📝 UPDATE NEEDED IN ghlService.js:');
  console.log('===================================');
  console.log(`
The calendar endpoint should be:
  /calendars/{calendarId}/free-slots

Not:
  /calendars/events/slots

Update the getAvailableSlots method in services/ghlService.js`);
}

testCalendarEndpoints().catch(console.error);