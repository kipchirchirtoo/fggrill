import { supabase } from '../config/database';
import { logger } from '../utils/logger';

export interface Notification {
  id?: number;
  user_id?: number;
  role?: string;
  branch_id?: number;
  department?: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  is_read?: boolean;
  action_url?: string;
  metadata?: any;
  created_at?: string;
  read_at?: string;
  expires_at?: string;
}

export interface NotificationFilter {
  user_id?: number;
  role?: string;
  branch_id?: number;
  is_read?: boolean;
  type?: string;
  category?: string;
  priority?: string;
}

class NotificationService {
  /**
   * Initialize notifications table
   */
  async initializeTable(): Promise<void> {
    try {
      // Check if table exists by attempting to select from it
      const { error } = await supabase
        .from('notifications')
        .select('id')
        .limit(1);

      if (error && error.code === '42P01') {
        logger.info('Notifications table does not exist. Please create it via Supabase dashboard or migration.');
      } else if (error) {
        logger.error('Error checking notifications table:', error);
      } else {
        logger.info('Notifications table exists and is accessible');
      }
    } catch (error) {
      logger.error('Error initializing notifications table:', error);
    }
  }

  /**
   * Create a new notification
   */
  async createNotification(notification: Notification): Promise<Notification | null> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: notification.user_id || null,
          role: notification.role || null,
          branch_id: notification.branch_id || null,
          department: notification.department || null,
          title: notification.title,
          message: notification.message,
          type: notification.type || 'info',
          category: notification.category,
          priority: notification.priority || 'medium',
          action_url: notification.action_url || null,
          metadata: notification.metadata || null,
          expires_at: notification.expires_at || null,
          is_read: false
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating notification:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Exception creating notification:', error);
      return null;
    }
  }

  /**
   * Bulk create notifications
   */
  async bulkCreateNotifications(notifications: Notification[]): Promise<Notification[]> {
    try {
      if (notifications.length === 0) return [];

      const notificationsData = notifications.map(n => ({
        user_id: n.user_id || null,
        role: n.role || null,
        branch_id: n.branch_id || null,
        department: n.department || null,
        title: n.title,
        message: n.message,
        type: n.type || 'info',
        category: n.category,
        priority: n.priority || 'medium',
        action_url: n.action_url || null,
        metadata: n.metadata || null,
        expires_at: n.expires_at || null,
        is_read: false
      }));

      const { data, error } = await supabase
        .from('notifications')
        .insert(notificationsData)
        .select();

      if (error) {
        logger.error('Error bulk creating notifications:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Exception bulk creating notifications:', error);
      return [];
    }
  }

  /**
   * Get notifications for a specific user
   */
  async getNotificationsForUser(userId: string, filters?: NotificationFilter): Promise<Notification[]> {
    try {
      // Validate userId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!userId || !uuidRegex.test(userId)) {
        logger.warn('Invalid userId for notifications:', userId);
        return [];
      }

      // First get user details
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, branch_id')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        logger.warn('Could not fetch user details for notifications:', userError?.message);
        return [];
      }

      // Build query conditions based on user data
      let orConditions = `user_id.eq.${userId}`;
      if (userData.role) {
        orConditions += `,role.eq.${userData.role}`;
      }
      if (userData.branch_id) {
        orConditions += `,branch_id.eq.${userData.branch_id}`;
      }

      // Build query for notifications
      let query = supabase
        .from('notifications')
        .select('*')
        .or(orConditions);

      // Apply filters
      if (filters?.is_read !== undefined) {
        query = query.eq('is_read', filters.is_read);
      }

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }

      // Order by priority and created date
      query = query.order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      const { data, error } = await query;

      if (error) {
        logger.error(`Supabase error fetching notifications for user ${userId}:`, {
          message: error.message,
          code: error.code,
          details: error.details
        });
        return [];
      }

      return data || [];
    } catch (error: any) {
      logger.error(`Unexpected exception fetching notifications for user ${userId}:`, {
        message: error.message,
        stack: error.stack
      });
      return [];
    }
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      // Validate userId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!userId || !uuidRegex.test(userId)) {
        logger.warn('Invalid userId for notification count:', userId);
        return 0;
      }

      // Get user details
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, branch_id')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        logger.error('Error fetching user for count:', userError?.message);
        return 0;
      }

      // Build query conditions based on user data
      let orConditions = `user_id.eq.${userId}`;
      if (userData.role) {
        orConditions += `,role.eq.${userData.role}`;
      }
      if (userData.branch_id) {
        orConditions += `,branch_id.eq.${userData.branch_id}`;
      }

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .or(orConditions)
        .eq('is_read', false);

      if (error) {
        // Table might not exist yet - that's okay
        if (error.code === '42P01') {
          logger.warn(`Notifications table does not exist when fetching count for user ${userId}`);
          return 0;
        }
        logger.error(`Supabase error counting notifications for user ${userId}:`, {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        return 0;
      }

      return count || 0;
    } catch (error: any) {
      logger.error(`Unexpected exception counting notifications for user ${userId}:`, {
        message: error.message,
        stack: error.stack
      });
      return 0;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: number, userId: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .or(`user_id.eq.${userId},user_id.is.null`);

      if (error) {
        logger.error('Error marking notification as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Exception marking notification as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number): Promise<number> {
    try {
      // Get user details
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, branch_id')
        .eq('id', userId)
        .single();

      if (userError) {
        logger.error('Error fetching user for mark all:', userError);
        return 0;
      }

      const { data, error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('is_read', false)
        .or(`user_id.eq.${userId},role.eq.${userData.role},branch_id.eq.${userData.branch_id}`)
        .select();

      if (error) {
        logger.error('Error marking all notifications as read:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      logger.error('Exception marking all notifications as read:', error);
      return 0;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        logger.error('Error deleting notification:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Exception deleting notification:', error);
      return false;
    }
  }

  /**
   * Delete expired notifications
   */
  async deleteExpiredNotifications(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .delete()
        .not('expires_at', 'is', null)
        .lt('expires_at', new Date().toISOString())
        .select();

      if (error) {
        logger.error('Error deleting expired notifications:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      logger.error('Exception deleting expired notifications:', error);
      return 0;
    }
  }

  /**
   * Delete old read notifications (older than 30 days)
   */
  async deleteOldReadNotifications(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('notifications')
        .delete()
        .eq('is_read', true)
        .lt('read_at', thirtyDaysAgo.toISOString())
        .select();

      if (error) {
        logger.error('Error deleting old read notifications:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      logger.error('Exception deleting old read notifications:', error);
      return 0;
    }
  }

  /**
   * Get notifications by category
   */
  async getNotificationsByCategory(category: string, limit: number = 50): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('category', category)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching notifications by category:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Exception fetching notifications by category:', error);
      return [];
    }
  }

  /**
   * Notify all users with a specific role
   */
  async notifyRole(
    role: string,
    title: string,
    message: string,
    options?: {
      type?: 'info' | 'success' | 'warning' | 'error';
      category?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      actionUrl?: string;
      metadata?: any;
    }
  ): Promise<Notification | null> {
    return this.createNotification({
      role,
      title,
      message,
      type: options?.type || 'info',
      category: options?.category || 'general',
      priority: options?.priority || 'medium',
      action_url: options?.actionUrl,
      metadata: options?.metadata
    });
  }

  /**
   * Notify all users in a specific branch
   */
  async notifyBranch(
    branchId: number,
    title: string,
    message: string,
    options?: {
      type?: 'info' | 'success' | 'warning' | 'error';
      category?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      actionUrl?: string;
      metadata?: any;
    }
  ): Promise<Notification | null> {
    return this.createNotification({
      branch_id: branchId,
      title,
      message,
      type: options?.type || 'info',
      category: options?.category || 'general',
      priority: options?.priority || 'medium',
      action_url: options?.actionUrl,
      metadata: options?.metadata
    });
  }

  /**
   * Notify specific user
   */
  async notifyUser(
    userId: number,
    title: string,
    message: string,
    options?: {
      type?: 'info' | 'success' | 'warning' | 'error';
      category?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      actionUrl?: string;
      metadata?: any;
    }
  ): Promise<Notification | null> {
    return this.createNotification({
      user_id: userId,
      title,
      message,
      type: options?.type || 'info',
      category: options?.category || 'general',
      priority: options?.priority || 'medium',
      action_url: options?.actionUrl,
      metadata: options?.metadata
    });
  }
}

export default new NotificationService();
