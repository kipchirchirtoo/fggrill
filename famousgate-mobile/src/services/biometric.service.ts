/**
 * Biometric Authentication Service
 * Handles fingerprint and face recognition using Expo Local Authentication
 */

import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export class BiometricService {
  /**
   * Check if biometric hardware is available
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      return hasHardware;
    } catch (error) {
      console.error('Error checking biometric hardware:', error);
      return false;
    }
  }

  /**
   * Check if biometrics are enrolled
   */
  static async isEnrolled(): Promise<boolean> {
    try {
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return isEnrolled;
    } catch (error) {
      console.error('Error checking biometric enrollment:', error);
      return false;
    }
  }

  /**
   * Get supported authentication types
   */
  static async getSupportedTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      return types;
    } catch (error) {
      console.error('Error getting supported types:', error);
      return [];
    }
  }

  /**
   * Get biometric type name for display
   */
  static async getBiometricTypeName(): Promise<string> {
    const types = await this.getSupportedTypes();
    
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
    }
    
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
    }
    
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'Iris Recognition';
    }
    
    return 'Biometric';
  }

  /**
   * Authenticate with biometrics
   */
  static async authenticate(
    promptMessage?: string,
    cancelLabel?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        return {
          success: false,
          error: 'Biometric authentication is not available on this device',
        };
      }

      const isEnrolled = await this.isEnrolled();
      if (!isEnrolled) {
        return {
          success: false,
          error: 'No biometrics enrolled. Please set up biometric authentication in your device settings.',
        };
      }

      const biometricType = await this.getBiometricTypeName();
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || `Authenticate with ${biometricType}`,
        cancelLabel: cancelLabel || 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error || 'Authentication failed',
        };
      }
    } catch (error: any) {
      console.error('Biometric authentication error:', error);
      return {
        success: false,
        error: error.message || 'An error occurred during authentication',
      };
    }
  }

  /**
   * Check if biometric authentication is configured and ready
   */
  static async isReady(): Promise<boolean> {
    const isAvailable = await this.isAvailable();
    const isEnrolled = await this.isEnrolled();
    return isAvailable && isEnrolled;
  }
}
