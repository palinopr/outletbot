import { Client } from "@langchain/langgraph-sdk";

async function testLangGraphAPI() {
  try {
    console.log("🚀 Testing LangGraph API...\n");
    
    // Create client
    const client = new Client({ 
      apiUrl: "http://localhost:2024"
    });
    
    // Test 1: List assistants
    console.log("1. Listing assistants:");
    try {
      const assistants = await client.assistants.search();
      console.log("✅ Assistants found:", assistants);
    } catch (error) {
      console.log("❌ Error listing assistants:", error.message);
    }
    
    // Test 2: Test sales agent
    console.log("\n2. Testing sales_agent:");
    try {
      const streamResponse = client.runs.stream(
        null, // Threadless run
        "sales_agent",
        {
          input: {
            messages: [
              { role: "user", content: "Hola, soy Juan y necesito ayuda con marketing digital" }
            ],
            leadInfo: {},
            contactId: "test-123",
            conversationId: "conv-123"
          },
          streamMode: "messages"
        }
      );
      
      console.log("Streaming response:");
      for await (const chunk of streamResponse) {
        console.log(`Event: ${chunk.event}`);
        console.log(`Data:`, JSON.stringify(chunk.data, null, 2));
        console.log("---");
      }
    } catch (error) {
      console.log("❌ Error testing sales agent:", error.message);
    }
    
    // Test 3: Test webhook handler
    console.log("\n3. Testing webhook_handler:");
    try {
      const webhookPayload = {
        phone: "+1234567890",
        message: "Hola, quiero información",
        contactId: "test-contact-456"
      };
      
      const streamResponse = client.runs.stream(
        null,
        "webhook_handler",
        {
          input: {
            messages: [
              { role: "user", content: JSON.stringify(webhookPayload) }
            ],
            contactId: webhookPayload.contactId,
            phone: webhookPayload.phone
          },
          streamMode: "updates"
        }
      );
      
      console.log("Streaming webhook response:");
      for await (const chunk of streamResponse) {
        console.log(`Event: ${chunk.event}`);
        console.log(`Data:`, JSON.stringify(chunk.data, null, 2));
        console.log("---");
      }
    } catch (error) {
      console.log("❌ Error testing webhook handler:", error.message);
    }
    
  } catch (error) {
    console.error("Fatal error:", error);
  }
}

// Run tests
testLangGraphAPI().catch(console.error);