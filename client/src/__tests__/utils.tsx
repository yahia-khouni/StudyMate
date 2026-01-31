/**
 * Test Utilities
 * Helpers for rendering components in tests
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Create a new QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

interface WrapperProps {
  children: React.ReactNode;
}

// All providers wrapper
const AllProviders = ({ children }: WrapperProps) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

// Custom render function
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Helper to wait for async operations
export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

// Mock user for auth tests
export const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  createdAt: '2024-01-01T00:00:00Z',
};

// Mock course for course tests
export const mockCourse = {
  id: 'course-1',
  title: 'Test Course',
  description: 'A test course',
  language: 'en',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  chaptersCount: 3,
  progress: 50,
};

// Mock chapter for chapter tests
export const mockChapter = {
  id: 'chapter-1',
  courseId: 'course-1',
  title: 'Test Chapter',
  orderIndex: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  progress: 25,
};

// Mock quiz for quiz tests
export const mockQuiz = {
  id: 'quiz-1',
  chapterId: 'chapter-1',
  title: 'Test Quiz',
  questions: [
    {
      id: 'q1',
      question: 'What is 2 + 2?',
      options: ['3', '4', '5', '6'],
      correctAnswerIndex: 1,
    },
    {
      id: 'q2',
      question: 'What is the capital of France?',
      options: ['London', 'Paris', 'Berlin', 'Madrid'],
      correctAnswerIndex: 1,
    },
  ],
  createdAt: '2024-01-01T00:00:00Z',
};

// Mock streak data
export const mockStreak = {
  currentStreak: 7,
  longestStreak: 14,
  lastActivityDate: '2024-01-15',
  activityToday: true,
};

// Mock dashboard data
export const mockDashboardData = {
  stats: {
    totalCourses: 5,
    completedCourses: 2,
    totalChapters: 25,
    completedChapters: 15,
    quizzesCompleted: 10,
    quizzesPassed: 8,
    averageQuizScore: 82,
  },
  streak: mockStreak,
  recentActivity: [
    {
      id: 'activity-1',
      type: 'quiz_completed',
      description: 'Completed Quiz: Test Quiz',
      timestamp: '2024-01-15T10:00:00Z',
    },
  ],
  upcomingDeadlines: [
    {
      id: 'deadline-1',
      title: 'Final Exam',
      dueDate: '2024-01-20T00:00:00Z',
      courseTitle: 'Test Course',
    },
  ],
  courses: [mockCourse],
  weeklyActivity: {
    byDay: {
      '2024-01-15': { total: 5, quizzes: 3, chapters: 2 },
      '2024-01-14': { total: 3, quizzes: 1, chapters: 2 },
    },
    weeklyTotal: 8,
    activeDays: 2,
  },
};
