/**
 * Dashboard Page Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, mockDashboardData } from './utils';
import { DashboardPage } from '../pages/DashboardPage';

// Mock progress service
vi.mock('../services/progress.service', () => ({
  getDashboardData: vi.fn(),
}));

import { getDashboardData } from '../services/progress.service';

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading skeleton while fetching data', () => {
    vi.mocked(getDashboardData).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<DashboardPage />);

    // Should show skeleton loaders
    expect(screen.getByTestId?.('dashboard-skeleton') || screen.queryByRole('progressbar')).toBeDefined();
  });

  it('should display dashboard data when loaded', async () => {
    vi.mocked(getDashboardData).mockResolvedValue(mockDashboardData);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    });

    // Check stats are displayed
    expect(screen.getByText('5')).toBeInTheDocument(); // Total courses
    expect(screen.getByText('10')).toBeInTheDocument(); // Quizzes taken
  });

  it('should display error state when fetch fails', async () => {
    vi.mocked(getDashboardData).mockRejectedValue(new Error('Network error'));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });

    // Should have retry button
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('should have links to create new course', async () => {
    vi.mocked(getDashboardData).mockResolvedValue(mockDashboardData);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    });

    const newCourseLink = screen.getByRole('link', { name: /new course/i });
    expect(newCourseLink).toHaveAttribute('href', '/courses');
  });

  it('should have link to calendar', async () => {
    vi.mocked(getDashboardData).mockResolvedValue(mockDashboardData);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    });

    const calendarLink = screen.getByRole('link', { name: /calendar/i });
    expect(calendarLink).toHaveAttribute('href', '/calendar');
  });

  it('should display streak widget', async () => {
    vi.mocked(getDashboardData).mockResolvedValue(mockDashboardData);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    });

    // Streak should be displayed (7 days)
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('should display recent activity', async () => {
    vi.mocked(getDashboardData).mockResolvedValue(mockDashboardData);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/recent activity/i)).toBeInTheDocument();
    });

    // Check activity item is displayed
    expect(screen.getByText(/completed quiz/i)).toBeInTheDocument();
  });

  it('should display upcoming deadlines', async () => {
    vi.mocked(getDashboardData).mockResolvedValue(mockDashboardData);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/upcoming/i)).toBeInTheDocument();
    });

    // Check deadline is displayed
    expect(screen.getByText(/final exam/i)).toBeInTheDocument();
  });

  it('should display courses grid', async () => {
    vi.mocked(getDashboardData).mockResolvedValue(mockDashboardData);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    });

    // Check course is displayed
    expect(screen.getByText(/test course/i)).toBeInTheDocument();
  });

  it('should display quick actions', async () => {
    vi.mocked(getDashboardData).mockResolvedValue(mockDashboardData);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/quick actions/i)).toBeInTheDocument();
    });

    // Check quick action buttons exist
    expect(screen.getByRole('link', { name: /upload material/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /take quiz/i })).toBeInTheDocument();
  });
});

describe('DashboardPage - Empty States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle empty courses', async () => {
    const emptyData = {
      ...mockDashboardData,
      stats: {
        ...mockDashboardData.stats,
        totalCourses: 0,
        completedCourses: 0,
      },
      courses: [],
    };

    vi.mocked(getDashboardData).mockResolvedValue(emptyData);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    });

    // Should show empty state or prompt to create course
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should handle no recent activity', async () => {
    const noActivityData = {
      ...mockDashboardData,
      recentActivity: [],
    };

    vi.mocked(getDashboardData).mockResolvedValue(noActivityData);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    });

    // Should handle empty activity gracefully
    expect(screen.getByText(/recent activity/i)).toBeInTheDocument();
  });

  it('should handle no deadlines', async () => {
    const noDeadlinesData = {
      ...mockDashboardData,
      upcomingDeadlines: [],
    };

    vi.mocked(getDashboardData).mockResolvedValue(noDeadlinesData);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    });

    // Should handle empty deadlines gracefully
    expect(screen.getByText(/upcoming/i)).toBeInTheDocument();
  });
});
