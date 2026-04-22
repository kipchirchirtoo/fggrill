import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RootNavigator from './src/navigation/RootNavigator';
import { theme } from './src/theme';

export default function App() {
  useEffect(() => {
    // Initialize notifications
    const initNotifications = async () => {
      if (Constants.appOwnership === 'expo') {
        return undefined;
      }

      const { NotificationService } = await import('./src/services/notification.service');

      await NotificationService.configureChannels();
      await NotificationService.requestPermissions();
      
      // Set up notification listeners
      const cleanup = NotificationService.setupListeners(
        (notification) => {
          console.log('Notification received:', notification);
        },
        (response) => {
          console.log('Notification tapped:', response);
          // Handle navigation based on notification data
        }
      );
      
      return cleanup;
    };
    
    const cleanup = initNotifications();
    return () => {
      cleanup.then(fn => fn?.()).catch(() => undefined);
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <StatusBar style="light" backgroundColor={theme.colors.primary} />
          <RootNavigator />
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
