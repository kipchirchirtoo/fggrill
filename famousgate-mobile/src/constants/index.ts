/**
 * App Constants
 */

export const APP_NAME = 'FamousGate Hotels';
export const APP_VERSION = '1.0.0';

// API Configuration
export const API_TIMEOUT = 30000; // 30 seconds
export const API_RETRY_ATTEMPTS = 3;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Cache Duration (milliseconds)
export const CACHE_DURATION = {
  SHORT: 5 * 60 * 1000,      // 5 minutes
  MEDIUM: 30 * 60 * 1000,    // 30 minutes
  LONG: 24 * 60 * 60 * 1000, // 24 hours
};

// Refresh Intervals (milliseconds)
export const REFRESH_INTERVAL = {
  DASHBOARD: 30 * 1000,      // 30 seconds
  LIVE_DELIVERY: 30 * 1000,  // 30 seconds
  SHIFT: 60 * 1000,          // 1 minute
};

// User Roles
export const USER_ROLES = {
  CENTRAL_STOREKEEPER: 'central_storekeeper',
  BRANCH_STOREKEEPER: 'branch_storekeeper',
  CASHIER: 'cashier',
  SUPERADMIN: 'super_admin',
} as const;

// Payment Methods
export const PAYMENT_METHODS = {
  CASH: 'cash',
  MPESA: 'mpesa',
  CARD: 'card',
} as const;

// Dispatch Statuses
export const DISPATCH_STATUS = {
  DRAFT: 'draft',
  DISPATCHED: 'dispatched',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  CONFIRMED: 'confirmed',
  DISCREPANCY: 'discrepancy',
  CANCELLED: 'cancelled',
} as const;

// Bill Statuses
export const BILL_STATUS = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
  CANCELLED: 'cancelled',
} as const;

// Shift Statuses
export const SHIFT_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
} as const;

// Stock Alert Thresholds
export const STOCK_THRESHOLDS = {
  CRITICAL: 0.1,  // 10% of minimum
  LOW: 0.25,      // 25% of minimum
  WARNING: 0.5,   // 50% of minimum
};

// Validation Rules
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 100,
  MIN_QUANTITY: 0,
  MAX_QUANTITY: 999999,
  PHONE_LENGTH: 10,
  PHONE_LENGTH_INTL: 12,
};

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  DISPLAY_LONG: 'MMMM dd, yyyy',
  DISPLAY_TIME: 'MMM dd, yyyy HH:mm',
  TIME_ONLY: 'HH:mm',
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK: 'Network error. Please check your internet connection.',
  TIMEOUT: 'Request timeout. Please try again.',
  UNAUTHORIZED: 'Session expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION: 'Please check your input and try again.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN: 'Welcome back!',
  LOGOUT: 'Logged out successfully',
  PAYMENT_PROCESSED: 'Payment processed successfully',
  DISPATCH_CREATED: 'Dispatch created successfully',
  DELIVERY_CONFIRMED: 'Delivery confirmed successfully',
  SHIFT_STARTED: 'Shift started successfully',
  SHIFT_ENDED: 'Shift ended successfully',
  ITEM_ADDED: 'Item added successfully',
  ITEM_UPDATED: 'Item updated successfully',
  ITEM_DELETED: 'Item deleted successfully',
};

// Notification Types
export const NOTIFICATION_TYPES = {
  DELIVERY: 'delivery',
  PAYMENT: 'payment',
  ALERT: 'alert',
  INFO: 'info',
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  USER_PREFERENCES: '@user_preferences',
  OFFLINE_QUEUE: '@offline_queue',
  CACHED_DATA: '@cached_data',
  LAST_SYNC: '@last_sync',
  BIOMETRIC_ENABLED: '@biometric_enabled',
  THEME_MODE: '@theme_mode',
  LANGUAGE: '@language',
} as const;

// Feature Flags
export const FEATURES = {
  BIOMETRIC_AUTH: true,
  OFFLINE_MODE: false,
  PUSH_NOTIFICATIONS: true,
  CAMERA_SCAN: true,
  MPESA_PAYMENTS: true,
  DARK_MODE: false,
  MULTI_LANGUAGE: false,
};

// App Links
export const LINKS = {
  SUPPORT: 'mailto:support@famousgate.com',
  PRIVACY_POLICY: 'https://famousgate.com/privacy',
  TERMS_OF_SERVICE: 'https://famousgate.com/terms',
};
