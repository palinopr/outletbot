// Test post-appointment message handling
import { messageQueue } from './services/messageQueue.js';
import { consolidateMessages, shouldConsolidateMessages } from './agents/messageConsolidator.js';

console.log('=== Testing Post-Appointment Message Handling ===\n');

// Simulate a scenario where user sends 4 messages after appointment is booked
async function testPostAppointmentMessages() {
  const contactId = 'test-contact-123';
  
  console.log('1. Simulating 4 rapid messages after appointment booking:\n');
  
  const messages = [
    { message: "gracias", timestamp: Date.now() },
    { message: "una pregunta mas", timestamp: Date.now() + 100 },
    { message: "va a ser en español?", timestamp: Date.now() + 200 },
    { message: "necesito que sea en español", timestamp: Date.now() + 300 }
  ];
  
  // Test message queueing
  console.log('2. Testing message queue:');
  messages.forEach((msg, index) => {
    if (index === 0) {
      console.log(`   - First message processed immediately: "${msg.message}"`);
    } else {
      const result = messageQueue.enqueue(contactId, msg);
      console.log(`   - Message ${index + 1} queued at position ${result.position}: "${msg.message}"`);
    }
  });
  
  console.log(`\n   Queue size for ${contactId}: ${messageQueue.getQueue(contactId).length}`);
  
  // Test message consolidation
  console.log('\n3. Testing message consolidation:');
  
  if (shouldConsolidateMessages(messages)) {
    console.log('   - Messages should be consolidated (sent within 5 seconds)');
    
    const consolidationResult = await consolidateMessages(messages);
    console.log(`   - Original messages: ${consolidationResult.originalCount}`);
    console.log(`   - Time span: ${consolidationResult.timeSpan}ms`);
    console.log(`   - Consolidated message: "${consolidationResult.consolidated}"`);
  }
  
  // Test state check for appointment booked
  console.log('\n4. Testing appointment state check:');
  
  const mockState = {
    appointmentBooked: true,
    leadInfo: {
      name: "Jaime",
      email: "jaime@mirestaurante.com",
      budget: 500,
      businessType: "restaurante"
    }
  };
  
  if (mockState.appointmentBooked) {
    console.log('   - Appointment already booked: YES');
    console.log('   - Bot should respond with post-appointment support');
    console.log('   - Example response: "¡De nada Jaime! Sí, tu cita será completamente en español..."');
  }
  
  // Clean up
  messageQueue.clearQueue(contactId);
  console.log('\n5. Queue cleared for contact\n');
  
  console.log('=== Test Complete ===');
}

// Run the test
testPostAppointmentMessages().catch(console.error);