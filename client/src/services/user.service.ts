/**
 * User Service
 * API calls for user profile and settings
 */

import api from '@/services/api';

// Types
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  emailVerified: boolean;
  languagePreference: 'en' | 'fr';
  timezone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  languagePreference: 'en' | 'fr';
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  timezone?: string;
}

export interface UpdateSettingsData {
  languagePreference?: 'en' | 'fr';
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

/**
 * Get current user's profile
 */
export async function getProfile(): Promise<UserProfile> {
  const response = await api.get<UserProfile>('/users/profile');
  return response.data;
}

/**
 * Update user profile
 */
export async function updateProfile(data: UpdateProfileData): Promise<UserProfile> {
  const response = await api.put<UserProfile>('/users/profile', data);
  return response.data;
}

/**
 * Get user settings
 */
export async function getSettings(): Promise<UserSettings> {
  const response = await api.get<UserSettings>('/users/settings');
  return response.data;
}

/**
 * Update user settings
 */
export async function updateSettings(data: UpdateSettingsData): Promise<UserSettings> {
  const response = await api.put<UserSettings>('/users/settings', data);
  return response.data;
}

/**
 * Change password
 */
export async function changePassword(data: ChangePasswordData): Promise<void> {
  await api.put('/users/password', data);
}

/**
 * Delete account
 */
export async function deleteAccount(password: string): Promise<void> {
  await api.delete('/users/account', { data: { password } });
}

/**
 * Upload avatar image and return data URL
 */
export function processAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image'));
      return;
    }
    
    if (file.size > 200 * 1024) {
      reject(new Error('Image must be less than 200KB'));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}
