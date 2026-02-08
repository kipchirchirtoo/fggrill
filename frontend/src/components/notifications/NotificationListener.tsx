'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { notificationsAPI } from '@/lib/api';

let lastNotificationCheck = 0;
let lastUnreadCount = 0;

export function NotificationListener() {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        console.log('🔔 NotificationListener: Starting for user', user.id);

        // Request notification permission immediately and aggressively
        const requestPermission = async () => {
            if (!('Notification' in window)) {
                console.error('🔔 Notifications NOT supported in this browser!');
                return;
            }

            console.log('🔔 Current notification permission:', Notification.permission);

            if (Notification.permission === 'default') {
                console.log('🔔 Requesting notification permission...');
                const permission = await Notification.requestPermission();
                console.log('🔔 Permission result:', permission);

                if (permission === 'granted') {
                    console.log('✅ Notification permission GRANTED!');
                    // Show a test notification immediately
                    await showTestNotification();
                } else {
                    console.error('❌ Notification permission DENIED!');
                }
            } else if (Notification.permission === 'granted') {
                console.log('✅ Notification permission already granted');
                // Show a test notification
                await showTestNotification();
            } else {
                console.error('❌ Notification permission is denied');
            }
        };
        requestPermission();

        // Register service worker
        const registerServiceWorker = async () => {
            if ('serviceWorker' in navigator) {
                try {
                    const registration = await navigator.serviceWorker.register('/sw.js');
                    console.log('🔔 Service Worker registered:', registration);
                } catch (error) {
                    console.error('🔔 Service Worker registration failed:', error);
                }
            }
        };
        registerServiceWorker();

        // Poll for new notifications every 5 seconds (more frequent)
        const checkForNewNotifications = async () => {
            try {
                const response = await notificationsAPI.getUnreadCount();
                if (response.success && response.data) {
                    const currentCount = response.data.count;

                    console.log('🔔 Notification check - Current:', currentCount, 'Last:', lastUnreadCount);

                    // If count increased, fetch and show the latest notification
                    if (currentCount > lastUnreadCount && lastUnreadCount >= 0) {
                        console.log('🔔 NEW NOTIFICATION DETECTED! Fetching details...');
                        const notifResponse = await notificationsAPI.getNotifications({ is_read: false });
                        if (notifResponse.success && notifResponse.data && notifResponse.data.length > 0) {
                            const latestNotif = notifResponse.data[0];
                            console.log('🔔 Showing notification:', latestNotif);
                            await showBrowserNotification(latestNotif);
                        }
                    }

                    lastUnreadCount = currentCount;
                }
            } catch (error) {
                console.error('🔔 Error checking for new notifications:', error);
            }
        };

        // Initial check after 2 seconds
        const initialTimeout = setTimeout(checkForNewNotifications, 2000);

        // Then check every 30 seconds (reduced frequency)
        const interval = setInterval(checkForNewNotifications, 30000);

        return () => {
            clearTimeout(initialTimeout);
            clearInterval(interval);
        };
    }, [user]);

    return null; // This is a background component
}

async function showTestNotification() {
    console.log('🔔 Showing test notification...');
    try {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification('Famous Gates Connected!', {
                body: 'Desktop notifications are now active. You will receive alerts for new notifications.',
                icon: '/fglogo.png',
                badge: '/fglogo.png',
                tag: 'welcome',
                requireInteraction: false
            });
            console.log('✅ Test notification shown successfully!');
        }
    } catch (error) {
        console.error('❌ Error showing test notification:', error);
    }
}

async function showBrowserNotification(notification: any) {
    console.log('🔔 showBrowserNotification called with:', notification);

    if (!('Notification' in window)) {
        console.error('❌ Browser notifications not supported');
        return;
    }

    if (Notification.permission !== 'granted') {
        console.error('❌ Notification permission not granted. Current:', Notification.permission);
        return;
    }

    try {
        // Check if service worker is ready
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            console.log('🔔 Service worker ready, showing notification...');

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

            console.log('✅ Browser notification shown successfully:', notification.title);
        }
    } catch (error) {
        console.error('❌ Error showing browser notification:', error);
    }
}
