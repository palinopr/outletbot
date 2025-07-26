/**
 * Test Data Fixtures for Various Scenarios
 * @module test-fixtures
 */

export const testContacts = {
  // New lead - no previous history
  newLead: {
    contactId: 'test-new-lead-001',
    phone: '+12145551234',
    name: null,
    businessType: null,
    problem: null,
    goal: null,
    budget: null,
    email: null
  },
  
  // Returning customer with partial info
  returningPartial: {
    contactId: 'test-return-001',
    phone: '+12145552345',
    name: 'Maria Garcia',
    businessType: 'salon',
    problem: null,
    goal: null,
    budget: null,
    email: null
  },
  
  // Qualified lead missing email
  qualifiedNoEmail: {
    contactId: 'test-qualified-001',
    phone: '+12145553456',
    name: 'Roberto Martinez',
    businessType: 'restaurant',
    problem: 'pocas ventas los martes',
    goal: 'aumentar clientes 40%',
    budget: 450,
    email: null
  },
  
  // Under budget lead
  underBudget: {
    contactId: 'test-under-001',
    phone: '+12145554567',
    name: 'Ana Lopez',
    businessType: 'tienda',
    problem: 'competencia fuerte',
    goal: 'más visibilidad',
    budget: 150,
    email: 'ana@tienda.com'
  },
  
  // Complete lead ready for booking
  readyToBook: {
    contactId: 'test-complete-001',
    phone: '+12145555678',
    name: 'Carlos Mendez',
    businessType: 'clinica dental',
    problem: 'pocos pacientes nuevos',
    goal: 'crecer 50% en 6 meses',
    budget: 800,
    email: 'carlos@clinicamendez.com'
  }
};

export const conversationScenarios = {
  // Happy path - complete flow
  happyPath: [
    {
      message: "hola",
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedTags: [],
      expectedResponse: /hola.*nombre/i
    },
    {
      message: "soy Juan y tengo una pizzería",
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedTags: ['name-collected', 'business-identified'],
      expectedResponse: /Juan.*problema|necesita/i
    },
    {
      message: "necesito más clientes, especialmente los fines de semana",
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedTags: ['problem-identified'],
      expectedResponse: /meta|objetivo|lograr/i
    },
    {
      message: "quiero duplicar mis ventas en 3 meses",
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedTags: ['goal-identified'],
      expectedResponse: /presupuesto|invertir|mensual/i
    },
    {
      message: "puedo invertir unos 600 dólares al mes",
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedTags: ['qualified-lead', 'budget-300-plus'],
      expectedResponse: /email|correo/i
    },
    {
      message: "mi correo es juan@pizzeriajuan.com",
      expectedTools: ['extract_lead_info', 'get_calendar_slots', 'send_ghl_message', 'update_ghl_contact'],
      expectedTags: ['email-collected'],
      expectedResponse: /disponible|horario|cita/i
    },
    {
      message: "el jueves a las 3pm me va bien",
      expectedTools: ['parse_time_selection', 'book_appointment', 'send_ghl_message', 'update_ghl_contact'],
      expectedTags: ['appointment-scheduled', 'appointment-booked'],
      expectedResponse: /confirmada|agendada/i
    }
  ],
  
  // Budget rejection flow
  budgetRejection: [
    {
      message: "hola, necesito ayuda con marketing",
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedResponse: /hola.*nombre/i
    },
    {
      message: "soy Pedro, tengo una barbería",
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedResponse: /Pedro.*problema/i
    },
    {
      message: "no tengo suficientes clientes",
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedResponse: /meta|objetivo/i
    },
    {
      message: "quiero tener más clientes regulares",
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedResponse: /presupuesto|invertir/i
    },
    {
      message: "solo puedo gastar como 100 dólares",
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedTags: ['under-budget', 'nurture-lead'],
      expectedResponse: /mínimo|300|contacto/i
    }
  ],
  
  // Returning customer flow
  returningCustomer: [
    {
      message: "hola, ya hablamos antes",
      existingInfo: {
        name: "Sofia Ramirez",
        businessType: "spa",
        problem: "poca visibilidad online"
      },
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedResponse: /Sofia.*meta|objetivo/i
    },
    {
      message: "quiero ser el spa número 1 de la ciudad",
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedResponse: /presupuesto|invertir/i
    },
    {
      message: "ahora puedo invertir 1000 al mes",
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedResponse: /email|correo/i
    }
  ],
  
  // Edge cases
  edgeCases: [
    {
      name: "Mixed language",
      message: "Hi, I mean hola, soy Michael",
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedResponse: /Michael/i
    },
    {
      name: "Typos and misspellings",
      message: "ola me yamo jorge tengo resturante",
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedResponse: /jorge|Jorge/i
    },
    {
      name: "Multiple pieces of info",
      message: "soy Laura, tengo una floristería, necesito más clientes y puedo gastar 400 al mes",
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedResponse: /email|correo/i
    },
    {
      name: "Unclear budget",
      message: "puedo gastar entre 200 y 400 dependiendo",
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedResponse: /300|mínimo|email/i
    },
    {
      name: "Change of mind",
      message: "pensándolo bien, mejor 500 al mes",
      expectedTools: ['extract_lead_info', 'send_ghl_message', 'update_ghl_contact'],
      expectedResponse: /email|correo/i
    }
  ]
};

