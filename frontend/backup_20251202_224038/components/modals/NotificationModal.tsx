'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Bell, Clock, CheckCircle, AlertCircle, Info, Package, Home, Wrench, DollarSign } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { notificationsAPI } from '@/lib/api';
import { toast } from 'sonner';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  is_read: boolean;
  action_url?: string;
  metadata?: any;
  created_at: string;
  read_at?: string;
}

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationModal({ isOpen, onClose }: NotificationModalProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      console.log('🔔 [Notifications] Fetching notifications for user:', {
        userId: user?.id,
        role: user?.role,
        branchId: user?.branch_id,
        branchName: user?.branch_name
      });
      
      const response = await notificationsAPI.getNotifications();
      
      console.log('🔔 [Notifications] API Response:', response);
      
      if (response.success && response.data) {
        console.log(`🔔 [Notifications] Loaded ${response.data.length} notifications`);
        setNotifications(response.data);
      } else {
        console.warn('🔔 [Notifications] No data in response:', response);
        setNotifications([]);
      }
    } catch (error) {
      console.error('🔔 [Notifications] Error loading notifications:', error);
      toast.error('Failed to load notifications');
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await notificationsAPI.markAllAsRead();
      if (response.success) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        );
        toast.success(response.message || 'All notifications marked as read');
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
    }
  };

  const getNotificationIcon = (type: string, category: string) => {
    const iconClasses = 'h-5 w-5 text-[#3C3C43]'; // iOS neutral gray - NO COLORS
    
    // Return icon based on category
    switch (category) {
      case 'inventory':
      case 'stock':
        return <Package className={iconClasses} />;
      case 'housekeeping':
        return <Home className={iconClasses} />;
      case 'maintenance':
        return <Wrench className={iconClasses} />;
      case 'finance':
      case 'payment':
        return <DollarSign className={iconClasses} />;
      case 'booking':
        return <Bell className={iconClasses} />;
      case 'staff':
        return <CheckCircle className={iconClasses} />;
      case 'system':
        return <Info className={iconClasses} />;
      case 'guest':
        return <CheckCircle className={iconClasses} />;
      default:
        return <Info className={iconClasses} />;
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    if (days < 7) return days + 'd ago';
    return date.toLocaleDateString();
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.action_url) {
      onClose();
      window.location.href = notification.action_url;
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-start justify-end z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: 300 }}
        animate={{ x: 0 }}
        exit={{ x: 300 }}
        className="bg-white rounded-2xl w-full max-w-md h-[calc(100vh-2rem)] mt-16 overflow-hidden border border-[rgba(60,60,67,0.12)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[rgba(60,60,67,0.12)]">
          <div>
            <h2 className="text-lg font-semibold text-[#000000]">Notifications</h2>
            <p className="text-sm text-[#8E8E93]">
              {notifications.filter(n => !n.is_read).length} unread
              {user?.branch_name && (
                <span className="ml-2 text-xs px-2 py-0.5 bg-[#F2F2F7] rounded-full">
                  {user.branch_name}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {notifications.some(n => !n.is_read) && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-[#3C3C43] hover:text-[#000000] font-medium"
              >
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-[#F2F2F7] rounded-xl transition-colors">
              <X className="h-5 w-5 text-[#3C3C43]" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto h-full pb-20">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3C3C43]"></div>
              <p className="mt-4 text-[#8E8E93]">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#8E8E93]">
              <Bell className="h-16 w-16 mb-4" />
              <p className="text-lg font-medium">No notifications</p>
              <p className="text-sm mt-1">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(60,60,67,0.12)]">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-4 p-4 hover:bg-[#F2F2F7] transition-colors cursor-pointer ${
                    !notification.is_read ? 'bg-[#F2F2F7]/50' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type, notification.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[#000000]">
                        {notification.title}
                      </p>
                      {!notification.is_read && (
                        <div className="w-2 h-2 rounded-full bg-[#3C3C43] flex-shrink-0 mt-1.5"></div>
                      )}
                    </div>
                    <p className="text-sm text-[#3C3C43] mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                    {notification.metadata && (notification.metadata.branch_name || notification.metadata.role) && (
                      <div className="flex items-center gap-1 mt-1">
                        {notification.metadata.branch_name && (
                          <span className="text-xs px-2 py-0.5 bg-[#F2F2F7] text-[#3C3C43] rounded-full">
                            {notification.metadata.branch_name}
                          </span>
                        )}
                        {notification.metadata.role && (
                          <span className="text-xs px-2 py-0.5 bg-[#F2F2F7] text-[#3C3C43] rounded-full capitalize">
                            {notification.metadata.role.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="h-3.5 w-3.5 text-[#8E8E93]" />
                      <span className="text-xs text-[#8E8E93]">
                        {getTimeAgo(notification.created_at)}
                      </span>
                      {notification.priority === 'urgent' && (
                        <span className="text-xs px-2 py-0.5 bg-[#3C3C43] text-white rounded-full font-medium">
                          Urgent
                        </span>
                      )}
                      {notification.priority === 'high' && (
                        <span className="text-xs px-2 py-0.5 bg-[#8E8E93] text-white rounded-full font-medium">
                          High
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
