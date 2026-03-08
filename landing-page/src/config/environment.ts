/**
 * Environment Configuration
 * Centralized configuration for environment variables
 */

export const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
    timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000', 10),
    maxRetries: parseInt(process.env.NEXT_PUBLIC_API_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.NEXT_PUBLIC_API_RETRY_DELAY || '1000', 10),
  },
  app: {
    name: 'FamousGate Hotels',
    environment: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
  },
  cache: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  },
  features: {
    enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
    enableDebugMode: process.env.NEXT_PUBLIC_DEBUG_MODE === 'true',
  },
} as const;

export type Config = typeof config;
