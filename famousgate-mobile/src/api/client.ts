import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { NativeModules, Platform } from 'react-native';

const DEFAULT_API_BASE_URL = 'http://localhost:5000/api';
const CONFIGURED_API_BASE_URL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) || DEFAULT_API_BASE_URL;

const normalizeApiBaseUrl = (value: string) => value.replace(/\/$/, '');

const getBundleHost = () => {
  const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined;

  if (!scriptURL) {
    return null;
  }

  try {
    return new URL(scriptURL).hostname;
  } catch {
    return null;
  }
};

const getDerivedApiBaseUrl = () => {
  const bundleHost = getBundleHost();

  if (!bundleHost) {
    return null;
  }

  try {
    const configuredUrl = new URL(CONFIGURED_API_BASE_URL);
    const port = configuredUrl.port || '5000';
    const pathname = configuredUrl.pathname === '/' ? '/api' : configuredUrl.pathname;

    return normalizeApiBaseUrl(`${configuredUrl.protocol}//${bundleHost}:${port}${pathname}`);
  } catch {
    return null;
  }
};

const API_BASE_URL_CANDIDATES = Array.from(new Set([
  getDerivedApiBaseUrl(),
  normalizeApiBaseUrl(CONFIGURED_API_BASE_URL),
  Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : null,
].filter((value): value is string => Boolean(value))));

const API_BASE_URL = API_BASE_URL_CANDIDATES[0] || normalizeApiBaseUrl(DEFAULT_API_BASE_URL);

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await SecureStore.getItemAsync('access_token').catch(() => null);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.headers) {
      config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      config.headers.Pragma = 'no-cache';
      config.headers.Expires = '0';
    }
    if ((!config.method || String(config.method).toLowerCase() === 'get') && config.headers) {
      delete config.headers['If-None-Match'];
      delete config.headers['if-none-match'];
      delete config.headers['If-Modified-Since'];
      delete config.headers['if-modified-since'];
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Auto-refresh on 401 / retry dev-host mismatches
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _networkRetry?: boolean };

    if (!error.response && error.message === 'Network Error' && original && !original._networkRetry) {
      const currentBaseUrl = normalizeApiBaseUrl(String(original.baseURL || apiClient.defaults.baseURL || API_BASE_URL));
      const fallbackBaseUrl = API_BASE_URL_CANDIDATES.find((candidate) => candidate !== currentBaseUrl);

      if (fallbackBaseUrl && (!original.method || String(original.method).toLowerCase() === 'get')) {
        original._networkRetry = true;
        original.baseURL = fallbackBaseUrl;
        apiClient.defaults.baseURL = fallbackBaseUrl;
        return apiClient(original);
      }
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');
        const refreshBaseUrl = normalizeApiBaseUrl(String(original.baseURL || apiClient.defaults.baseURL || API_BASE_URL));
        const res = await axios.post(`${refreshBaseUrl}/auth/refresh-token`, {
          refresh_token: refreshToken,
        });
        const { token: newToken } = res.data;
        await SecureStore.setItemAsync('access_token', newToken);
        if (original.headers) original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      } catch {
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        await SecureStore.deleteItemAsync('user');
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
