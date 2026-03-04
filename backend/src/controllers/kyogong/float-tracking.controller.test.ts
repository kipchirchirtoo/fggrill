/**
 * Bug Condition Exploration Test for Kyogong Shift Float 404 Fix
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * 
 * Property 1: Fault Condition - Float Endpoint Returns Data
 * For any GET request to /api/kyogong/shifts/{shift_id}/float where the shift_id 
 * is a valid UUID and the user is authenticated with appropriate role, the system 
 * SHALL return a 200 response with float data including currentFloat, openingFloat, 
 * expectedClosingCash, and lastUpdated.
 * 
 * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS with 404 errors
 * EXPECTED OUTCOME ON FIXED CODE: Test PASSES with 200 responses
 */

// Set up environment variables BEFORE any imports
process.env.SUPABASE_PROJECT_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.SUPABASE_JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

import request from 'supertest';
import express from 'express';

// Mock supabase BEFORE importing anything that uses it
jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn()
  }
}));

// Mock database config to prevent connection attempts
jest.mock('../../config/database', () => ({
  supabase: {
    from: jest.fn()
  },
  connectDB: jest.fn()
}));

// Mock auth middleware BEFORE importing routes
jest.mock('../../middleware/auth', () => ({
  protect: jest.fn((req, res, next) => {
    // Simulate authenticated user with CASHIER role
    (req as any).user = {
      id: 'test-user-id',
      role: 'CASHIER',
      branch_id: 1
    };
    next();
  }),
  authorize: jest.fn((roles) => (req: any, res: any, next: any) => {
    // Always allow for testing - we're testing route matching, not authorization
    next();
  })
}));

// Now import after mocks are set up
import { supabase } from '../../config/supabase';
import kyogongRoutes from '../../routes/kyogong.routes';

// Mock console to reduce noise
const originalConsole = global.console;
beforeAll(() => {
  global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn()
  };
});

afterAll(() => {
  global.console = originalConsole;
});

