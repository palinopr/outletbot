# Command Pattern Quick Reference

## ✅ CORRECT Pattern (Use This)

```javascript
import { Command } from '@langchain/langgraph';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const myTool = tool(
  async (input, config) => {
    // Do your processing...
    
    return new Command({
      update: {
        // Update any state fields
        myField: "new value",
        counter: 42,
        
        // Messages MUST be plain objects
        messages: [{
          role: "tool",
          content: "Operation completed",
          tool_call_id: config.toolCall?.id || "default"
        }]
      },
      
      // Optional: control flow
      goto: condition ? "END" : undefined
    });
  },
  {
    name: "my_tool",
    description: "Tool description",
    schema: z.object({
      input: z.string()
    })
  }
);
```

## ❌ INCORRECT Pattern (Don't Use)

```javascript
// DON'T DO THIS - Message class instances
return new Command({
  update: {
    messages: [
      new ToolMessage({  // ❌ WRONG
        content: "Result",
        tool_call_id: "123"
      })
    ]
  }
});

// DON'T DO THIS - Simple object return
return {  // ❌ Misses Command benefits
  result: "some value"
};
```

## Key Points

1. **Command objects ARE compatible** with createReactAgent (v0.2.33+)
2. **Use plain objects** for messages, not Message classes
3. **Command pattern is recommended** for state management
4. **ToolNode handles Commands** automatically
5. **Enables control flow** with `goto`

## Benefits of Command Pattern

- ✅ Update any state field, not just messages
- ✅ Control conversation flow with `goto`
- ✅ Consistent state management
- ✅ Better error handling
- ✅ Cleaner code structure

## Common Use Cases

### 1. Update State and Add Message
```javascript
return new Command({
  update: {
    leadInfo: { name: "John", email: "john@example.com" },
    messages: [{
      role: "tool",
      content: "Contact information updated",
      tool_call_id: config.toolCall?.id
    }]
  }
});
```

### 2. Terminate Conversation
```javascript
return new Command({
  update: {
    appointmentBooked: true,
    messages: [{
      role: "assistant",
      content: "Appointment confirmed!",
      name: "Assistant"
    }]
  },
  goto: "END"  // Terminate after this
});
```

### 3. Error Handling
```javascript
return new Command({
  update: {
    messages: [{
      role: "tool",
      content: `Error: ${error.message}`,
      tool_call_id: config.toolCall?.id
    }]
  }
});
```

## Remember
- Always use plain objects in the messages array
- Command objects are the modern, recommended approach
- This pattern works perfectly with createReactAgent