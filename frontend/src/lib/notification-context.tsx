'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notificationsAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface NotificationContextType {
    unreadCount: number;
    refreshNotifications: () => Promise<void>;
    requestPushPermission: () => Promise<boolean>;
    isPushEnabled: boolean;
    preferences: NotificationPreferences;
    updatePreferences: (prefs: Partial<NotificationPreferences>) => void;
}

interface NotificationPreferences {
    pushEnabled: boolean;
    soundEnabled: boolean;
    desktopEnabled: boolean;
    categories: string[];
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const [isPushEnabled, setIsPushEnabled] = useState(false);
    const [preferences, setPreferences] = useState<NotificationPreferences>({
        pushEnabled: false,
        soundEnabled: true,
        desktopEnabled: true,
        categories: ['all']
    });

    // Load preferences from localStorage
    useEffect(() => {
        const savedPrefs = localStorage.getItem('notificationPreferences');
        if (savedPrefs) {
            try {
                setPreferences(JSON.parse(savedPrefs));
            } catch (error) {
                console.error('Error loading notification preferences:', error);
            }
        }
    }, []);

    const refreshNotifications = useCallback(async () => {
        if (!user) return;

        try {
            const response = await notificationsAPI.getUnreadCount();
            if (response.success && response.data) {
                setUnreadCount(response.data.count);
            }
        } catch (error) {
            console.error('Error refreshing notifications:', error);
        }
    }, [user]);

    // Poll for notifications every 60 seconds
    useEffect(() => {
        if (!user) return;

        refreshNotifications();
        const interval = setInterval(refreshNotifications, 60000);

        return () => clearInterval(interval);
    }, [user, refreshNotifications]);

    const requestPushPermission = async (): Promise<boolean> => {
        if (!('Notification' in window)) {
            console.warn('This browser does not support notifications');
            return false;
        }

        if (Notification.permission === 'granted') {
            setIsPushEnabled(true);
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            const granted = permission === 'granted';
            setIsPushEnabled(granted);

            if (granted) {
                // Register service worker for push notifications
                if ('serviceWorker' in navigator) {
                    try {
                        const registration = await navigator.serviceWorker.register('/sw.js');
                        console.log('Service Worker registered:', registration);
                    } catch (error) {
                        console.error('Service Worker registration failed:', error);
                    }
                }
            }

            return granted;
        }

        return false;
    };

    const updatePreferences = useCallback((prefs: Partial<NotificationPreferences>) => {
        setPreferences(prev => {
            const updated = { ...prev, ...prefs };
            localStorage.setItem('notificationPreferences', JSON.stringify(updated));
            return updated;
        });
    }, []);

    // Check if push is already enabled
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'granted') {
            setIsPushEnabled(true);
        }
    }, []);

    return (
        <NotificationContext.Provider
            value={{
                unreadCount,
                refreshNotifications,
                requestPushPermission,
                isPushEnabled,
                preferences,
                updatePreferences
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
}
