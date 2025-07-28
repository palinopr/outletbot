# Safe Cost Optimization Plan for Outlet Media Bot

## Current Situation
- **Cost**: $0.05 per conversation
- **Problem**: 3 LLM calls, large system prompt repeated each time
- **Risk**: Breaking the working qualification flow

## Implementation Plan (Safest to Riskiest)

### Phase 1: Remove Empty Final LLM Call (Day 1)
**Risk**: VERY LOW - The 3rd call does nothing  
**Savings**: 34% reduction  
**Testing**: 1 hour

#### Changes in `agents/salesAgent.js`:

```javascript
// CURRENT: createReactAgent makes 3 calls
// 1. extract_lead_info
// 2. send_ghl_message  
// 3. Empty response (wasteful)

// ADD: Early termination after message sent
// Around line 1265, modify the agent configuration:

export const salesAgent = createReactAgent({
  llm: modelWithTools,
  tools: tools,
  stateSchema: AgentStateAnnotation,
  checkpointer: checkpointer,
  messageModifier: promptFunction,
  // ADD THIS:
  shouldEnd: (state) => {
    // Check if last message was from send_ghl_message tool
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage?.name === 'send_ghl_message') {
      return true; // End conversation after sending message
    }
    return false;
  }
});
```

**Testing**:
```bash
# Test with local script
node test-local.js

# Check that conversation ends after send_ghl_message
# Verify no 3rd empty LLM call in traces
```

### Phase 2: Cache Common Responses (Day 2)
**Risk**: LOW - Only affects specific messages  
**Savings**: 100% on cached messages (30% of traffic)  
**Testing**: 2 hours

#### Add new file `services/responseCache.js`:

```javascript
// services/responseCache.js
export const CACHED_RESPONSES = {
  greetings: {
    "hola": "¡Hola! Soy María, tu consultora de ventas de Outlet Media. ¿Podrías decirme tu nombre, por favor?",
    "buenos dias": "¡Buenos días! Soy María de Outlet Media. ¿Cómo te llamas?",
    "buenas tardes": "¡Buenas tardes! Soy María de Outlet Media. ¿Cuál es tu nombre?",
    "buenas noches": "¡Buenas noches! Soy María de Outlet Media. ¿Me podrías compartir tu nombre?",
    "hi": "¡Hola! Soy María, tu consultora de ventas de Outlet Media. ¿Podrías decirme tu nombre, por favor?",
    "hello": "¡Hola! Soy María de Outlet Media. ¿Cómo te llamas?"
  },
  confirmations: {
    "si": null, // Don't cache - needs context
    "no": "Entiendo. Si cambias de opinión o tienes preguntas, aquí estaré para ayudarte.",
    "gracias": "¡De nada! ¿Hay algo más en lo que pueda ayudarte con tu negocio?",
    "ok": "Perfecto. ¿Tienes alguna pregunta sobre cómo podemos ayudar a tu negocio?",
    "vale": "Excelente. ¿En qué más puedo ayudarte?"
  },
  // Budget rejections (for consistency)
  lowBudget: {
    "nurture": "Entiendo tu presupuesto. Por el momento, nuestros servicios comienzan en $300 mensuales. Te he agregado a nuestra lista para futuras promociones. ¡Mucho éxito con tu negocio!"
  }
};

export function getCachedResponse(message, context = {}) {
  const normalizedMsg = message.toLowerCase().trim();
  
  // Check greetings (only if no leadInfo.name yet)
  if (!context.leadInfo?.name && CACHED_RESPONSES.greetings[normalizedMsg]) {
    return CACHED_RESPONSES.greetings[normalizedMsg];
  }
  
  // Check confirmations
  if (CACHED_RESPONSES.confirmations[normalizedMsg]) {
    return CACHED_RESPONSES.confirmations[normalizedMsg];
  }
  
  return null;
}
```

#### Modify `api/langgraphApi.js` webhook handler:

```javascript
// Add import
import { getCachedResponse } from '../services/responseCache.js';

// In the webhook handler, BEFORE invoking salesAgent:
async function handleWebhook(req, res) {
  // ... existing code ...
  
  // Check for cached response FIRST
  const cachedResponse = getCachedResponse(message, { leadInfo });
  if (cachedResponse) {
    // Skip LLM entirely
    await ghlService.sendSMS(contactId, cachedResponse);
    
    // Log for monitoring
    logger.info('CACHED_RESPONSE_USED', {
      message,
      response: cachedResponse,
      savedTokens: 3822 // Average tokens saved
    });
    
    return res.json({ 
      success: true, 
      cached: true,
      message: 'Response sent from cache' 
    });
  }
  
  // ... continue with normal salesAgent flow ...
}
```

