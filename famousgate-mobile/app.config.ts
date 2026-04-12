import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FamousGate Hotels',
  slug: 'famousgate-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  platforms: ['ios', 'android'],
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#2E2C28',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.famousgate.mobile',
    infoPlist: {
      NSCameraUsageDescription: 'FamousGate needs camera access to scan barcodes and capture delivery photos.',
      NSPhotoLibraryUsageDescription: 'FamousGate needs photo library access to attach delivery evidence.',
      NSFaceIDUsageDescription: 'FamousGate uses Face ID to securely authenticate your login.',
      NSMicrophoneUsageDescription: 'Microphone access is not required for this app.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#2E2C28',
    },
    package: 'com.famousgate.mobile',
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
    ],
  },
  plugins: [
    [
      'expo-camera',
      {
        cameraPermission: 'Allow FamousGate to access your camera to scan barcodes and capture delivery photos.',
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Allow FamousGate to use Face ID for secure authentication.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#2E2C28',
      },
    ],
    'expo-secure-store',
    'expo-image-picker',
    'expo-file-system',
  ],
  extra: {
    apiBaseUrl: process.env.API_BASE_URL || 'http://192.168.100.6:5000/api',
    socketUrl: process.env.SOCKET_URL || 'http://192.168.100.6:5000',
    fcmSenderId: process.env.FCM_SENDER_ID,
    appEnv: process.env.APP_ENV || 'development',
    otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '240', 10),
    maxOtpAttempts: parseInt(process.env.MAX_OTP_ATTEMPTS || '3', 10),
    eas: {
      projectId: 'your-eas-project-id',
    },
  },
});
