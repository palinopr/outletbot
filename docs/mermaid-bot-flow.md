# WhatsApp Sales Bot Flow - Mermaid Diagram

Copy and paste this into https://www.mermaidchart.com/

```mermaid
flowchart TB
    subgraph "Webhook Entry"
        WH[GHL Webhook] -->|"Phone, Message, ContactId"| API[langgraph-api.js]
        API -->|Deduplication Check| DUP{Duplicate?}
        DUP -->|Yes| SKIP[Return 200 - Skip]
        DUP -->|No| LOCK{Request Lock}
        LOCK -->|Busy| BUSY[Return - Already Processing]
        LOCK -->|Available| WH_HANDLER[webhookHandler.js]
    end

    subgraph "State Management"
        WH_HANDLER --> CM[ConversationManager]
        CM -->|Fetch History| GHL_HIST[(GHL Messages)]
        CM -->|Filter JSONs| CLEAN[Clean Messages]
        CLEAN --> STATE{{"leadInfo State
        • name
        • problem
        • goal
        • budget
        • email"}}
    end

    subgraph "Sales Agent Processing"
        STATE --> AGENT[salesAgent.js]
        AGENT -->|getCurrentTaskInput()| TOOLS

        subgraph TOOLS["Tool Execution"]
            EXT[extractLeadInfo]
            SEND[sendGHLMessage]
            UPDATE[updateGHLContact]
            CAL[getCalendarSlots]
            BOOK[bookAppointment]
        end

        EXT -->|"Merges with existing leadInfo"| STATE
    end

    subgraph "7-Step Qualification Flow"
        STEP1[1. Greeting - Ask Name]
        STEP2[2. Name → Ask Problem]
        STEP3[3. Problem → Ask Goal]
        STEP4[4. Goal → Ask Budget]
        STEP5[5. Budget → Qualify]
        STEP6[6. Email → Show Calendar]
        STEP7[7. Selection → Book Appointment]

        STEP1 -->|"Hola → Soy Jaime"| STEP2
        STEP2 -->|"Necesito clientes"| STEP3
        STEP3 -->|"Aumentar 50%"| STEP4
        STEP4 -->|"500 al mes"| STEP5
        STEP5 -->|">= $300"| STEP6
        STEP5 -->|"< $300"| NURTURE[Tag: nurture-lead]
        STEP6 -->|"jaime@rest.com"| STEP7
        STEP7 -->|"Martes 11am"| COMPLETE[✓ Appointment Booked]
    end

    subgraph "Tool Details"
        AGENT --> T1{Which Tool?}
        T1 -->|Message Received| EXT
        T1 -->|Ready to Respond| SEND
        T1 -->|Update Customer| UPDATE
        T1 -->|Show Slots| CAL
        T1 -->|Book Time| BOOK

        EXT -->|"Access State via
        getCurrentTaskInput()"| CONTEXT[Current Context]
        CONTEXT -->|Merge| MERGED[Merged leadInfo]
        MERGED --> AGENT
    end

    subgraph "GHL Updates"
        UPDATE -->|Tags| TAGS["• qualified-lead
        • budget-300-plus
        • business:restaurant
        • needs-marketing
        • appointment-scheduled"]
        
        UPDATE -->|Custom Fields| FIELDS["• verified_name
        • goal
        • budget
        • business_type"]
        
        UPDATE -->|Notes| NOTES["[Timestamp] Update
        • What extracted
        • Current state
        • Next step"]
    end

    style WH fill:#e1f5fe
    style AGENT fill:#c8e6c9
    style STATE fill:#fff9c4
    style COMPLETE fill:#81c784
    style NURTURE fill:#ffab91
    style EXT fill:#b39ddb
    style SEND fill:#b39ddb
    style UPDATE fill:#b39ddb
    style CAL fill:#b39ddb
    style BOOK fill:#b39ddb
```

## Key Features Shown

1. **Webhook Processing**
   - Deduplication (MD5 hash)
   - Request locking
   - Message filtering

2. **State Management**
   - leadInfo tracked throughout
   - getCurrentTaskInput() for context
   - Automatic merging

3. **7-Step Flow**
   - Complete qualification process
   - Budget-based routing
   - Clear progression

4. **Tool Integration**
   - 5 main tools
   - State-aware execution
   - GHL updates at each step

5. **Context Preservation**
   - Tools access current state
   - Merged data returned
   - No repeated questions