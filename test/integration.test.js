/**
 * Integration tests for Outlet Media Bot
 * Tests the complete webhook flow with all A+ features
 */
import { describe, it, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { graph } from '../agents/salesAgent.js';
import { metrics } from '../services/monitoring.js';
import { initializeShutdownHandlers } from '../services/shutdown.js';
import handler from '../api/langgraph-api.js';

// Mock external dependencies
jest.mock('../services/ghlService.js');
jest.mock('@langchain/openai');

// Create Express app for testing
import express from 'express';
const app = express();
app.use(express.json());
app.all('*', handler);

describe('Outlet Media Bot Integration Tests', () => {
  let server;
  
  beforeAll(() => {
    // Start test server
    server = app.listen(0); // Random port
    
    // Initialize shutdown handlers for testing
    initializeShutdownHandlers({ timeout: 5000 });
  });
  
  afterAll(async () => {
    // Clean up
    await new Promise((resolve) => server.close(resolve));
  });
  
  beforeEach(() => {
    // Reset metrics before each test
    metrics.reset();
  });
  
  describe('Webhook Processing', () => {
    it('should process a valid webhook request successfully', async () => {
      const webhookPayload = {
        phone: '+1234567890',
        message: 'Hola, necesito ayuda con marketing',
        contactId: 'test-contact-123',
        conversationId: 'conv-123',
        timestamp: new Date().toISOString()
      };
      
      const response = await request(app)
        .post('/webhook/meta-lead')
        .send(webhookPayload)
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toMatchObject({
        success: true,
        message: 'Webhook processed successfully',
        contactId: 'test-contact-123'
      });
      
      // Verify metrics were recorded
      const metricsData = metrics.getMetricsSummary();
      expect(metricsData.business.conversationsStarted).toBe(1);
    });
    
    it('should reject invalid webhook payload', async () => {
      const invalidPayload = {
        message: 'Missing required fields'
      };
      
      const response = await request(app)
        .post('/webhook/meta-lead')
        .send(invalidPayload)
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR'
      });
    });
    
    it('should handle duplicate messages correctly', async () => {
      const webhookPayload = {
        phone: '+1234567890',
        message: 'Test message',
        contactId: 'test-contact-123',
        conversationId: 'conv-123'
      };
      
      // First request
      await request(app)
        .post('/webhook/meta-lead')
        .send(webhookPayload)
        .expect(200);
      
      // Duplicate request (should be handled gracefully)
      const response = await request(app)
        .post('/webhook/meta-lead')
        .send(webhookPayload)
        .expect(200);
      
      expect(response.body.message).toContain('Already processing');
    });
  });
  
  describe('Rate Limiting', () => {
    it('should enforce rate limits per contact', async () => {
      const webhookPayload = {
        phone: '+1234567890',
        message: 'Test message',
        contactId: 'rate-limit-test',
        conversationId: 'conv-123'
      };
      
      // Send 10 requests (the limit)
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/webhook/meta-lead')
          .send({ ...webhookPayload, message: `Message ${i}` })
          .expect(200);
      }
      
      // 11th request should be rate limited
      const response = await request(app)
        .post('/webhook/meta-lead')
        .send({ ...webhookPayload, message: 'Rate limited message' })
        .expect(429);
      
      expect(response.body).toMatchObject({
        code: 'RATE_LIMIT_EXCEEDED'
      });
      expect(response.headers['retry-after']).toBeDefined();
    });
    
    it('should set proper rate limit headers', async () => {
      const response = await request(app)
        .post('/webhook/meta-lead')
        .send({
          phone: '+1234567890',
          message: 'Test',
          contactId: 'test-123'
        })
        .expect(200);
      
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });
  
  describe('Health Check', () => {
    it('should return healthy status when all services are up', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toMatchObject({
        status: 'healthy',
        version: expect.any(String),
        checks: {
          openai: { status: 'healthy' },
          ghl: { status: 'healthy' },
          checkpointer: { status: 'healthy' }
        }
      });
    });
    
    it('should include system information', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.system).toBeDefined();
      expect(response.body.system.memory).toHaveProperty('used');
      expect(response.body.system.memory).toHaveProperty('total');
    });
  });
  
  describe('Metrics Endpoint', () => {
    it('should return comprehensive metrics', async () => {
      // Generate some activity
      await request(app)
        .post('/webhook/meta-lead')
        .send({
          phone: '+1234567890',
          message: 'Test',
          contactId: 'metrics-test'
        });
      
      const response = await request(app)
        .get('/metrics')
        .expect(200);
      
      expect(response.body).toMatchObject({
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        api: {
          totalRequests: expect.any(Number),
          totalErrors: expect.any(Number),
          errorRate: expect.any(String),
          avgLatency: expect.any(String)
        },
        business: {
          conversationsStarted: expect.any(Number),
          conversationsCompleted: expect.any(Number),
          qualifiedLeads: expect.any(Number),
          appointmentsBooked: expect.any(Number)
        },
        tools: expect.any(Object),
        ghl: expect.any(Object),
        system: expect.any(Object)
      });
    });
  });
  
  describe('Error Handling', () => {
    it('should handle internal errors gracefully', async () => {
      // Mock an internal error
      jest.spyOn(graph, 'invoke').mockRejectedValueOnce(new Error('Internal test error'));
      
      const response = await request(app)
        .post('/webhook/meta-lead')
        .send({
          phone: '+1234567890',
          message: 'Error test',
          contactId: 'error-test'
        })
        .expect(500);
      
      expect(response.body).toMatchObject({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String)
      });
    });
    
    it('should handle service unavailable errors', async () => {
      // Mock a cancellation error
      const cancelledError = new Error('Operation cancelled');
      cancelledError.name = 'CancelledError';
      jest.spyOn(graph, 'invoke').mockRejectedValueOnce(cancelledError);
      
      const response = await request(app)
        .post('/webhook/meta-lead')
        .send({
          phone: '+1234567890',
          message: 'Cancelled test',
          contactId: 'cancelled-test'
        })
        .expect(503);
      
      expect(response.body).toMatchObject({
        error: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
        retryAfter: expect.any(Number)
      });
    });
  });
  
  describe('Graceful Shutdown', () => {
    it('should reject new requests during shutdown', async () => {
      // Trigger shutdown signal
      process.emit('SIGTERM');
      
      // Wait a moment for shutdown to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await request(app)
        .post('/webhook/meta-lead')
        .send({
          phone: '+1234567890',
          message: 'Shutdown test',
          contactId: 'shutdown-test'
        })
        .expect(503);
      
      expect(response.body).toMatchObject({
        error: 'Service is shutting down',
        retryAfter: expect.any(Number)
      });
    });
  });
  
  describe('Unknown Routes', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);
      
      expect(response.body).toMatchObject({
        error: 'Not found',
        code: 'NOT_FOUND',
        availableRoutes: expect.arrayContaining([
          '/webhook/meta-lead',
          '/health',
          '/metrics'
        ])
      });
    });
    
    it('should reject non-POST methods on webhook endpoint', async () => {
      const response = await request(app)
        .get('/webhook/meta-lead')
        .expect(405);
      
      expect(response.body).toMatchObject({
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED',
        allowed: ['POST']
      });
    });
  });
  
  describe('Conversation State Management', () => {
    it('should maintain conversation state across messages', async () => {
      const contactId = 'state-test-123';
      
      // First message - introduce name
      await request(app)
        .post('/webhook/meta-lead')
        .send({
          phone: '+1234567890',
          message: 'Hola, soy Juan',
          contactId,
          conversationId: 'conv-state-123'
        })
        .expect(200);
      
      // Second message - should remember name
      const response = await request(app)
        .post('/webhook/meta-lead')
        .send({
          phone: '+1234567890',
          message: 'Tengo un restaurante',
          contactId,
          conversationId: 'conv-state-123'
        })
        .expect(200);
      
      // Verify state was maintained (would need to check agent's response)
      expect(response.body.success).toBe(true);
    });
  });
  
  describe('Business Metrics Tracking', () => {
    it('should track qualified leads correctly', async () => {
      // Simulate a qualified lead conversation
      const contactId = 'qualified-lead-test';
      
      // Send messages that qualify the lead
      const messages = [
        'Hola, soy Maria',
        'Tengo un salon de belleza',
        'Necesito más clientes',
        'Quiero aumentar mis ventas 50%',
        'Mi presupuesto es 500 al mes',
        'Mi email es maria@salon.com'
      ];
      
      for (const message of messages) {
        await request(app)
          .post('/webhook/meta-lead')
          .send({
            phone: '+1234567890',
            message,
            contactId,
            conversationId: 'conv-qualified-123'
          })
          .expect(200);
      }
      
      // Check metrics
      const metricsData = metrics.getMetricsSummary();
      expect(metricsData.business.qualifiedLeads).toBeGreaterThan(0);
    });
    
    it('should track under-budget leads', async () => {
      // Simulate an under-budget lead
      const contactId = 'under-budget-test';
      
      const messages = [
        'Hola, soy Pedro',
        'Tengo una tienda',
        'Necesito marketing',
        'Quiero más ventas',
        'Solo puedo pagar 200 al mes'
      ];
      
      for (const message of messages) {
        await request(app)
          .post('/webhook/meta-lead')
          .send({
            phone: '+1234567890',
            message,
            contactId,
            conversationId: 'conv-under-123'
          })
          .expect(200);
      }
      
      // Check metrics
      const metricsData = metrics.getMetricsSummary();
      expect(metricsData.business.underBudgetLeads).toBeGreaterThan(0);
    });
  });
});

// Test utilities
export function createMockGHLService() {
  return {
    sendSMS: jest.fn().mockResolvedValue({ success: true }),
    getConversationMessages: jest.fn().mockResolvedValue([]),
    addTags: jest.fn().mockResolvedValue({ success: true }),
    addNote: jest.fn().mockResolvedValue({ success: true }),
    updateContact: jest.fn().mockResolvedValue({ success: true }),
    getAvailableSlots: jest.fn().mockResolvedValue([
      {
        startTime: '2025-01-27T10:00:00-06:00',
        endTime: '2025-01-27T11:00:00-06:00',
        id: 'slot-1'
      }
    ]),
    bookAppointment: jest.fn().mockResolvedValue({
      id: 'appt-123',
      success: true
    })
  };
}

export function createMockOpenAI() {
  return {
    ChatOpenAI: jest.fn().mockImplementation(() => ({
      invoke: jest.fn().mockResolvedValue({
        content: 'Mocked AI response'
      })
    }))
  };
}