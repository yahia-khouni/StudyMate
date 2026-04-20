import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // For cookies (refresh tokens)
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const REFRESH_ENDPOINT = '/auth/refresh';
const AUTH_ENDPOINTS_WITHOUT_REFRESH = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/resend-verification',
];

function shouldSkipRefresh(url?: string): boolean {
  if (!url) return false;

  if (url.includes(REFRESH_ENDPOINT)) {
    return true;
  }

  return AUTH_ENDPOINTS_WITHOUT_REFRESH.some((endpoint) => url.includes(endpoint));
}

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const requestUrl = originalRequest?.url;

    if (
      status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      shouldSkipRefresh(requestUrl)
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Wait for the in-flight refresh to finish
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Use plain axios here to avoid intercepting the refresh request itself.
      const response = await axios.post(
        `${API_BASE_URL}${REFRESH_ENDPOINT}`,
        {},
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const { accessToken } = response.data;

      localStorage.setItem('accessToken', accessToken);
      processQueue(null, accessToken);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      }

      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // Clear tokens - let the auth store/routes handle redirect
      localStorage.removeItem('accessToken');
      // Dispatch custom event for auth state to listen to
      window.dispatchEvent(new CustomEvent('auth:sessionExpired'));
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// API error type
export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  status: number;
}

// Helper to extract error message with network error detection
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    // Network errors (no response received)
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        return 'Request timeout. Please try again.';
      }
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        return 'Network error. Please check your internet connection.';
      }
      return 'Unable to connect to server. Please try again later.';
    }
    
    // Server responded with error
    const status = error.response.status;
    const data = error.response.data as { message?: string; error?: string };
    const message = data?.message || data?.error;
    
    // Handle common HTTP status codes
    if (status === 401) {
      return message || 'Invalid credentials. Please check your email and password.';
    }
    if (status === 403) {
      return message || 'You do not have permission to perform this action.';
    }
    if (status === 404) {
      return message || 'The requested resource was not found.';
    }
    if (status === 422) {
      return message || 'Invalid data provided.';
    }
    if (status >= 500) {
      return 'Server error. Please try again later.';
    }
    
    return message || error.message || 'An error occurred';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
}

export default api;
