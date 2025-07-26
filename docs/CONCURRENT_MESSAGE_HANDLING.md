# Concurrent Message Handling System

## Overview
This system handles cases where users send multiple messages before the AI has finished responding. It prevents message loss, maintains order, and consolidates rapid-fire messages for better understanding.

## Problem Solved
WhatsApp users often send messages in quick succession:
```
"Hola"
"soy juan"
"necesito ayuda"
"con marketing"
"mi presupuesto es 500"
```

Without proper handling, these messages could:
- Get lost if the bot is processing
- Arrive out of order
- Confuse the conversation flow
- Create duplicate responses

## Solution Architecture

### 1. Message Queue Service (`services/messageQueue.js`)
- **In-memory queue** per contact (can be upgraded to Redis)
- **Max queue size**: 10 messages per contact
- **Message timeout**: 60 seconds (expired messages are dropped)
- **Event emitters** for monitoring
- **Automatic cleanup** every 5 minutes

Key features:
```javascript
// Queue a message when bot is busy
messageQueue.enqueue(contactId, messageData)

// Get next message from queue
messageQueue.dequeue(contactId)

// Check if contact has queued messages
messageQueue.hasQueuedMessages(contactId)
```

### 2. Message Consolidator (`agents/messageConsolidator.js`)
Intelligently combines rapid-fire messages using GPT-4:

**Input:**
```
Message 1 (4:15:30 PM): Hola
Message 2 (4:15:31 PM): soy juan
Message 3 (4:15:32 PM): necesito ayuda con marketing
Message 4 (4:15:33 PM): mi presupuesto es 500
```

**Output:**
```
"Hola, soy Juan. Necesito ayuda con marketing y mi presupuesto es 500"
```

Features:
- **Time-based grouping**: Messages within 5 seconds
- **Content analysis**: Fixes typos, completes thoughts
- **Intelligent batching**: Groups related messages
- **Fallback**: Simple concatenation if AI fails

### 3. Webhook Handler Updates (`api/langgraph-api.js`)

#### When Bot is Busy:
```javascript
if (activeLocks.has(lockKey)) {
  // Queue the message instead of dropping it
  const queueResult = messageQueue.enqueue(contactId, {
    phone,
    message,
    conversationId,
    timestamp: Date.now()
  });
  
  return res.status(200).json({ 
    success: true,
    message: 'Message queued',
    position: queueResult.position
  });
}
```

#### Message Collection Window:
```javascript
// Give 100ms window to collect rapid messages
await new Promise(resolve => setTimeout(resolve, 100));

// Collect all queued messages
while (messageQueue.hasQueuedMessages(contactId)) {
  const queuedMsg = messageQueue.dequeue(contactId);
  if (queuedMsg) {
    queuedMessages.push(queuedMsg);
  }
}
```

#### After Processing:
```javascript
// Process any remaining queued messages
processQueuedMessages(contactId);
```

## Flow Diagram

```
User sends messages → Check if bot is processing
                     ↓                        ↓
                    YES                      NO
                     ↓                        ↓
               Queue message           Acquire lock
                     ↓                        ↓
              Return success          Wait 100ms for more
                                             ↓
                                    Collect queued messages
                                             ↓
                                    Consolidate if needed
                                             ↓
                                       Process with AI
                                             ↓
                                     Send response via GHL
                                             ↓
                                    Process next in queue
```

## Configuration

### Message Queue Settings:
```javascript
maxQueueSize: 10        // Max messages per contact
messageTimeout: 60000   // 1 minute expiry
cleanupInterval: 300000 // 5 minute cleanup
```

### Consolidation Settings:
```javascript
maxTimeBetweenMessages: 5000  // 5 seconds
collectionWindow: 100         // 100ms wait time
```

## Monitoring

The system emits events for monitoring:
- `messageQueued`: When message is added to queue
- `messageDequeued`: When message is processed
- `queueCleared`: When queue is cleared

Access stats:
```javascript
messageQueue.getStats()
// Returns: {
//   totalQueues: 3,
//   totalMessages: 7,
//   processingCount: 1,
//   queuesBySize: { 1: 2, 3: 1 }
// }
```

## Benefits

1. **No Lost Messages**: Every message is captured
2. **Natural Conversations**: Handles WhatsApp's message patterns
3. **Better Understanding**: Consolidates fragmented thoughts
4. **Scalable**: Can upgrade to Redis for production
5. **Observable**: Full monitoring and metrics

## Future Enhancements

1. **Redis Queue**: For distributed systems
2. **Priority Messages**: Handle urgent keywords first
3. **Smart Interrupts**: Use LangGraph interrupts for real-time updates
4. **Message Previews**: Show typing indicators during consolidation
5. **Multi-language Support**: Consolidate in any language

## Example Scenarios

### Scenario 1: Rapid Information
```
User: "Hola"
User: "soy Maria"
User: "tengo un salon de belleza"
User: "necesito mas clientes"
Bot: "¡Hola María! Entiendo que tienes un salón de belleza y necesitas más clientes. ¿Cuál es tu meta específica?"
```

### Scenario 2: Budget Correction
```
User: "mi presupuesto es 200"
User: "no espera"
User: "son 500 al mes"
Bot: "Perfecto, $500 al mes nos permite hacer mucho. ¿Cuál es tu email?"
```

### Scenario 3: Queue Overflow
```
User: [sends 15 messages rapidly]
Bot: [processes first 10, drops the rest due to queue limit]
```

## Testing

Run tests:
```bash
# Test message queue
node test/test-message-queue.js

# Test consolidator
node test/test-consolidator.js

# Test full flow
node test/test-concurrent-messages.js
```