### Phase 3: Conditional Tool Execution (Week 2)
**Risk**: MEDIUM - Changes tool flow  
**Savings**: 40% fewer tokens  
**Testing**: 4 hours

#### Modify `agents/salesAgent.js` extract tool:

```javascript
// In extractLeadInfo tool, add early exit:
const extractLeadInfo = tool(
  async ({ message }, config) => {
    // ADD: Skip extraction for certain messages
    const SKIP_PATTERNS = [
      /^(hola|hi|hello|hey)$/i,
      /^(si|no|ok|vale)$/i,
      /^(gracias|thanks)$/i,
      /^\d+$/, // Just numbers
      /^[.,!?]$/ // Just punctuation
    ];
    
    if (SKIP_PATTERNS.some(pattern => pattern.test(message.trim()))) {
      logger.info('EXTRACTION_SKIPPED', { message });
      return new Command({
        update: {
          messages: [{
            role: "tool",
            content: "No extraction needed for greeting/simple response",
            tool_call_id: toolCallId
          }]
        }
      });
    }
    
    // ... rest of extraction logic ...
  }
);
```

### Phase 4: Compress System Prompt (Week 3)
**Risk**: HIGH - Could change behavior  
**Savings**: 50% fewer tokens  
**Testing**: Full regression testing needed

#### Create compressed prompt:

```javascript
// Keep original as backup
const SALES_AGENT_PROMPT_ORIGINAL = SALES_AGENT_PROMPT;

// New compressed version (from 1,100 to 400 tokens)
const SALES_AGENT_PROMPT = `Eres María, consultora de Outlet Media. Habla español texano.

FLUJO ESTRICTO:
1. extract_lead_info SIEMPRE primero
2. Preguntar en orden: nombre→problema→meta→presupuesto→email
3. Budget <$${config.minBudget}: tag "nurture-lead", explicar mínimo
4. Budget ≥$${config.minBudget}: pedir email→mostrar calendario

REGLAS:
- SOLO usar send_ghl_message para responder
- NO preguntar info que ya tienes en leadInfo
- Si appointmentBooked=true: solo preguntas de seguimiento
- Si calendarShown=true: esperar selección

HERRAMIENTAS:
1. extract_lead_info: extraer info del mensaje
2. send_ghl_message: enviar respuesta
3. get_calendar_slots: SOLO si tienes TODO + budget≥$${config.minBudget}
4. update_ghl_contact: actualizar tags/notas
5. parse_time_selection: interpretar selección de hora
6. book_appointment: confirmar cita`;
```

### Phase 5: Smart Model Routing (Month 2)
**Risk**: HIGH - Different model behaviors  
**Savings**: 90% on simple tasks  
**Testing**: Extensive A/B testing needed

```javascript
// Only after everything else is stable
const selectModel = (message, state) => {
  // Use GPT-3.5 only for very simple cases
  const useGPT35 = 
    CACHED_RESPONSES.greetings[message.toLowerCase()] ||
    (state.calendarShown && /^\d+$/.test(message)) || // Just selecting number
    (state.leadInfo?.name && message.length < 10); // Short answers
    
  return useGPT35 
    ? "gpt-3.5-turbo"
    : "gpt-4-turbo-preview";
};
```

## Testing Plan for Each Phase

### Phase 1 Test:
```bash
# Run 10 test conversations
node test-local.js

# Check LangSmith traces - should see only 2 LLM calls
# Verify conversation ends properly
```

### Phase 2 Test:
```bash
# Test cached responses
curl -X POST http://localhost:8000/webhook \
  -d '{"message": "hola", "contactId": "test123"}'

# Should see no LLM calls in logs
# Should get standard greeting
```

### Phase 3-5 Tests:
- Run full conversation flows
- Compare responses with production
- Monitor qualification rates
- A/B test with small % of traffic

## Rollback Plan

Each phase can be rolled back independently:

```javascript
// Environment variables for feature flags
ENABLE_CACHE_RESPONSES=false
ENABLE_SKIP_EXTRACTION=false  
ENABLE_COMPRESSED_PROMPT=false
ENABLE_SMART_ROUTING=false
```

## Expected Results

| Phase | Risk | Savings | Timeline |
|-------|------|---------|----------|
| 1. Remove empty call | Very Low | 34% | Day 1 |
| 2. Cache responses | Low | 10-15% | Day 2 |
| 3. Skip extractions | Medium | 10-15% | Week 2 |
| 4. Compress prompt | High | 20-30% | Week 3 |
| 5. Model routing | High | 20-40% | Month 2 |

**Total Potential Savings**: 85-90%  
**Final Cost**: $0.005-0.008 per conversation  
**Monthly Savings**: $1,350 (at 1,000 conv/day)