import api from './api';

export interface Notification {
  id: string;
  userId: string;
  type: 'processing_complete' | 'deadline_reminder' | 'quiz_passed' | 'streak_reminder' | 'badge_earned';
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  emailSent: boolean;
  emailSentAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

/**
 * Get user notifications
 */
export async function getNotifications(params?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}): Promise<NotificationsResponse> {
  const response = await api.get('/notifications', { params });
  return response.data.data;
}

/**
 * Get recent notifications
 */
export async function getRecentNotifications(limit = 10): Promise<Notification[]> {
  const response = await api.get('/notifications/recent', { params: { limit } });
  return response.data.data;
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(): Promise<number> {
  const response = await api.get('/notifications/unread-count');
  return response.data.data.count;
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string): Promise<void> {
  await api.put(`/notifications/${notificationId}/read`);
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(): Promise<{ markedCount: number }> {
  const response = await api.put('/notifications/read-all');
  return response.data.data;
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  await api.delete(`/notifications/${notificationId}`);
}

/**
 * Delete all notifications
 */
export async function deleteAllNotifications(): Promise<{ deletedCount: number }> {
  const response = await api.delete('/notifications');
  return response.data.data;
}
