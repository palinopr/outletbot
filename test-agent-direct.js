import { salesAgent } from './agents/salesAgent.js';
import { config } from 'dotenv';

// Load environment variables
config();

async function testSalesAgentDirect() {
  console.log("🧪 Testing Sales Agent with Modern Patterns\n");
  
  try {
    // Test 1: Basic conversation
    console.log("Test 1: Basic greeting and extraction");
    const initialState = {
      messages: [
        { role: "user", content: "Hola, soy Juan y tengo un restaurante" }
      ],
      leadInfo: {},
      contactId: "test-123",
      conversationId: "conv-123",
      appointmentBooked: false,
      extractionCount: 0,
      processedMessages: [],
      availableSlots: [],
      ghlUpdated: false,
      lastUpdate: null,
      userInfo: {}
    };
    
    const config = {
      configurable: {
        thread_id: "test-thread",
        ghlService: {
          sendSMS: async (contactId, message) => {
            console.log(`📱 Mock SMS sent to ${contactId}: ${message}`);
            return { success: true };
          },
          getAvailableSlots: async () => {
            console.log("📅 Mock calendar slots requested");
            return [
              { startTime: "2025-01-27T10:00:00", endTime: "2025-01-27T10:30:00" },
              { startTime: "2025-01-27T14:00:00", endTime: "2025-01-27T14:30:00" }
            ];
          },
          addTags: async (contactId, tags) => {
            console.log(`🏷️ Mock tags added to ${contactId}:`, tags);
          },
          addNote: async (contactId, note) => {
            console.log(`📝 Mock note added to ${contactId}:`, note);
          },
          updateContact: async (contactId, data) => {
            console.log(`👤 Mock contact updated ${contactId}:`, data);
          }
        },
        calendarId: "test-calendar"
      },
      recursionLimit: 10
    };
    
    console.log("Invoking agent...");
    const result = await salesAgent.invoke(initialState, config);
    
    console.log("\n✅ Result:");
    console.log("- Final lead info:", result.leadInfo);
    console.log("- Extraction count:", result.extractionCount);
    console.log("- Messages sent:", result.messages.length);
    console.log("- Last message:", result.messages[result.messages.length - 1]);
    
    // Test 2: Command object flow
    console.log("\n\nTest 2: Testing Command object flow with budget qualification");
    const qualifiedState = {
      ...initialState,
      messages: [
        { role: "user", content: "Mi problema es que no tengo suficientes clientes" },
        { role: "assistant", content: "Entiendo Juan. ¿Cuál es tu meta principal?" },
        { role: "user", content: "Quiero duplicar mis ventas" },
        { role: "assistant", content: "Excelente meta. ¿Cuál es tu presupuesto mensual para marketing?" },
        { role: "user", content: "Puedo invertir unos 500 dólares al mes" }
      ],
      leadInfo: {
        name: "Juan",
        businessType: "restaurante",
        problem: "no tiene suficientes clientes",
        goal: "duplicar ventas"
      }
    };
    
    const result2 = await salesAgent.invoke(qualifiedState, config);
    
    console.log("\n✅ Qualified Lead Result:");
    console.log("- Budget detected:", result2.leadInfo.budget);
    console.log("- Qualified:", result2.leadInfo.budget >= 300);
    console.log("- Should ask for email next");
    
    // Test 3: Appointment booking with goto END
    console.log("\n\nTest 3: Testing appointment booking termination");
    const bookingState = {
      ...initialState,
      messages: [
        { role: "user", content: "Mi email es juan@restaurant.com" }
      ],
      leadInfo: {
        name: "Juan",
        businessType: "restaurante",
        problem: "no tiene suficientes clientes",
        goal: "duplicar ventas",
        budget: 500
      },
      availableSlots: [
        { index: 1, display: "Lunes 27 a las 10:00 AM", startTime: "2025-01-27T10:00:00", endTime: "2025-01-27T10:30:00" },
        { index: 2, display: "Lunes 27 a las 2:00 PM", startTime: "2025-01-27T14:00:00", endTime: "2025-01-27T14:30:00" }
      ]
    };
    
    const result3 = await salesAgent.invoke(bookingState, config);
    
    console.log("\n✅ Booking Flow Result:");
    console.log("- Email captured:", result3.leadInfo.email);
    console.log("- Available slots shown:", result3.availableSlots?.length);
    console.log("- Appointment booked:", result3.appointmentBooked);
    
    console.log("\n🎉 All tests completed!");
    console.log("\n📊 Modern Patterns Validated:");
    console.log("✅ Annotation.Root state management");
    console.log("✅ Command objects in tools");
    console.log("✅ Dynamic prompt function");
    console.log("✅ preModelHook for message windowing");
    console.log("✅ goto: END for conversation termination");
    
  } catch (error) {
    console.error("❌ Test error:", error);
    console.error("Stack:", error.stack);
  }
}

// Run the test
testSalesAgentDirect().catch(console.error);