import { Router, Request, Response } from 'express';
import notificationService from '../services/notification.service';
import { protect as authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @route   GET /api/notifications
 * @desc    Get notifications for the logged-in user
 * @access  Private
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const filters = {
      is_read: req.query.is_read === 'true' ? true : req.query.is_read === 'false' ? false : undefined,
      type: req.query.type as string | undefined,
      category: req.query.category as string | undefined,
      priority: req.query.priority as string | undefined
    };

    const notifications = await notificationService.getNotificationsForUser(userId, filters);

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications'
    });
  }
});

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count for the logged-in user
 * @access  Private
 */
router.get('/unread-count', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      // Return 0 count instead of error to prevent frontend issues
      return res.json({
        success: true,
        data: { count: 0 }
      });
    }

    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    logger.error('Error fetching unread count:', error);
    // Return 0 count on error instead of 500 to prevent connection issues
    res.json({
      success: true,
      data: { count: 0 }
    });
  }
});

/**
 * @route   POST /api/notifications
 * @desc    Create a new notification (admin only)
 * @access  Private (Admin)
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'general_manager') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const notification = await notificationService.createNotification(req.body);

    if (!notification) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create notification'
      });
    }

    res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    logger.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating notification'
    });
  }
});

/**
 * @route   POST /api/notifications/bulk
 * @desc    Create multiple notifications (admin only)
 * @access  Private (Admin)
 */
router.post('/bulk', authenticate, async (req: Request, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'general_manager') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { notifications } = req.body;
    if (!Array.isArray(notifications)) {
      return res.status(400).json({
        success: false,
        message: 'notifications must be an array'
      });
    }

    const createdNotifications = await notificationService.bulkCreateNotifications(notifications);

    res.status(201).json({
      success: true,
      data: createdNotifications
    });
  } catch (error) {
    logger.error('Error bulk creating notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error bulk creating notifications'
    });
  }
});

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.patch('/:id/read', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const notificationId = parseInt(req.params.id);
    const success = await notificationService.markAsRead(notificationId, userId);

    if (!success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to mark notification as read'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read'
    });
  }
});

/**
 * @route   PATCH /api/notifications/mark-all-read
 * @desc    Mark all notifications as read for the logged-in user
 * @access  Private
 */
router.patch('/mark-all-read', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const count = await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      data: { markedCount: count },
      message: `Marked ${count} notifications as read`
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking all notifications as read'
    });
  }
});

/**
 * @route   DELETE /api/notifications/clear-my-notifications
 * @desc    Clear all read notifications for the current user
 * @access  Private
 */
router.delete('/clear-my-notifications', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const deletedCount = await notificationService.clearUserReadNotifications(userId);

    res.json({
      success: true,
      data: { deletedCount },
      message: `Cleared ${deletedCount} read notification${deletedCount !== 1 ? 's' : ''}`
    });
  } catch (error) {
    logger.error('Error clearing user notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing notifications'
    });
  }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification (admin only)
 * @access  Private (Admin)
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'general_manager') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const notificationId = parseInt(req.params.id);
    const success = await notificationService.deleteNotification(notificationId);

    if (!success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to delete notification'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notification'
    });
  }
});

/**
 * @route   POST /api/notifications/test-notification
 * @desc    Send a test notification to the current user
 * @access  Private
 */
router.post('/test-notification', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const notification = await notificationService.createNotification({
      user_id: userId,
      title: 'Test Notification',
      message: 'This is a test push notification from Famous Gates. If you can see this, push notifications are working!',
      type: 'info',
      category: 'system',
      priority: 'medium'
    });

    res.json({
      success: true,
      data: notification,
      message: 'Test notification sent successfully'
    });
  } catch (error) {
    logger.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test notification'
    });
  }
});

/**
 * @route   POST /api/notifications/cleanup
 * @desc    Clean up expired and old read notifications (admin only)
 * @access  Private (Admin)
 */
router.post('/cleanup', authenticate, async (req: Request, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const expiredCount = await notificationService.deleteExpiredNotifications();
    const oldReadCount = await notificationService.deleteOldReadNotifications();

    res.json({
      success: true,
      data: {
        expiredDeleted: expiredCount,
        oldReadDeleted: oldReadCount,
        totalDeleted: expiredCount + oldReadCount
      },
      message: 'Cleanup completed successfully'
    });
  } catch (error) {
    logger.error('Error cleaning up notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error cleaning up notifications'
    });
  }
});

/**
 * @route   POST /api/notifications/notify-role
 * @desc    Send notification to all users with a specific role (admin only)
 * @access  Private (Admin)
 */
router.post('/notify-role', authenticate, async (req: Request, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'general_manager') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { role, title, message, options } = req.body;

    if (!role || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'role, title, and message are required'
      });
    }

    const notification = await notificationService.notifyRole(role, title, message, options);

    if (!notification) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create notification'
      });
    }

    res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    logger.error('Error notifying role:', error);
    res.status(500).json({
      success: false,
      message: 'Error notifying role'
    });
  }
});

/**
 * @route   POST /api/notifications/notify-branch
 * @desc    Send notification to all users in a branch (admin only)
 * @access  Private (Admin)
 */
router.post('/notify-branch', authenticate, async (req: Request, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'general_manager') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { branchId, title, message, options } = req.body;

    if (!branchId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'branchId, title, and message are required'
      });
    }

    const notification = await notificationService.notifyBranch(branchId, title, message, options);

    if (!notification) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create notification'
      });
    }

    res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    logger.error('Error notifying branch:', error);
    res.status(500).json({
      success: false,
      message: 'Error notifying branch'
    });
  }
});

/**
 * @route   POST /api/notifications/notify-user
 * @desc    Send notification to a specific user (admin only)
 * @access  Private (Admin)
 */
router.post('/notify-user', authenticate, async (req: Request, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'general_manager') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { userId, title, message, options } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'userId, title, and message are required'
      });
    }

    const notification = await notificationService.notifyUser(userId, title, message, options);

    if (!notification) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create notification'
      });
    }

    res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    logger.error('Error notifying user:', error);
    res.status(500).json({
      success: false,
      message: 'Error notifying user'
    });
  }
});

export default router;
