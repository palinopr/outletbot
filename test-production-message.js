import { GHLService } from './services/ghlService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testProductionMessage() {
  const ghlService = new GHLService(
    process.env.GHL_API_KEY,
    process.env.GHL_LOCATION_ID
  );
  
  const contactId = 'Jf5Hc0JRXrnqCjQGHTEU'; // Jaime Ortiz
  
  console.log('📱 Sending test message to contact:', contactId);
  
  try {
    // Send a simple test message
    const result = await ghlService.sendSMS(
      contactId,
      "Hola! Este es un mensaje de prueba del bot. El calendario no tiene slots disponibles actualmente. Por favor configura el calendario ID: eIHCWiTQjE1lTzjdz4xi en GHL con horarios disponibles."
    );
    
    console.log('✅ Message sent successfully!');
    console.log('Message ID:', result.messageId);
    
  } catch (error) {
    console.error('❌ Error sending message:', error.message);
  }
}

testProductionMessage();