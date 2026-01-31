/**
 * Progress Service
 * API calls for progress tracking and analytics
 */

import api from './api';

// Types
export interface ChapterProgress {
  chapterId: string;
  chapterTitle: string;
  courseId: string;
  courseName: string;
  status: string;
  materials: {
    total: number;
    processed: number;
    pending: number;
    processing: number;
    failed: number;
    processedPercent: number;
  };
  summary: {
    exists: boolean;
    languages: string[];
  };
  quizzes: {
    totalQuizzes: number;
    totalAttempts: number;
    avgScore: number | null;
    bestScore: number | null;
  };
  flashcards: {
    totalDecks: number;
    totalCards: number;
    reviewedCards: number;
    masteryPercent: number;
  };
  completedPercent: number;
}

export interface CourseProgressChapter {
  id: string;
  title: string;
  status: string;
  orderIndex: number;
  materialsUploaded: number;
  materialsProcessed: number;
  hasSummary: boolean;
  hasQuiz: boolean;
  hasFlashcards: boolean;
  progressPercent: number;
}

export interface CourseProgress {
  courseId: string;
  courseName: string;
  language: string;
  color: string;
  chapters: {
    total: number;
    completed: number;
    details: CourseProgressChapter[];
  };
  quizzes: {
    total: number;
    attempted: number;
    passed: number;
    avgScore: number | null;
  };
  flashcards: {
    totalCards: number;
    reviewedCards: number;
    masteredCards: number;
    masteryPercent: number;
  };
  overallProgress: number;
  updatedAt: string;
}

export interface UserProgress {
  courses: {
    total: number;
    chapters: {
      total: number;
      completed: number;
    };
  };
  quizzes: {
    totalAttempts: number;
    avgScore: number | null;
    passedCount: number;
    bestScore: number | null;
  };
  flashcards: {
    reviewedCards: number;
    masteredCards: number;
    totalReviews: number;
  };
  streak: {
    current: number;
    longest: number;
    lastActivity: string | null;
  };
  materials: {
    total: number;
    totalSizeMB: number;
  };
}

export interface WeeklyActivitySummary {
  period: {
    start: string;
    end: string;
    days: number;
  };
  summary: {
    totalActivities: number;
    activeDays: number;
    avgActivitiesPerDay: number;
    byType: {
      uploads: number;
      quizzes: number;
      flashcardReviews: number;
      chats: number;
    };
  };
  dailyBreakdown: Array<{
    date: string;
    upload: number;
    quiz: number;
    flashcard_review: number;
    chat: number;
    total: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    entityType: string;
    entityId: string;
    date: string;
    timestamp: string;
  }>;
}

export interface DashboardCourse {
  id: string;
  name: string;
  description: string | null;
  color: string;
  language: string;
  chapterCount: number;
  completedChapters: number;
  progress: number;
  updatedAt: string;
}

export interface DashboardDeadline {
  id: string;
  title: string;
  type: 'deadline' | 'exam';
  date: string;
  endDate: string | null;
  courseId: string | null;
}

export interface DashboardData {
  courses: DashboardCourse[];
  upcomingDeadlines: DashboardDeadline[];
  stats: UserProgress;
  weeklyActivity: WeeklyActivitySummary['summary'];
  recentActivity: WeeklyActivitySummary['recentActivity'];
}

/**
 * Get dashboard data (aggregated)
 */
export async function getDashboardData(): Promise<DashboardData> {
  const response = await api.get('/progress/dashboard');
  return response.data;
}

/**
 * Get user-wide progress summary
 */
export async function getUserProgress(): Promise<UserProgress> {
  const response = await api.get('/progress/user');
  return response.data;
}

/**
 * Get course progress details
 */
export async function getCourseProgress(courseId: string): Promise<CourseProgress> {
  const response = await api.get(`/progress/courses/${courseId}`);
  return response.data;
}

/**
 * Get chapter progress details
 */
export async function getChapterProgress(chapterId: string): Promise<ChapterProgress> {
  const response = await api.get(`/progress/chapters/${chapterId}`);
  return response.data;
}

/**
 * Get weekly activity summary (last 7 days)
 */
export async function getWeeklyActivity(): Promise<WeeklyActivitySummary> {
  const response = await api.get('/progress/weekly');
  return response.data;
}

export default {
  getDashboardData,
  getUserProgress,
  getCourseProgress,
  getChapterProgress,
  getWeeklyActivity,
};
