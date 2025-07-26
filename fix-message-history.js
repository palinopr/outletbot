// Fix for OpenAI error: "An assistant message with 'tool_calls' must be followed by tool messages"

export function cleanMessageHistory(messages) {
  const cleaned = [];
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    
    // If this is an AI message with tool_calls
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      // Check if the next message is a tool message
      const nextMsg = messages[i + 1];
      
      if (!nextMsg || nextMsg.role !== 'tool') {
        // Skip this message - it has tool_calls but no corresponding tool response
        console.log('Skipping orphaned tool_call message:', msg.content?.substring(0, 50));
        continue;
      }
      
      // Add the AI message
      cleaned.push(msg);
      
      // Add all subsequent tool messages
      let j = i + 1;
      while (j < messages.length && messages[j].role === 'tool') {
        cleaned.push(messages[j]);
        j++;
      }
      
      // Skip to after the tool messages
      i = j - 1;
    } else {
      // Regular message, just add it
      cleaned.push(msg);
    }
  }
  
  return cleaned;
}

// Alternative: Convert tool_calls to regular content
export function convertToolCallsToContent(messages) {
  return messages.map(msg => {
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      // Convert tool calls to content
      const toolCallSummary = msg.tool_calls.map(tc => 
        `[Calling ${tc.function.name}]`
      ).join(', ');
      
      return {
        ...msg,
        content: msg.content ? `${msg.content} ${toolCallSummary}` : toolCallSummary,
        tool_calls: undefined
      };
    }
    return msg;
  });
}

// Filter out tool-related messages entirely
export function removeToolMessages(messages) {
  return messages.filter(msg => 
    msg.role !== 'tool' && 
    !(msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0)
  );
}