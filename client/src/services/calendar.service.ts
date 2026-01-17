/**
 * Calendar API Service
 * Client-side API calls for calendar events and study plans
 */

import api from './api';

export interface CalendarEvent {
  id: string;
  user_id: string;
  course_id?: string;
  course_title?: string;
  title: string;
  description?: string;
  event_type: 'study' | 'deadline' | 'exam' | 'other';
  start_date: string;
  end_date?: string;
  all_day: boolean;
  recurrence_rule?: string;
  reminder_minutes?: number;
  reminder_sent?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEventData {
  title: string;
  description?: string;
  eventType?: 'study' | 'deadline' | 'exam' | 'other';
  startDate: string;
  endDate?: string;
  allDay?: boolean;
  recurrenceRule?: string;
  reminderMinutes?: number;
  courseId?: string;
}

export interface StudyPlanOptions {
  courseId: string;
  examDate: string;
  sessionsPerDay?: number;
  sessionDuration?: number;
  studyDays?: number[];
  preferredTime?: string;
}

export interface StudyPlanResult {
  courseId: string;
  courseTitle: string;
  chaptersCount: number;
  eventsCreated: number;
  studySessionsPerDay: number;
  sessionDuration: number;
  examDate: string;
  firstStudyDate: string;
  lastStudyDate: string;
}

export interface CalendarStats {
  total: number;
  byType: Record<string, number>;
  upcomingCount: number;
  todayCount: number;
}

/**
 * Get all events with optional filters
 */
export async function getEvents(filters?: {
  startDate?: string;
  endDate?: string;
  eventType?: string;
  courseId?: string;
}): Promise<CalendarEvent[]> {
  const params = new URLSearchParams();
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.eventType) params.append('eventType', filters.eventType);
  if (filters?.courseId) params.append('courseId', filters.courseId);
  
  const response = await api.get(`/calendar?${params.toString()}`);
  return response.data.events;
}

/**
 * Get events by date range
 */
export async function getEventsByRange(start: Date, end: Date): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString(),
  });
  const response = await api.get(`/calendar/range?${params.toString()}`);
  return response.data.events;
}

/**
 * Get upcoming events (next 7 days)
 */
export async function getUpcomingEvents(): Promise<CalendarEvent[]> {
  const response = await api.get('/calendar/upcoming');
  return response.data.events;
}

/**
 * Get today's events
 */
export async function getTodayEvents(): Promise<CalendarEvent[]> {
  const response = await api.get('/calendar/today');
  return response.data.events;
}

/**
 * Get a single event
 */
export async function getEvent(id: string): Promise<CalendarEvent> {
  const response = await api.get(`/calendar/${id}`);
  return response.data.event;
}

/**
 * Create a new event
 */
export async function createEvent(data: CreateEventData): Promise<CalendarEvent> {
  const response = await api.post('/calendar', data);
  return response.data.event;
}

/**
 * Update an event
 */
export async function updateEvent(id: string, data: Partial<CreateEventData>): Promise<CalendarEvent> {
  const response = await api.put(`/calendar/${id}`, data);
  return response.data.event;
}

/**
 * Delete an event
 */
export async function deleteEvent(id: string): Promise<void> {
  await api.delete(`/calendar/${id}`);
}

/**
 * Generate a study plan for a course
 */
export async function generateStudyPlan(options: StudyPlanOptions): Promise<StudyPlanResult> {
  const response = await api.post('/calendar/study-plan', options);
  return response.data;
}

/**
 * Get calendar statistics
 */
export async function getCalendarStats(): Promise<CalendarStats> {
  const response = await api.get('/calendar/stats');
  return response.data;
}

export default {
  getEvents,
  getEventsByRange,
  getUpcomingEvents,
  getTodayEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  generateStudyPlan,
  getCalendarStats,
};
