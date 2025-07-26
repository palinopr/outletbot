/**
 * Request and response validation schemas using Zod
 */
import { z } from 'zod';

// Phone number validation (E.164 format)
const phoneSchema = z.string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
  .transform(val => {
    // Ensure + prefix
    return val.startsWith('+') ? val : `+${val}`;
  });

// Contact ID validation
const contactIdSchema = z.string()
  .min(1, 'Contact ID is required')
  .max(50, 'Contact ID too long');

// Message validation
const messageSchema = z.string()
  .min(1, 'Message cannot be empty')
  .max(4096, 'Message too long');

// Webhook request schema
export const webhookRequestSchema = z.object({
  phone: phoneSchema,
  message: messageSchema,
  contactId: contactIdSchema,
  conversationId: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  type: z.enum(['WhatsApp', 'SMS', 'TYPE_PHONE']).optional(),
  direction: z.enum(['inbound', 'outbound']).optional()
});

// Lead info schema
export const leadInfoSchema = z.object({
  name: z.string().optional().nullable(),
  businessType: z.string().optional().nullable(),
  problem: z.string().optional().nullable(),
  goal: z.string().optional().nullable(),
  budget: z.number().min(0).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: phoneSchema.optional().nullable()
});

// Calendar slot schema
export const calendarSlotSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  date: z.string().optional(),
  id: z.string().optional(),
  display: z.string().optional()
});

// Appointment booking schema
export const appointmentSchema = z.object({
  calendarId: z.string().min(1),
  contactId: contactIdSchema,
  title: z.string().min(1).max(200),
  appointmentStatus: z.enum(['confirmed', 'pending', 'cancelled']).default('confirmed'),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  toNotify: z.boolean().default(true)
});

// GHL contact update schema
export const contactUpdateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: phoneSchema.optional(),
  companyName: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.string()).optional()
});

// Tool response schemas
export const toolResponseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('success'),
    success: z.literal(true),
    data: z.any().optional()
  }),
  z.object({
    type: z.literal('error'),
    success: z.literal(false),
    error: z.string(),
    details: z.any().optional()
  })
]);

// Agent state schema
export const agentStateSchema = z.object({
  messages: z.array(z.any()), // Would be better with proper message schema
  leadInfo: leadInfoSchema.optional(),
  contactId: contactIdSchema.optional(),
  phone: phoneSchema.optional(),
  conversationId: z.string().optional()
});

// API response schemas
export const apiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime()
});

// Health check response schema
export const healthCheckSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string().datetime(),
  version: z.string(),
  environment: z.string(),
  latency: z.number(),
  dependencies: z.object({
    openai: z.object({
      status: z.enum(['healthy', 'unhealthy']),
      latency: z.number().optional(),
      message: z.string(),
      error: z.string().optional()
    }),
    ghl: z.object({
      status: z.enum(['healthy', 'unhealthy']),
      latency: z.number().optional(),
      message: z.string(),
      error: z.string().optional(),
      circuitBreaker: z.enum(['open', 'closed']).optional()
    }),
    checkpointer: z.object({
      status: z.enum(['healthy', 'unhealthy']),
      latency: z.number().optional(),
      message: z.string(),
      error: z.string().optional()
    }),
    environment: z.object({
      status: z.enum(['healthy', 'unhealthy']),
      message: z.string(),
      missing: z.array(z.string()).optional()
    })
  }),
  system: z.object({
    memory: z.object({
      rss: z.string(),
      heapTotal: z.string(),
      heapUsed: z.string(),
      external: z.string()
    }),
    uptime: z.object({
      seconds: z.number(),
      formatted: z.string()
    }),
    nodeVersion: z.string(),
    platform: z.string(),
    pid: z.number()
  }),
  features: z.record(z.boolean())
});

/**
 * Validation middleware factory
 */
export function validateRequest(schema) {
  return async (req, res, next) => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.validatedBody = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors,
          timestamp: new Date().toISOString()
        });
      }
      throw error;
    }
  };
}

/**
 * Validate response data
 */
export function validateResponse(schema, data) {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Response validation failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Safe parse with error details
 */
export function safeParse(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.format(),
    issues: result.error.issues
  };
}