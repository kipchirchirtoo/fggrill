/**
 * Notification Service
 * Handles push notifications using Expo Notifications
 */

import type * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

let notificationsConfigured = false;

const canUseNotifications = () => Platform.OS !== 'web' && Constants.appOwnership !== 'expo';

const getNotifications = async (): Promise<typeof Notifications> => import('expo-notifications');

const ensureConfigured = async () => {
  if (!canUseNotifications() || notificationsConfigured) {
    return;
  }

  const Notifications = await getNotifications();

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  notificationsConfigured = true;
};

export class NotificationService {
  /**
   * Request notification permissions
   */
  static async requestPermissions(): Promise<boolean> {
    if (!canUseNotifications()) {
      console.warn('Push notifications are not supported on web');
      return false;
    }

    try {
      await ensureConfigured();
      const Notifications = await getNotifications();
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Failed to get push notification permissions');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Get Expo push token
   */
  static async getExpoPushToken(): Promise<string | null> {
    try {
      if (!canUseNotifications()) return null;
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return null;

      const Notifications = await getNotifications();

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.warn('No EAS project ID found');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      return token.data;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  /**
   * Schedule a local notification
   */
  static async scheduleNotification(
    title: string,
    body: string,
    data?: Record<string, any>,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string> {
    if (!canUseNotifications()) {
      return '';
    }

    await ensureConfigured();
    const Notifications = await getNotifications();
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: trigger || null,
    });
  }

  /**
   * Show immediate notification
   */
  static async showNotification(
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<void> {
    await this.scheduleNotification(title, body, data, null);
  }

  /**
   * Cancel a scheduled notification
   */
  static async cancelNotification(notificationId: string): Promise<void> {
    if (!canUseNotifications()) return;
    const Notifications = await getNotifications();
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  /**
   * Cancel all scheduled notifications
   */
  static async cancelAllNotifications(): Promise<void> {
    if (!canUseNotifications()) return;
    const Notifications = await getNotifications();
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Set up notification listeners
   */
  static setupListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void
  ) {
    if (!canUseNotifications()) {
      return () => undefined;
    }

    let receivedSubscription: { remove: () => void } | null = null;
    let responseSubscription: { remove: () => void } | null = null;

    void getNotifications().then((Notifications) => {
      receivedSubscription = Notifications.addNotificationReceivedListener(
        (notification) => {
          if (onNotificationReceived) {
            onNotificationReceived(notification);
          }
        }
      );

      responseSubscription = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          if (onNotificationResponse) {
            onNotificationResponse(response);
          }
        }
      );
    }).catch(() => undefined);

    return () => {
      receivedSubscription?.remove();
      responseSubscription?.remove();
    };
  }

  /**
   * Configure notification channels (Android only)
   */
  static async configureChannels(): Promise<void> {
    if (!canUseNotifications()) return;
    await ensureConfigured();
    if (Platform.OS === 'android') {
      const Notifications = await getNotifications();
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });

      await Notifications.setNotificationChannelAsync('deliveries', {
        name: 'Deliveries',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('payments', {
        name: 'Payments',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('alerts', {
        name: 'Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }
  }
}
