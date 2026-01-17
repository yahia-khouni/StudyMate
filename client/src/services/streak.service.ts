/**
 * Streak API Service
 * Client-side API calls for streak and activity tracking
 */

import api from './api';

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  currentStreakStart?: string;
  longestStreakStart?: string;
  longestStreakEnd?: string;
  lastActivityDate?: string;
}

export interface ActivityHistory {
  activityDates: string[];
  dailyActivity: Record<string, number>;
  totalActivities: {
    upload: number;
    flashcard_review: number;
    quiz: number;
    chat: number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  currentStreak: number;
  longestStreak: number;
}

/**
 * Get current streak info
 */
export async function getStreak(): Promise<StreakInfo> {
  const response = await api.get('/streaks');
  return response.data;
}

/**
 * Get activity history
 */
export async function getActivityHistory(days: number = 30): Promise<ActivityHistory> {
  const response = await api.get(`/streaks/history?days=${days}`);
  return response.data;
}

/**
 * Check if user has activity today
 */
export async function hasActivityToday(): Promise<boolean> {
  const response = await api.get('/streaks/today');
  return response.data.hasActivity;
}

/**
 * Get streak leaderboard
 */
export async function getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
  const response = await api.get(`/streaks/leaderboard?limit=${limit}`);
  return response.data.leaderboard;
}

/**
 * Manually check and update streak
 */
export async function checkStreak(): Promise<StreakInfo> {
  const response = await api.post('/streaks/check');
  return response.data;
}

export default {
  getStreak,
  getActivityHistory,
  hasActivityToday,
  getLeaderboard,
  checkStreak,
};
