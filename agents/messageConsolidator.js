// Message Consolidator for handling multiple rapid messages
import { interrupt } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { Logger } from '../services/logger.js';

const logger = new Logger('messageConsolidator');

/**
 * Consolidate multiple messages from the same user
 * This handles cases where users send messages in rapid succession
 * @param {Array} messages - Array of messages to consolidate
 * @returns {Object} Consolidated message info
 */
export async function consolidateMessages(messages) {
  if (!messages || messages.length === 0) {
    return null;
  }

  // If only one message, return it as-is
  if (messages.length === 1) {
    return {
      originalCount: 1,
      consolidated: messages[0].message,
      messages: messages
    };
  }

  logger.info('Consolidating multiple messages', {
    count: messages.length,
    timeSpan: messages[messages.length - 1].timestamp - messages[0].timestamp
  });

  try {
    const llm = new ChatOpenAI({ model: "gpt-4", temperature: 0 });
    
    // Format messages for consolidation
    const messageTexts = messages.map((m, i) => 
      `Message ${i + 1} (${new Date(m.timestamp).toLocaleTimeString()}): ${m.message}`
    ).join('\n');

    const prompt = `You are analyzing multiple messages sent in quick succession by the same user.
    Consolidate these messages into a single coherent message that captures the user's complete intent.
    
    Messages:
    ${messageTexts}
    
    Rules:
    1. Combine related information
    2. Fix typos and incomplete thoughts
    3. Preserve all important details (name, business, budget, etc.)
    4. Keep the natural conversational tone
    5. Return ONLY the consolidated message text
    
    Example:
    Input messages:
    - "Hola"
    - "soy juan"
    - "necesito ayuda con marketing"
    - "mi presupuesto es 500"
    
    Output: "Hola, soy Juan. Necesito ayuda con marketing y mi presupuesto es 500"`;

    const response = await llm.invoke([
      new SystemMessage("You consolidate multiple rapid messages into a single coherent message."),
      { role: "user", content: prompt }
    ]);

    return {
      originalCount: messages.length,
      consolidated: response.content,
      messages: messages,
      timeSpan: messages[messages.length - 1].timestamp - messages[0].timestamp
    };
  } catch (error) {
    logger.error('Error consolidating messages', { error: error.message });
    // Fallback: join messages with spaces
    return {
      originalCount: messages.length,
      consolidated: messages.map(m => m.message).join(' '),
      messages: messages,
      fallback: true
    };
  }
}

/**
 * Check if messages should be consolidated based on timing
 * @param {Array} messages - Array of messages
 * @returns {boolean} Whether to consolidate
 */
export function shouldConsolidateMessages(messages) {
  if (!messages || messages.length < 2) {
    return false;
  }

  // Check time between messages
  const maxTimeBetweenMessages = 5000; // 5 seconds
  
  for (let i = 1; i < messages.length; i++) {
    const timeDiff = messages[i].timestamp - messages[i - 1].timestamp;
    if (timeDiff > maxTimeBetweenMessages) {
      return false; // Messages are too far apart
    }
  }

  return true;
}

/**
 * Handle interruption for new messages during processing
 * This allows the agent to be aware of new incoming messages
 * @param {Object} currentState - Current conversation state
 * @param {Object} queuedMessages - Any queued messages
 * @returns {Object} Updated state or interrupt action
 */
export function handleMessageInterrupt(currentState, queuedMessages) {
  if (!queuedMessages || queuedMessages.length === 0) {
    return currentState;
  }

  logger.info('Handling message interrupt', {
    queuedCount: queuedMessages.length,
    contactId: currentState.contactId
  });

  // Use LangGraph interrupt to pause and handle new messages
  const interruptData = interrupt({
    reason: 'new_messages_received',
    queuedMessages: queuedMessages,
    currentState: currentState,
    action: 'consolidate_and_continue'
  });

  // The interrupt will be handled by the graph
  // allowing it to consolidate messages and adjust response
  return interruptData;
}

/**
 * Intelligent message batching based on content
 * Groups related messages together
 * @param {Array} messages - Array of messages
 * @returns {Array} Batched message groups
 */
export function batchRelatedMessages(messages) {
  if (!messages || messages.length === 0) {
    return [];
  }

  const batches = [];
  let currentBatch = [messages[0]];
  
  const greetingPatterns = /^(hola|hi|hey|buenos|buenas)/i;
  const questionPatterns = /\?$/;
  const numberPatterns = /\d+/;

  for (let i = 1; i < messages.length; i++) {
    const prevMsg = messages[i - 1].message.toLowerCase();
    const currMsg = messages[i].message.toLowerCase();
    const timeDiff = messages[i].timestamp - messages[i - 1].timestamp;

    // Decide if messages should be in same batch
    let shouldBatch = false;

    // Same batch if:
    // 1. Time is close (< 3 seconds)
    if (timeDiff < 3000) {
      shouldBatch = true;
    }
    // 2. Current message seems to complete previous
    else if (prevMsg.match(greetingPatterns) && !currMsg.match(greetingPatterns)) {
      shouldBatch = true;
    }
    // 3. Previous ends with question, current might be clarification
    else if (prevMsg.match(questionPatterns) && timeDiff < 10000) {
      shouldBatch = false; // Keep questions separate
    }
    // 4. Both contain numbers (might be corrections)
    else if (prevMsg.match(numberPatterns) && currMsg.match(numberPatterns) && timeDiff < 5000) {
      shouldBatch = true;
    }

    if (shouldBatch) {
      currentBatch.push(messages[i]);
    } else {
      batches.push(currentBatch);
      currentBatch = [messages[i]];
    }
  }

  // Don't forget the last batch
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  logger.info('Batched messages', {
    originalCount: messages.length,
    batchCount: batches.length,
    batchSizes: batches.map(b => b.length)
  });

  return batches;
}