'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Bell, Clock, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { 
  Notification as NotificationType, 
  filterNotificationsForUser,
  ROLE_HIERARCHY,
  NotificationLevel
} from '@/lib/notifications';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  visibility?: NotificationLevel;
  targetRoles?: string[];
  department?: string;
}

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationModal({ isOpen, onClose }: NotificationModalProps) {
  const { user } = useAuth();
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  
  // Filter notifications based on user role
  const notifications = useMemo(() => {
    if (!user) return [];
    
    return allNotifications.filter(n => {
      const userLevel = ROLE_HIERARCHY[user.role] || 0;
      
      // Check visibility level
      if (n.visibility) {
        const levelMin: Record<NotificationLevel, number> = {
          all: 0,
          staff: 20,
          supervisors: 50,
          managers: 70,
          admin: 90,
        };
        if (userLevel < levelMin[n.visibility]) return false;
      }
      
      // Check specific target roles
      if (n.targetRoles && n.targetRoles.length > 0) {
        if (!n.targetRoles.includes(user.role)) return false;
      }
      
      // Check department match (optional)
      if (n.department && user.department && n.department !== user.department) {
        // Only filter by department for non-manager roles
        if (userLevel < 70) return false;
      }
      
      return true;
    });
  }, [allNotifications, user]);

  useEffect(() => {
    // Load notifications - in production this would come from API
    // For now, notifications start empty (no mock data)
    setAllNotifications([]);
  }, []);

  const markAsRead = (id: string) => {
    setAllNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setAllNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Bell className="h-5 w-5 text-blue-500" />;
    }
  };

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    return days + 'd ago';
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
        className="bg-white rounded-xl w-full max-w-md h-[calc(100vh-2rem)] mt-16 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
            <p className="text-sm text-gray-500">
              {notifications.filter(n => !n.read).length} unread notifications
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={markAllAsRead}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              Mark all as read
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto h-full pb-20">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Bell className="h-12 w-12 mb-4" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={'flex items-center gap-4 p-3 hover:bg-gray-50 transition-colors ' + (!notification.read ? 'bg-indigo-50' : '')}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {getTimeAgo(notification.timestamp)}
                        </span>
                      </div>
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
