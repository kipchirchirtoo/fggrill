/**
 * Base API Client
 * Provides a centralized HTTP client with error handling, retry logic, and interceptors
 * Requirements: 6.3, 9.2
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import { config } from '@/config/environment';
import { ApiError, ApiResponse } from '@/types';

/**
 * Custom error class for API errors
 */
export class ApiClientError extends Error {
  public code?: string;
  public status?: number;
  public details?: Record<string, unknown>;

  constructor(message: string, code?: string, status?: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Exponential backoff delay calculation
 */
const calculateBackoffDelay = (retryCount: number, baseDelay: number = 1000): number => {
  return Math.min(baseDelay * Math.pow(2, retryCount), 10000); // Max 10 seconds
};

/**
 * Determines if an error is retryable
 */
const isRetryableError = (error: AxiosError): boolean => {
  if (!error.response) {
    // Network errors are retryable
    return true;
  }

  const status = error.response.status;
  // Retry on 5xx errors and 429 (rate limit)
  return status >= 500 || status === 429;
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * API Client Configuration
 */
interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Base API Client Class
 */
class ApiClient {
  private client: AxiosInstance;
  private maxRetries: number;
  private retryDelay: number;

  constructor(clientConfig?: ApiClientConfig) {
    this.maxRetries = clientConfig?.maxRetries ?? config.api.maxRetries;
    this.retryDelay = clientConfig?.retryDelay ?? config.api.retryDelay;

    // Create axios instance
    this.client = axios.create({
      baseURL: clientConfig?.baseURL ?? config.api.baseUrl,
      timeout: clientConfig?.timeout ?? config.api.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Setup interceptors
    this.setupRequestInterceptor();
    this.setupResponseInterceptor();
  }

  /**
   * Request interceptor for adding common headers and logging
   */
  private setupRequestInterceptor(): void {
    this.client.interceptors.request.use(
      (config) => {
        // Add timestamp to request
        config.headers['X-Request-Time'] = new Date().toISOString();

        // Log request in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Response interceptor for error handling and logging
   */
  private setupResponseInterceptor(): void {
    this.client.interceptors.response.use(
      (response) => {
        // Log response in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
        }

        return response;
      },
      (error: AxiosError) => {
        // Log error in development
        if (process.env.NODE_ENV === 'development') {
          console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error.message);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    retryCount: number = 0
  ): Promise<AxiosResponse<T>> {
    try {
      return await requestFn();
    } catch (error) {
      const axiosError = error as AxiosError;

      // Check if we should retry
      if (retryCount < this.maxRetries && isRetryableError(axiosError)) {
        const delay = calculateBackoffDelay(retryCount, this.retryDelay);
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[API Retry] Attempt ${retryCount + 1}/${this.maxRetries} after ${delay}ms`);
        }

        await sleep(delay);
        return this.executeWithRetry(requestFn, retryCount + 1);
      }

      // Transform error to ApiClientError
      throw this.transformError(axiosError);
    }
  }

  /**
   * Transform axios error to ApiClientError
   */
  private transformError(error: AxiosError): ApiClientError {
    if (error.response) {
      // Server responded with error status
      const data = error.response.data as ApiError | undefined;
      return new ApiClientError(
        data?.message || error.message || 'An error occurred',
        data?.code || 'SERVER_ERROR',
        error.response.status,
        data?.details
      );
    } else if (error.request) {
      // Request made but no response received
      return new ApiClientError(
        'Network error. Please check your connection.',
        'NETWORK_ERROR',
        undefined,
        { originalError: error.message }
      );
    } else {
      // Error in request setup
      return new ApiClientError(
        error.message || 'An unexpected error occurred',
        'REQUEST_ERROR',
        undefined,
        { originalError: error.message }
      );
    }
  }

  /**
   * GET request
   */
  async get<T>(url: string, requestConfig?: AxiosRequestConfig): Promise<T> {
    const response = await this.executeWithRetry<ApiResponse<T>>(() =>
      this.client.get(url, requestConfig)
    );
    // Handle both wrapped and unwrapped responses
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return (response.data as any).data;
    }
    return response.data as any;
  }

  /**
   * POST request
   */
  async post<T, D = unknown>(url: string, data?: D, requestConfig?: AxiosRequestConfig): Promise<T> {
    const response = await this.executeWithRetry<ApiResponse<T>>(() =>
      this.client.post(url, data, requestConfig)
    );
    // Handle both wrapped and unwrapped responses
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return (response.data as any).data;
    }
    return response.data as any;
  }

  /**
   * PUT request
   */
  async put<T, D = unknown>(url: string, data?: D, requestConfig?: AxiosRequestConfig): Promise<T> {
    const response = await this.executeWithRetry<ApiResponse<T>>(() =>
      this.client.put(url, data, requestConfig)
    );
    // Handle both wrapped and unwrapped responses
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return (response.data as any).data;
    }
    return response.data as any;
  }

  /**
   * PATCH request
   */
  async patch<T, D = unknown>(url: string, data?: D, requestConfig?: AxiosRequestConfig): Promise<T> {
    const response = await this.executeWithRetry<ApiResponse<T>>(() =>
      this.client.patch(url, data, requestConfig)
    );
    // Handle both wrapped and unwrapped responses
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return (response.data as any).data;
    }
    return response.data as any;
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string, requestConfig?: AxiosRequestConfig): Promise<T> {
    const response = await this.executeWithRetry<ApiResponse<T>>(() =>
      this.client.delete(url, requestConfig)
    );
    // Handle both wrapped and unwrapped responses
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return (response.data as any).data;
    }
    return response.data as any;
  }

  /**
   * Get raw axios instance for advanced usage
   */
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient();

// Export class for testing or custom instances
export { ApiClient };
