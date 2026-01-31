/**
 * Calendar Page
 * Full calendar view with event management and study plan generation
 */

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, parseISO, addWeeks, subWeeks, getHours, getMinutes } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, BookOpen, Clock, AlertCircle, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import calendarService, { CalendarEvent } from '@/services/calendar.service';
import { EventModal } from '@/components/calendar/EventModal';
import { StudyPlanWizard } from '@/components/calendar/StudyPlanWizard';
import { toast } from 'sonner';

type ViewMode = 'month' | 'week';

export default function CalendarPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'fr' ? fr : enUS;
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showStudyPlanWizard, setShowStudyPlanWizard] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      let rangeStart: Date;
      let rangeEnd: Date;
      
      if (viewMode === 'month') {
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);
        rangeStart = startOfWeek(start, { weekStartsOn: 1 });
        rangeEnd = endOfWeek(end, { weekStartsOn: 1 });
      } else {
        rangeStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        rangeEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      }
      
      const data = await calendarService.getEventsByRange(rangeStart, rangeEnd);
      setEvents(data);
    } catch (error) {
      console.error('Failed to load events:', error);
      toast.error(t('calendar.loadError', 'Failed to load events'));
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewMode, t]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
  };

  const navigate = (direction: 'prev' | 'next') => {
    if (viewMode === 'month') {
      navigateMonth(direction);
    } else {
      navigateWeek(direction);
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setShowEventModal(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSelectedDate(null);
    setShowEventModal(true);
  };

  const handleEventSaved = () => {
    loadEvents();
    setShowEventModal(false);
    setSelectedEvent(null);
    setSelectedDate(null);
  };

  const handleStudyPlanGenerated = () => {
    loadEvents();
    setShowStudyPlanWizard(false);
    toast.success(t('calendar.studyPlanCreated', 'Study plan created successfully!'));
  };

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    return events.filter(event => {
      const eventDate = parseISO(event.start_date);
      return isSameDay(eventDate, date);
    });
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
        {/* Header */}
        {weekDays.map((day) => (
          <div
            key={day}
            className="bg-muted-foreground/5 py-2 text-center text-sm font-medium text-muted-foreground"
          >
            {t(`calendar.weekdays.${day.toLowerCase()}`, day)}
          </div>
        ))}

        {/* Days */}
        {days.map((dayDate, idx) => {
          const dayEvents = getEventsForDate(dayDate);
          const isCurrentMonth = isSameMonth(dayDate, currentDate);
          const isToday = isSameDay(dayDate, new Date());

          return (
            <div
              key={idx}
              onClick={() => handleDateClick(dayDate)}
              className={cn(
                'min-h-[100px] p-2 bg-background cursor-pointer transition-colors hover:bg-muted/50',
                !isCurrentMonth && 'bg-muted/30 text-muted-foreground'
              )}
            >
              <div className={cn(
                'text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full',
                isToday && 'bg-primary text-primary-foreground'
              )}>
                {format(dayDate, 'd')}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <EventChip
                    key={event.id}
                    event={event}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEventClick(event);
                    }}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground pl-1">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days: Date[] = [];
    
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }

    // Hours from 6am to 11pm
    const hours = Array.from({ length: 18 }, (_, i) => i + 6);

    return (
      <div className="overflow-auto">
        <div className="min-w-[800px]">
          {/* Header with days */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
            <div className="p-2 text-center text-sm text-muted-foreground" />
            {days.map((day, idx) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={idx}
                  className={cn(
                    'p-2 text-center border-l',
                    isToday && 'bg-primary/5'
                  )}
                >
                  <div className="text-sm text-muted-foreground">
                    {format(day, 'EEE', { locale })}
                  </div>
                  <div className={cn(
                    'text-lg font-semibold w-8 h-8 mx-auto flex items-center justify-center rounded-full',
                    isToday && 'bg-primary text-primary-foreground'
                  )}>
                    {format(day, 'd')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="relative">
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b min-h-[60px]">
                <div className="p-1 text-xs text-muted-foreground text-right pr-2 -mt-2">
                  {format(new Date().setHours(hour, 0), 'h a')}
                </div>
                {days.map((day, dayIdx) => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div
                      key={dayIdx}
                      onClick={() => {
                        const clickedDate = new Date(day);
                        clickedDate.setHours(hour, 0, 0, 0);
                        handleDateClick(clickedDate);
                      }}
                      className={cn(
                        'border-l cursor-pointer hover:bg-muted/50 relative',
                        isToday && 'bg-primary/5'
                      )}
                    />
                  );
                })}
              </div>
            ))}

            {/* Render events positioned absolutely */}
            {days.map((day, dayIdx) => {
              const dayEvents = getEventsForDate(day);
              return dayEvents.map((event) => {
                const eventDate = parseISO(event.start_date);
                const eventHour = getHours(eventDate);
                const eventMinute = getMinutes(eventDate);
                
                // Only show events within our time range (6am-11pm)
                if (eventHour < 6 || eventHour > 23) return null;
                
                const top = (eventHour - 6) * 60 + eventMinute;
                const duration = event.end_date 
                  ? (parseISO(event.end_date).getTime() - eventDate.getTime()) / 60000
                  : 60; // Default 1 hour
                const height = Math.min(Math.max(duration, 30), 180); // Min 30px, max 3 hours

                return (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEventClick(event);
                    }}
                    className={cn(
                      'absolute rounded px-1 py-0.5 text-xs cursor-pointer overflow-hidden border',
                      event.event_type === 'study' && 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200',
                      event.event_type === 'deadline' && 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200',
                      event.event_type === 'exam' && 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200',
                      event.event_type === 'other' && 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200',
                    )}
                    style={{
                      top: `${top}px`,
                      left: `calc(60px + ${dayIdx} * ((100% - 60px) / 7) + 2px)`,
                      width: `calc((100% - 60px) / 7 - 4px)`,
                      height: `${height}px`,
                    }}
                    title={event.title}
                  >
                    <div className="font-medium truncate">{event.title}</div>
                    <div className="text-[10px] opacity-75">
                      {format(eventDate, 'h:mm a')}
                    </div>
                  </div>
                );
              });
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('calendar.title', 'Calendar')}</h1>
          <p className="text-muted-foreground">
            {t('calendar.subtitle', 'Manage your study schedule and deadlines')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowStudyPlanWizard(true)}
          >
            <GraduationCap className="h-4 w-4 mr-2" />
            {t('calendar.generateStudyPlan', 'Generate Study Plan')}
          </Button>
          <Button onClick={() => {
            setSelectedDate(new Date());
            setSelectedEvent(null);
            setShowEventModal(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            {t('calendar.addEvent', 'Add Event')}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="rounded-2xl bg-card border border-border mb-6">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => navigate('prev')}
                aria-label={viewMode === 'month' ? t('calendar.previousMonth', 'Previous month') : t('calendar.previousWeek', 'Previous week')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => navigate('next')}
                aria-label={viewMode === 'month' ? t('calendar.nextMonth', 'Next month') : t('calendar.nextWeek', 'Next week')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={goToToday}>
                {t('calendar.today', 'Today')}
              </Button>
            </div>
            
            <h2 className="text-xl font-semibold text-foreground">
              {viewMode === 'month' 
                ? format(currentDate, 'MMMM yyyy', { locale })
                : `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d', { locale })} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy', { locale })}`
              }
            </h2>

            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'month' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('month')}
              >
                {t('calendar.month', 'Month')}
              </Button>
              <Button
                variant={viewMode === 'week' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('week')}
              >
                {t('calendar.week', 'Week')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="h-[600px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : viewMode === 'month' ? (
        renderMonthView()
      ) : (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-0">
            {renderWeekView()}
          </div>
        </div>
      )}

      {/* Upcoming Events Sidebar */}
      <div className="rounded-2xl bg-card border border-border mt-6">
        <div className="p-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground mb-4">
            <Clock className="h-5 w-5" />
            {t('calendar.upcomingEvents', 'Upcoming Events')}
          </h3>
          <UpcomingEventsList events={events} onEventClick={handleEventClick} />
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        open={showEventModal}
        onClose={() => {
          setShowEventModal(false);
          setSelectedEvent(null);
          setSelectedDate(null);
        }}
        event={selectedEvent}
        defaultDate={selectedDate}
        onSaved={handleEventSaved}
      />

      {/* Study Plan Wizard */}
      <StudyPlanWizard
        open={showStudyPlanWizard}
        onClose={() => setShowStudyPlanWizard(false)}
        onGenerated={handleStudyPlanGenerated}
      />
    </div>
  );
}

// Event Chip Component
interface EventChipProps {
  event: CalendarEvent;
  onClick: (e: React.MouseEvent) => void;
}

function EventChip({ event, onClick }: EventChipProps) {
  const eventTypeStyles = {
    study: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    deadline: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    exam: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    other: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  };

  const eventTypeIcons = {
    study: <BookOpen className="h-3 w-3" />,
    deadline: <AlertCircle className="h-3 w-3" />,
    exam: <GraduationCap className="h-3 w-3" />,
    other: <CalendarIcon className="h-3 w-3" />,
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'text-xs px-2 py-1 rounded border truncate flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity',
        eventTypeStyles[event.event_type]
      )}
      title={event.title}
    >
      {eventTypeIcons[event.event_type]}
      <span className="truncate">{event.title}</span>
    </div>
  );
}

// Upcoming Events List Component
interface UpcomingEventsListProps {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

function UpcomingEventsList({ events, onEventClick }: UpcomingEventsListProps) {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'fr' ? fr : enUS;
  
  const today = new Date();
  const upcoming = events
    .filter(e => parseISO(e.start_date) >= today)
    .sort((a, b) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime())
    .slice(0, 5);

  if (upcoming.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No upcoming events
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {upcoming.map((event) => (
        <div
          key={event.id}
          onClick={() => onEventClick(event)}
          className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
        >
          <div className={cn(
            'w-2 h-2 rounded-full mt-2',
            event.event_type === 'study' && 'bg-blue-500',
            event.event_type === 'deadline' && 'bg-amber-500',
            event.event_type === 'exam' && 'bg-red-500',
            event.event_type === 'other' && 'bg-gray-500',
          )} />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{event.title}</p>
            <p className="text-sm text-muted-foreground">
              {format(parseISO(event.start_date), 'EEE, MMM d · h:mm a', { locale })}
            </p>
            {event.course_title && (
              <p className="text-xs text-muted-foreground truncate">
                📚 {event.course_title}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
