# Fix for Context Contamination Issue

## Problem
When a user sends "Hola", the agent responds with information from previous conversations (mentioning Juan or other users). This happens because:

1. The system searches for existing conversations by phone number
2. It retrieves ALL message history from that conversation
3. The agent sees this old history and gets confused about context

## Root Cause
In `ghlService.js`, the `getOrCreateConversation` method:
```javascript
// Returns the most recent conversation with ALL its history
const sortedConvs = conversationsByPhone.sort((a, b) => 
  new Date(b.dateUpdated || b.dateAdded) - new Date(a.dateUpdated || a.dateAdded)
);
return sortedConvs[0]; // This includes ALL previous messages!
```

## Solution Options

### Option 1: Filter Recent Messages Only (Recommended)
Only pass recent messages (last N messages or last 24 hours) to the agent:
- Prevents context contamination
- Maintains some useful context
- Works with existing GHL conversation structure

### Option 2: Create New Conversation Each Time
Force creation of new conversation for each interaction:
- Complete isolation
- No context contamination
- But loses conversation continuity

### Option 3: Session-Based Conversations
Use session IDs to track individual chat sessions:
- Messages grouped by session
- Clean context per session
- Requires additional session management

## Quick Fix
To immediately resolve the issue, limit the conversation history window in `conversationManager.js`:

```javascript
// Only get messages from last 2 hours
const recentMessages = ghlMessages.filter(msg => {
  const messageTime = new Date(msg.dateAdded);
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  return messageTime > twoHoursAgo;
});
```

This ensures the agent only sees recent context, preventing it from mentioning users from old conversations.