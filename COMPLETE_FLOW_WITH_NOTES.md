# Complete WhatsApp Bot Flow with GHL Updates

## Overview
Every customer message triggers 3 actions:
1. Extract information from message
2. Send response via WhatsApp
3. Update GHL (tags, custom fields, and notes)

## Detailed Flow with GHL Updates

### 1. Initial Contact
**Customer**: "Hola"

**Bot Actions**:
1. Extract info → No data found
2. Send message → "¡Hola! Soy María, tu asistente de ventas con IA. ¿Cuál es tu nombre?"
3. Update GHL:
   - Note: "[2025-01-25 4:15 PM] Initial contact. Customer greeted. Asked for name."

---

### 2. Name Collection
**Customer**: "Soy Jaime"

**Bot Actions**:
1. Extract info → name: "Jaime"
2. Send message → "Mucho gusto Jaime. ¿En qué puedo ayudarte hoy?"
3. Update GHL:
   - Custom field: verified_name = "Jaime"
   - Note: "[2025-01-25 4:16 PM] Customer identified as Jaime. Moving to problem discovery."

---

### 3. Problem Discovery
**Customer**: "Necesito más clientes para mi restaurante"

**Bot Actions**:
1. Extract info → problem: "Necesito más clientes", businessType: "RESTAURANTE"
2. Send message → "Entiendo, un restaurante. ¿Cuál es tu meta específica?"
3. Update GHL:
   - Custom fields:
     - goal = "Necesito más clientes para mi restaurante"
     - business_type = "RESTAURANTE"
   - Tags: "business:restaurant", "needs-marketing"
   - Note: "[2025-01-25 4:17 PM] Business: Restaurant. Problem: Needs more customers. Asked about goals."

---

### 4. Goal Setting
**Customer**: "Quiero aumentar ventas 50% en 3 meses"

**Bot Actions**:
1. Extract info → goal: "Aumentar ventas 50%"
2. Send message → "Excelente meta. ¿Cuál es tu presupuesto mensual para marketing?"
3. Update GHL:
   - Custom field: goal = "Aumentar ventas 50% en 3 meses"
   - Tag: "goal:sales-increase"
   - Note: "[2025-01-25 4:18 PM] Goal: Increase sales 50% in 3 months. Moving to budget qualification."

---

### 5. Budget Qualification
**Customer**: "Tengo como 500 al mes"

**Bot Actions**:
1. Extract info → budget: 500
2. Send message → "Perfecto, $500/mes nos permite hacer mucho. ¿Cuál es tu email?"
3. Update GHL:
   - Custom field: budget = "500"
   - Tags: "qualified-lead", "budget:500", "budget-300-plus"
   - Note: "[2025-01-25 4:19 PM] QUALIFIED LEAD! Budget: $500/month. Proceeding to email collection."

---

### 6. Email Collection
**Customer**: "jaime@mirestaurante.com"

**Bot Actions**:
1. Extract info → email: "jaime@mirestaurante.com"
2. Fetch calendar slots
3. Send message → "Perfecto! Tengo estos horarios disponibles: [calendar slots]"
4. Update GHL:
   - Standard field: email = "jaime@mirestaurante.com"
   - Custom field: All qualification data complete
   - Note: "[2025-01-25 4:20 PM] Email collected. Showing calendar availability."

---

### 7. Appointment Booking
**Customer**: "El martes a las 11"

**Bot Actions**:
1. Parse selection → Slot #3 (Tuesday 11 AM)
2. Book appointment in GHL
3. Send message → "¡Perfecto! Tu cita está confirmada para el Martes 4 de febrero a las 11:00 AM"
4. Update GHL:
   - Tag: "appointment-scheduled"
   - Note: "[2025-01-25 4:21 PM] APPOINTMENT BOOKED! Tuesday Feb 4, 11:00 AM. Lead fully qualified and scheduled."

---

## Final GHL Contact Record

### Standard Fields
- firstName: "Jaime"
- email: "jaime@mirestaurante.com"
- companyName: "Mi Restaurante"

### Custom Fields
- goal: "Necesito más clientes para mi restaurante"
- budget: "500"
- business_type: "RESTAURANTE"
- verified_name: "Jaime"

### Tags
- qualified-lead
- budget:500
- budget-300-plus
- business:restaurant
- needs-marketing
- goal:sales-increase
- appointment-scheduled

### Notes Timeline
```
[2025-01-25 4:21 PM] APPOINTMENT BOOKED! Tuesday Feb 4, 11:00 AM. Lead fully qualified and scheduled.

[2025-01-25 4:20 PM] Email collected. Showing calendar availability.

[2025-01-25 4:19 PM] QUALIFIED LEAD! Budget: $500/month. Proceeding to email collection.

[2025-01-25 4:18 PM] Goal: Increase sales 50% in 3 months. Moving to budget qualification.

[2025-01-25 4:17 PM] Business: Restaurant. Problem: Needs more customers. Asked about goals.

[2025-01-25 4:16 PM] Customer identified as Jaime. Moving to problem discovery.

[2025-01-25 4:15 PM] Initial contact. Customer greeted. Asked for name.
```

## Summary
- **Total Messages**: 7 exchanges
- **Time**: ~6 minutes
- **Result**: Fully qualified lead with appointment
- **GHL Updates**: 7 notes, 7 tags, 4 custom fields, email captured
- **Ready for**: Sales team follow-up with complete context