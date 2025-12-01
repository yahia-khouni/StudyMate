import api from './api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  emailVerified: boolean;
  languagePreference: 'en' | 'fr';
  timezone: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  languagePreference?: 'en' | 'fr';
}

export interface AuthResponse {
  accessToken: string;
  user: User;
  expiresAt: string;
}

export interface MessageResponse {
  message: string;
}

// Register a new user
export async function register(data: RegisterData): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>('/auth/register', data);
  return response.data;
}

// Login with email/password
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/login', credentials);
  
  // Store access token
  localStorage.setItem('accessToken', response.data.accessToken);
  
  return response.data;
}

// Logout
export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    localStorage.removeItem('accessToken');
  }
}

// Refresh access token
export async function refreshToken(): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/refresh');
  
  localStorage.setItem('accessToken', response.data.accessToken);
  
  return response.data;
}

// Get current user
export async function getCurrentUser(): Promise<{ user: User }> {
  const response = await api.get<{ user: User }>('/auth/me');
  return response.data;
}

// Verify email
export async function verifyEmail(token: string): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>('/auth/verify-email', { token });
  return response.data;
}

// Resend verification email
export async function resendVerification(email: string): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>('/auth/resend-verification', { email });
  return response.data;
}

// Request password reset
export async function forgotPassword(email: string): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>('/auth/forgot-password', { email });
  return response.data;
}

// Reset password with token
export async function resetPassword(token: string, password: string): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>('/auth/reset-password', { token, password });
  return response.data;
}

// Change password (authenticated)
export async function changePassword(currentPassword: string, newPassword: string): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>('/auth/change-password', {
    currentPassword,
    newPassword,
  });
  return response.data;
}

// Google OAuth - redirect to backend
export function initiateGoogleLogin(): void {
  window.location.href = `${import.meta.env.VITE_API_URL || '/api'}/auth/google`;
}
