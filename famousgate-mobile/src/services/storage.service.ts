/**
 * Storage Service
 * Handles local data persistence using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export class StorageService {
  /**
   * Save data to storage
   */
  static async set<T>(key: string, value: T): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error(`Error saving ${key} to storage:`, error);
      throw error;
    }
  }

  /**
   * Get data from storage
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error(`Error reading ${key} from storage:`, error);
      return null;
    }
  }

  /**
   * Remove data from storage
   */
  static async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing ${key} from storage:`, error);
      throw error;
    }
  }

  /**
   * Clear all data from storage
   */
  static async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }

  /**
   * Get all keys from storage
   */
  static async getAllKeys(): Promise<string[]> {
    try {
      return [...(await AsyncStorage.getAllKeys())];
    } catch (error) {
      console.error('Error getting all keys from storage:', error);
      return [];
    }
  }

  /**
   * Check if key exists in storage
   */
  static async has(key: string): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(key);
      return value !== null;
    } catch (error) {
      console.error(`Error checking ${key} in storage:`, error);
      return false;
    }
  }

  /**
   * Save multiple items
   */
  static async setMultiple(items: Array<[string, any]>): Promise<void> {
    try {
      const pairs = items.map(([key, value]) => [key, JSON.stringify(value)]);
      await AsyncStorage.multiSet(pairs as [string, string][]);
    } catch (error) {
      console.error('Error saving multiple items to storage:', error);
      throw error;
    }
  }

  /**
   * Get multiple items
   */
  static async getMultiple<T>(keys: string[]): Promise<Record<string, T | null>> {
    try {
      const pairs = await AsyncStorage.multiGet(keys);
      const result: Record<string, T | null> = {};
      
      pairs.forEach(([key, value]) => {
        result[key] = value ? JSON.parse(value) : null;
      });
      
      return result;
    } catch (error) {
      console.error('Error getting multiple items from storage:', error);
      return {};
    }
  }

  /**
   * Remove multiple items
   */
  static async removeMultiple(keys: string[]): Promise<void> {
    try {
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.error('Error removing multiple items from storage:', error);
      throw error;
    }
  }
}

// Storage keys constants
export const STORAGE_KEYS = {
  USER_PREFERENCES: '@user_preferences',
  OFFLINE_QUEUE: '@offline_queue',
  CACHED_DATA: '@cached_data',
  LAST_SYNC: '@last_sync',
  BIOMETRIC_ENABLED: '@biometric_enabled',
  THEME_MODE: '@theme_mode',
  LANGUAGE: '@language',
} as const;