describe('Bug Condition Exploration: Float Endpoint 404 Error', () => {
  let app: express.Application;

  beforeAll(() => {
    // Create Express app with kyogong routes mounted
    app = express();
    app.use(express.json());
    app.use('/api/kyogong', kyogongRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 1: Fault Condition - Float Endpoint Returns Data', () => {
    const mockShiftData = {
      id: '60c1793d-8e80-42a0-b7a8-2910808f9a6c',
      current_float: 5000.00,
      opening_cash_float: 5000.00,
      expected_cash: 5000.00,
      last_float_update: '2024-01-15T10:00:00Z',
      status: 'OPEN'
    };

    it('should return 200 with float data for valid shift ID (Example 1)', async () => {
      // Mock Supabase response
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockShiftData,
            error: null
          })
        })
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect
      });

      // Make request to float endpoint
      const response = await request(app)
        .get(`/api/kyogong/shifts/${mockShiftData.id}/float`)
        .expect('Content-Type', /json/);

      // EXPECTED ON UNFIXED CODE: 404 (route not matched)
      // EXPECTED ON FIXED CODE: 200 (route matched correctly)
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('currentFloat');
      expect(response.body.data).toHaveProperty('openingFloat');
      expect(response.body.data).toHaveProperty('expectedClosingCash');
      expect(response.body.data).toHaveProperty('lastUpdated');
      expect(response.body.data.currentFloat).toBe(5000.00);
      expect(response.body.data.openingFloat).toBe(5000.00);
    });

    it('should return 200 with float data for different valid shift ID (Example 2)', async () => {
      const differentShiftData = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        current_float: 3500.50,
        opening_cash_float: 3000.00,
        expected_cash: 3500.50,
        last_float_update: '2024-01-15T14:30:00Z',
        status: 'ACTIVE'
      };

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: differentShiftData,
            error: null
          })
        })
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect
      });

      const response = await request(app)
        .get(`/api/kyogong/shifts/${differentShiftData.id}/float`)
        .expect('Content-Type', /json/);

      // EXPECTED ON UNFIXED CODE: 404 (route not matched)
      // EXPECTED ON FIXED CODE: 200 (route matched correctly)
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.currentFloat).toBe(3500.50);
      expect(response.body.data.openingFloat).toBe(3000.00);
    });

    it('should return 200 with float data for shift with transactions (Example 3)', async () => {
      const shiftWithTransactions = {
        id: '12345678-1234-1234-1234-123456789abc',
        current_float: 7250.75,
        opening_cash_float: 5000.00,
        expected_cash: 7250.75,
        last_float_update: '2024-01-15T16:45:00Z',
        status: 'OPEN'
      };

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: shiftWithTransactions,
            error: null
          })
        })
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect
      });

      const response = await request(app)
        .get(`/api/kyogong/shifts/${shiftWithTransactions.id}/float`)
        .expect('Content-Type', /json/);

      // EXPECTED ON UNFIXED CODE: 404 (route not matched)
      // EXPECTED ON FIXED CODE: 200 (route matched correctly)
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.currentFloat).toBe(7250.75);
      expect(response.body.data.expectedClosingCash).toBe(7250.75);
    });

    it('should return 400 for closed shift (edge case)', async () => {
      const closedShiftData = {
        id: 'closed-shift-id-1234-5678-90ab-cdef',
        current_float: 5000.00,
        opening_cash_float: 5000.00,
        expected_cash: 5000.00,
        last_float_update: '2024-01-15T18:00:00Z',
        status: 'CLOSED'
      };

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: closedShiftData,
            error: null
          })
        })
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect
      });

      const response = await request(app)
        .get(`/api/kyogong/shifts/${closedShiftData.id}/float`)
        .expect('Content-Type', /json/);

      // EXPECTED ON UNFIXED CODE: 404 (route not matched)
      // EXPECTED ON FIXED CODE: 400 (route matched, but shift is closed)
      // This test confirms the route is working and controller logic is executing
      if (response.status === 404) {
        // Bug still exists - route not matched
        expect(response.status).toBe(400); // This will fail, documenting the bug
      } else {
        // Route is working, verify correct error handling
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('closed');
      }
    });

    it('should return 404 for non-existent shift (edge case)', async () => {
      const nonExistentShiftId = 'non-existent-shift-id-1234-5678';

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Shift not found' }
          })
        })
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect
      });

      const response = await request(app)
        .get(`/api/kyogong/shifts/${nonExistentShiftId}/float`)
        .expect('Content-Type', /json/);

      // EXPECTED: 404 in both cases, but for different reasons
      // UNFIXED: 404 because route not matched
      // FIXED: 404 because shift doesn't exist (controller returns 404)
      expect(response.status).toBe(404);
      
      // On fixed code, should have proper error message from controller
      if (response.body.message) {
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('not found');
      }
    });
  });

  describe('Diagnostic: Route Matching Behavior', () => {
    it('should demonstrate route ordering conflict on unfixed code', async () => {
      const shiftId = '60c1793d-8e80-42a0-b7a8-2910808f9a6c';
      
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: shiftId,
              current_float: 5000.00,
              opening_cash_float: 5000.00,
              expected_cash: 5000.00,
              last_float_update: '2024-01-15T10:00:00Z',
              status: 'OPEN'
            },
            error: null
          })
        })
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect
      });

      // Test the float endpoint
      const floatResponse = await request(app)
        .get(`/api/kyogong/shifts/${shiftId}/float`);

      // Test the shift detail endpoint (should work)
      const shiftResponse = await request(app)
        .get(`/api/kyogong/shifts/${shiftId}`);

      console.log('Float endpoint status:', floatResponse.status);
      console.log('Float endpoint body:', floatResponse.body);
      console.log('Shift detail endpoint status:', shiftResponse.status);

      // On unfixed code: float endpoint returns 404, shift detail works
      // On fixed code: both should work (200 or appropriate error)
      
      // This test documents the route ordering conflict
      if (floatResponse.status === 404 && shiftResponse.status !== 404) {
        console.log('BUG CONFIRMED: Route ordering conflict detected');
        console.log('The /shifts/:id route is matching before /shifts/:shift_id/float');
      }

      // The fix should make this pass
      expect(floatResponse.status).not.toBe(404);
    });
  });
});
