/**
 * Error handling utilities
 */

import { Alert } from 'react-native';
import { AxiosError } from 'axios';

export interface AppError {
  message: string;
  code?: string;
  field?: string;
  statusCode?: number;
}

/**
 * Extract error message from various error types
 */
export const getErrorMessage = (error: unknown): string => {
  // Axios error
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as AxiosError<any>;
    
    // Server returned error message
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
    
    if (axiosError.response?.data?.error) {
      return axiosError.response.data.error;
    }
    
    // Network error
    if (axiosError.message === 'Network Error') {
      return 'Network error. Please check your internet connection.';
    }
    
    // Timeout
    if (axiosError.code === 'ECONNABORTED') {
      return 'Request timeout. Please try again.';
    }
    
    // HTTP status codes
    if (axiosError.response?.status) {
      switch (axiosError.response.status) {
        case 400:
          return 'Invalid request. Please check your input.';
        case 401:
          return 'Unauthorized. Please log in again.';
        case 403:
          return 'Access denied. You do not have permission.';
        case 404:
          return 'Resource not found.';
        case 409:
          return 'Conflict. The resource already exists.';
        case 422:
          return 'Validation error. Please check your input.';
        case 500:
          return 'Server error. Please try again later.';
        case 503:
          return 'Service unavailable. Please try again later.';
        default:
          return `Error: ${axiosError.response.status}`;
      }
    }
    
    return axiosError.message || 'An unexpected error occurred';
  }
  
  // Standard Error object
  if (error instanceof Error) {
    return error.message;
  }
  
  // String error
  if (typeof error === 'string') {
    return error;
  }
  
  // Object with message property
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  
  return 'An unexpected error occurred';
};

/**
 * Parse error into structured format
 */
export const parseError = (error: unknown): AppError => {
  const message = getErrorMessage(error);
  
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as AxiosError<any>;
    return {
      message,
      code: axiosError.response?.data?.code || axiosError.code,
      field: axiosError.response?.data?.field,
      statusCode: axiosError.response?.status,
    };
  }
  
  return { message };
};

/**
 * Show error alert
 */
export const showErrorAlert = (
  error: unknown,
  title: string = 'Error',
  onDismiss?: () => void
): void => {
  const message = getErrorMessage(error);
  Alert.alert(title, message, [{ text: 'OK', onPress: onDismiss }]);
};

/**
 * Show success alert
 */
export const showSuccessAlert = (
  message: string,
  title: string = 'Success',
  onDismiss?: () => void
): void => {
  Alert.alert(title, message, [{ text: 'OK', onPress: onDismiss }]);
};

/**
 * Show confirmation dialog
 */
export const showConfirmDialog = (
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  title: string = 'Confirm',
  confirmText: string = 'Confirm',
  cancelText: string = 'Cancel'
): void => {
  Alert.alert(
    title,
    message,
    [
      { text: cancelText, style: 'cancel', onPress: onCancel },
      { text: confirmText, onPress: onConfirm },
    ]
  );
};

/**
 * Log error for debugging
 */
export const logError = (error: unknown, context?: string): void => {
  const errorInfo = parseError(error);
  console.error(`[${context || 'Error'}]`, errorInfo);
  
  // In production, you would send this to an error tracking service
  // like Sentry, Bugsnag, etc.
};