export const calendarSlots = {
  // Mock calendar slots for testing
  available: [
    {
      id: 'slot-001',
      startTime: '2025-01-29T10:00:00-06:00',
      endTime: '2025-01-29T11:00:00-06:00',
      staffId: 'staff-001'
    },
    {
      id: 'slot-002', 
      startTime: '2025-01-29T14:00:00-06:00',
      endTime: '2025-01-29T15:00:00-06:00',
      staffId: 'staff-001'
    },
    {
      id: 'slot-003',
      startTime: '2025-01-30T09:00:00-06:00',
      endTime: '2025-01-30T10:00:00-06:00',
      staffId: 'staff-001'
    },
    {
      id: 'slot-004',
      startTime: '2025-01-30T16:00:00-06:00',
      endTime: '2025-01-30T17:00:00-06:00',
      staffId: 'staff-001'
    },
    {
      id: 'slot-005',
      startTime: '2025-01-31T11:00:00-06:00',
      endTime: '2025-01-31T12:00:00-06:00',
      staffId: 'staff-001'
    }
  ],
  
  // Formatted slots as they would appear to user
  formatted: [
    { index: 1, display: 'Miércoles 29 de enero a las 10:00 AM', startTime: '2025-01-29T10:00:00-06:00', endTime: '2025-01-29T11:00:00-06:00' },
    { index: 2, display: 'Miércoles 29 de enero a las 2:00 PM', startTime: '2025-01-29T14:00:00-06:00', endTime: '2025-01-29T15:00:00-06:00' },
    { index: 3, display: 'Jueves 30 de enero a las 9:00 AM', startTime: '2025-01-30T09:00:00-06:00', endTime: '2025-01-30T10:00:00-06:00' },
    { index: 4, display: 'Jueves 30 de enero a las 4:00 PM', startTime: '2025-01-30T16:00:00-06:00', endTime: '2025-01-30T17:00:00-06:00' },
    { index: 5, display: 'Viernes 31 de enero a las 11:00 AM', startTime: '2025-01-31T11:00:00-06:00', endTime: '2025-01-31T12:00:00-06:00' }
  ]
};

export const timeSelectionTests = [
  {
    userMessage: "el miércoles a las 10",
    slots: calendarSlots.formatted,
    expectedIndex: 1
  },
  {
    userMessage: "prefiero el jueves en la mañana",
    slots: calendarSlots.formatted,
    expectedIndex: 3
  },
  {
    userMessage: "el 4",
    slots: calendarSlots.formatted,
    expectedIndex: 4
  },
  {
    userMessage: "la opción 2 está bien",
    slots: calendarSlots.formatted,
    expectedIndex: 2
  },
  {
    userMessage: "viernes",
    slots: calendarSlots.formatted,
    expectedIndex: 5
  },
  {
    userMessage: "cualquiera está bien",
    slots: calendarSlots.formatted,
    expectedIndex: 0 // Should fail to parse
  }
];

export const mockGHLResponses = {
  // Mock conversation history
  conversationHistory: {
    messages: [
      {
        id: 'msg-001',
        conversationId: 'conv-001',
        type: 'TYPE_WHATSAPP',
        direction: 'inbound',
        status: 'delivered',
        body: 'hola necesito ayuda',
        dateAdded: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'msg-002',
        conversationId: 'conv-001',
        type: 'TYPE_WHATSAPP',
        direction: 'outbound',
        status: 'delivered', 
        body: '¡Hola! Soy María de Outlet Media. ¿Cuál es tu nombre?',
        dateAdded: new Date(Date.now() - 3500000).toISOString()
      }
    ]
  },
  
  // Mock contact data
  contact: {
    id: 'contact-001',
    firstName: 'Test',
    lastName: 'User',
    phone: '+12145551234',
    email: null,
    tags: ['webhook-test'],
    customFields: {
      verifiedName: null,
      businessType: null,
      budget: null,
      goal: null
    }
  },
  
  // Mock calendar response
  calendar: {
    '2025-01-29': {
      slots: [
        '2025-01-29T10:00:00-06:00',
        '2025-01-29T14:00:00-06:00'
      ]
    },
    '2025-01-30': {
      slots: [
        '2025-01-30T09:00:00-06:00',
        '2025-01-30T16:00:00-06:00'
      ]
    },
    '2025-01-31': {
      slots: [
        '2025-01-31T11:00:00-06:00'
      ]
    }
  }
};

export const validationTests = {
  // Valid payloads
  valid: [
    {
      name: "Complete payload",
      payload: {
        phone: '+12145551234',
        message: 'hola',
        contactId: 'contact-001',
        conversationId: 'conv-001'
      }
    },
    {
      name: "Minimal payload",
      payload: {
        phone: '+12145551234',
        message: 'test',
        contactId: 'contact-001'
      }
    }
  ],
  
  // Invalid payloads
  invalid: [
    {
      name: "Missing phone",
      payload: {
        message: 'test',
        contactId: 'contact-001'
      },
      expectedError: 'Missing required fields'
    },
    {
      name: "Missing message",
      payload: {
        phone: '+12145551234',
        contactId: 'contact-001'
      },
      expectedError: 'Missing required fields'
    },
    {
      name: "Missing contactId",
      payload: {
        phone: '+12145551234',
        message: 'test'
      },
      expectedError: 'Missing required fields'
    },
    {
      name: "Empty payload",
      payload: {},
      expectedError: 'Missing required fields'
    }
  ]
};

export default {
  testContacts,
  conversationScenarios,
  calendarSlots,
  timeSelectionTests,
  mockGHLResponses,
  validationTests
};