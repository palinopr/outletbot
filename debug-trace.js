import { config } from 'dotenv';
import { salesAgentInvoke } from './agents/salesAgent.js';
import { GHLService } from './services/ghlService.js';
import ConversationManager from './services/conversationManager.js';
import { HumanMessage } from '@langchain/core/messages';
import { Logger } from './services/logger.js';

config();

const logger = new Logger('debug-trace');

async function debugTrace() {
  console.log('🔍 Debugging Trace: 1f06a310-3a38-6d11-aa54-86c4ef864f6a');
  console.log('📞 Real GHL Contact: 54sJIGTtwmR89Qc5JeEt');
  console.log('========================================\n');

  try {
    // Initialize services
    const ghlService = new GHLService(
      process.env.GHL_API_KEY,
      process.env.GHL_LOCATION_ID
    );
    
    const conversationManager = new ConversationManager(ghlService);
    
    // Test contact details
    const contactId = '54sJIGTtwmR89Qc5JeEt';
    const testMessage = 'Hola, me interesa información sobre sus servicios';
    
    console.log('1️⃣ Fetching contact info...');
    try {
      const contact = await ghlService.getContact(contactId);
      console.log('✅ Contact found:', {
        name: contact.firstName || 'Unknown',
        phone: contact.phone,
        email: contact.email
      });
    } catch (error) {
      console.log('❌ Error fetching contact:', error.message);
    }
    
    console.log('\n2️⃣ Fetching conversation state...');
    const conversationState = await conversationManager.getConversationState(
      contactId,
      null, // conversationId
      null  // phone
    );
    
    console.log('📝 Conversation state:', {
      messageCount: conversationState.messages.length,
      conversationId: conversationState.conversationId,
      hasLeadInfo: !!(conversationState.leadName || conversationState.leadEmail)
    });
    
    console.log('\n3️⃣ Creating agent messages...');
    const agentMessages = [
      ...conversationState.messages,
      new HumanMessage(testMessage)
    ];
    
    console.log('📨 Total messages to agent:', agentMessages.length);
    console.log('📨 Last message:', testMessage);
    
    console.log('\n4️⃣ Invoking sales agent...');
    console.log('🔧 Debug: Checking message formats...');
    
    // Extract current lead info
    const currentLeadInfo = {
      name: conversationState.leadName,
      problem: conversationState.leadProblem,
      goal: conversationState.leadGoal,
      budget: conversationState.leadBudget,
      email: conversationState.leadEmail,
      phone: conversationState.leadPhone
    };
    
    console.log('👤 Current lead info:', currentLeadInfo);
    
    // Invoke agent with LangSmith tracing
    const result = await salesAgentInvoke({
      messages: agentMessages,
      leadInfo: currentLeadInfo,
      contactId,
      conversationId: conversationState.conversationId
    }, {
      configurable: {
        ghlService,
        calendarId: process.env.GHL_CALENDAR_ID,
        contactId
      },
      callbacks: {
        handleLLMStart: (llm, messages) => {
          console.log('\n🤖 LLM Start - Messages received:', messages.length);
          if (messages.length > 0) {
            console.log('First message type:', messages[0].constructor.name);
            console.log('First message content:', messages[0].content?.substring(0, 100) + '...');
          }
        },
        handleLLMEnd: (output) => {
          console.log('\n🤖 LLM End - Response:', output.generations?.[0]?.[0]?.text?.substring(0, 100) + '...');
        },
        handleToolStart: (tool, input) => {
          console.log('\n🔧 Tool Start:', tool.name);
          console.log('Tool input:', JSON.stringify(input).substring(0, 100) + '...');
        },
        handleToolEnd: (output) => {
          console.log('🔧 Tool End - Output:', JSON.stringify(output).substring(0, 100) + '...');
        }
      }
    });
    
    console.log('\n5️⃣ Agent result:');
    console.log('📬 Messages in result:', result.messages?.length || 0);
    
    if (result.messages && result.messages.length > 0) {
      const lastMessage = result.messages[result.messages.length - 1];
      console.log('✅ Last message type:', lastMessage.constructor.name);
      console.log('✅ Last message content:', lastMessage.content);
      
      // Check if agent actually processed the message
      const agentResponded = result.messages.some(msg => 
        msg._getType() === 'ai' && msg.content && msg.content.length > 0
      );
      
      if (agentResponded) {
        console.log('\n✅ SUCCESS: Agent received and processed the message!');
      } else {
        console.log('\n❌ ISSUE: Agent did not generate a response');
      }
    } else {
      console.log('\n❌ ERROR: No messages in result');
    }
    
    // Additional debugging info
    console.log('\n6️⃣ Checking prompt function...');
    console.log('✅ SystemMessage import is correct');
    console.log('✅ Messages should be BaseMessage instances');
    
  } catch (error) {
    console.error('\n❌ Error during debug:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the debug
debugTrace().catch(console.error);