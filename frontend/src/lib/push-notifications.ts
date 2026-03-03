// Push Notification Helper for Browser
export class PushNotificationManager {
    private registration: ServiceWorkerRegistration | null = null;

    async initialize() {
        if (!('serviceWorker' in navigator)) {
            // console.warn('Service Workers not supported');
            return false;
        }

        if (!('PushManager' in window)) {
            // console.warn('Push notifications not supported');
            return false;
        }

        try {
            // Register service worker
            this.registration = await navigator.serviceWorker.register('/sw.js');
            // console.log('Service Worker registered:', this.registration);
            return true;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            return false;
        }
    }

    async requestPermission(): Promise<boolean> {
        if (!('Notification' in window)) {
            // console.warn('Notifications not supported');
            return false;
        }

        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    async showNotification(title: string, options?: NotificationOptions) {
        if (!this.registration) {
            await this.initialize();
        }

        if (Notification.permission !== 'granted') {
            const granted = await this.requestPermission();
            if (!granted) {
                // console.warn('Notification permission denied');
                return;
            }
        }

        if (this.registration) {
            await this.registration.showNotification(title, {
                icon: '/fglogo.png',
                badge: '/fglogo.png',
                vibrate: [200, 100, 200],
                requireInteraction: false,
                ...options
            });
        }
    }

    async testNotification() {
        await this.showNotification('Test Notification', {
            body: 'This is a test notification from Famous Gates Hotels!',
            tag: 'test',
            data: { url: '/dashboard' }
        });
    }

    isSupported(): boolean {
        return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    }

    getPermissionStatus(): NotificationPermission {
        return Notification.permission;
    }
}

export const pushManager = new PushNotificationManager();
