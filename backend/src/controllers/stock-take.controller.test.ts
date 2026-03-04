import { sendNotificationWithRetry, buildStockTakeNotificationPayload } from './stock-take.controller';
import notificationService from '../services/notification.service';

// Mock the notification service
jest.mock('../services/notification.service', () => ({
    __esModule: true,
    default: {
        notifyRole: jest.fn()
    }
}));

// Mock supabase completely to avoid initialization
jest.mock('../config/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    single: jest.fn()
                }))
            }))
        }))
    }
}));

// Mock console methods to reduce noise
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn()
};

describe('Stock Take Notification with Retry Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('sendNotificationWithRetry', () => {
        const mockNotification = {
            role: 'auditor' as const,
            title: 'Test Notification',
            message: 'Test message',
            type: 'info' as const,
            category: 'stock_take' as const,
            priority: 'medium' as const,
            actionUrl: '/test',
            metadata: {
                stock_take_id: 'test-id',
                branch_id: 1,
                branch_name: 'Test Branch',
                submission_date: '2024-01-01',
                variance_status: 'balanced' as const,
                total_variance_value: 0
            }
        };

        it('should succeed on first attempt when notification service works', async () => {
            const mockResult = { id: 123 };
            (notificationService.notifyRole as jest.Mock).mockResolvedValue(mockResult);

            const result = await sendNotificationWithRetry(mockNotification, 'test-id', 1);

            expect(result.success).toBe(true);
            expect(result.notificationId).toBe(123);
            expect(notificationService.notifyRole).toHaveBeenCalledTimes(1);
            expect(notificationService.notifyRole).toHaveBeenCalledWith(
                'auditor',
                'Test Notification',
                'Test message',
                expect.objectContaining({
                    type: 'info',
                    category: 'stock_take',
                    priority: 'medium'
                })
            );
        });

        it('should retry once and succeed on second attempt', async () => {
            const mockResult = { id: 456 };
            (notificationService.notifyRole as jest.Mock)
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce(mockResult);

            const result = await sendNotificationWithRetry(mockNotification, 'test-id', 1);

            expect(result.success).toBe(true);
            expect(result.notificationId).toBe(456);
            expect(notificationService.notifyRole).toHaveBeenCalledTimes(2);
        });

        it('should fail after max retries exceeded', async () => {
            (notificationService.notifyRole as jest.Mock)
                .mockRejectedValue(new Error('Service unavailable'));

            const result = await sendNotificationWithRetry(mockNotification, 'test-id', 1);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(notificationService.notifyRole).toHaveBeenCalledTimes(2); // Initial + 1 retry
        });

        it('should fail when notification service returns null', async () => {
            (notificationService.notifyRole as jest.Mock).mockResolvedValue(null);

            const result = await sendNotificationWithRetry(mockNotification, 'test-id', 1);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should use exponential backoff between retries', async () => {
            const mockResult = { id: 789 };
            (notificationService.notifyRole as jest.Mock)
                .mockRejectedValueOnce(new Error('Timeout'))
                .mockResolvedValueOnce(mockResult);

            const startTime = Date.now();
            const result = await sendNotificationWithRetry(mockNotification, 'test-id', 1);
            const duration = Date.now() - startTime;

            expect(result.success).toBe(true);
            // Should have waited at least 1 second (1000ms) for the first retry
            expect(duration).toBeGreaterThanOrEqual(1000);
            expect(notificationService.notifyRole).toHaveBeenCalledTimes(2);
        });
    });

    describe('buildStockTakeNotificationPayload', () => {
        it('should build notification payload with balanced variance', async () => {
            const { supabase } = require('../config/supabase');
            supabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { name: 'Main Branch' },
                            error: null
                        })
                    })
                })
            });

            const result = await buildStockTakeNotificationPayload('stock-123', 1, 0);

            expect(result).not.toBeNull();
            expect(result?.role).toBe('auditor');
            expect(result?.title).toBe('Stock Take Submitted for Review');
            expect(result?.message).toContain('Main Branch');
            expect(result?.message).toContain('balanced');
            expect(result?.metadata.variance_status).toBe('balanced');
        });

        it('should build notification payload with variance', async () => {
            const { supabase } = require('../config/supabase');
            supabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { name: 'Branch A' },
                            error: null
                        })
                    })
                })
            });

            const result = await buildStockTakeNotificationPayload('stock-456', 2, -150.50);

            expect(result).not.toBeNull();
            expect(result?.message).toContain('Branch A');
            expect(result?.message).toContain('-150.50');
            expect(result?.metadata.variance_status).toBe('variance');
            expect(result?.metadata.total_variance_value).toBe(-150.50);
        });

        it('should return null when branch fetch fails', async () => {
            const { supabase } = require('../config/supabase');
            supabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: { message: 'Branch not found' }
                        })
                    })
                })
            });

            const result = await buildStockTakeNotificationPayload('stock-789', 999, 0);

            expect(result).toBeNull();
        });
    });
});
