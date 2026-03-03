'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { notificationsAPI } from '@/lib/api';

let lastUnreadCount = 0;

export function NotificationListener() {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        // Register service worker silently
        const registerServiceWorker = async () => {
            if ('serviceWorker' in navigator) {
                try {
                    await navigator.serviceWorker.register('/sw.js');
                } catch {
                    // service worker registration failed silently
                }
            }
        };
        registerServiceWorker();

        // Poll for new notifications every 30 seconds
        const checkForNewNotifications = async () => {
            try {
                const response = await notificationsAPI.getUnreadCount();
                if (response.success && response.data) {
                    const currentCount = response.data.count;

                    if (currentCount > lastUnreadCount && lastUnreadCount >= 0) {
                        const notifResponse = await notificationsAPI.getNotifications({ is_read: false });
                        if (notifResponse.success && notifResponse.data && notifResponse.data.length > 0) {
                            const latestNotif = notifResponse.data[0];
                            await showBrowserNotification(latestNotif);
                        }
                    }

                    lastUnreadCount = currentCount;
                }
            } catch {
                // notification check failed silently
            }
        };

        const initialTimeout = setTimeout(checkForNewNotifications, 2000);
        const interval = setInterval(checkForNewNotifications, 30000);

        return () => {
            clearTimeout(initialTimeout);
            clearInterval(interval);
        };
    }, [user]);

    return null;
}

async function showBrowserNotification(notification: any) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(notification.title || 'New Notification', {
                body: notification.message,
                icon: '/fglogo.png',
                badge: '/fglogo.png',
                tag: `notification-${notification.id}`,
                data: {
                    url: notification.action_url || '/dashboard',
                    notificationId: notification.id
                },
                requireInteraction: notification.priority === 'urgent'
            });
        }
    } catch {
        // show notification failed silently
    }
}
