/**
 * Event Modal Component
 * Create/Edit calendar events
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Trash2, BookOpen, AlertCircle, GraduationCap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import calendarService, { CalendarEvent, CreateEventData } from '@/services/calendar.service';
import { toast } from 'sonner';

const eventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  eventType: z.enum(['study', 'deadline', 'exam', 'other']),
  startDate: z.string().min(1, 'Start date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
  allDay: z.boolean(),
  reminderMinutes: z.number().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  defaultDate?: Date | null;
  onSaved: () => void;
}

export function EventModal({ open, onClose, event, defaultDate, onSaved }: EventModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!event;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      description: '',
      eventType: 'other',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      startTime: '09:00',
      allDay: false,
      reminderMinutes: 60,
    },
  });

  const allDay = watch('allDay');
  const eventType = watch('eventType');

  useEffect(() => {
    if (open) {
      if (event) {
        // Editing existing event
        const startDate = new Date(event.start_date);
        reset({
          title: event.title,
          description: event.description || '',
          eventType: event.event_type,
          startDate: format(startDate, 'yyyy-MM-dd'),
          startTime: format(startDate, 'HH:mm'),
          endDate: event.end_date ? format(new Date(event.end_date), 'yyyy-MM-dd') : '',
          endTime: event.end_date ? format(new Date(event.end_date), 'HH:mm') : '',
          allDay: event.all_day,
          reminderMinutes: event.reminder_minutes || 60,
        });
      } else if (defaultDate) {
        // Creating new event on selected date
        reset({
          title: '',
          description: '',
          eventType: 'other',
          startDate: format(defaultDate, 'yyyy-MM-dd'),
          startTime: '09:00',
          allDay: false,
          reminderMinutes: 60,
        });
      } else {
        // Default new event
        reset({
          title: '',
          description: '',
          eventType: 'other',
          startDate: format(new Date(), 'yyyy-MM-dd'),
          startTime: '09:00',
          allDay: false,
          reminderMinutes: 60,
        });
      }
    }
  }, [open, event, defaultDate, reset]);

  const onSubmit = async (data: EventFormData) => {
    try {
      setLoading(true);

      const startDateTime = data.allDay
        ? new Date(`${data.startDate}T00:00:00`)
        : new Date(`${data.startDate}T${data.startTime}:00`);

      let endDateTime: Date | undefined;
      if (data.endDate && data.endTime && !data.allDay) {
        endDateTime = new Date(`${data.endDate}T${data.endTime}:00`);
      }

      const eventData: CreateEventData = {
        title: data.title,
        description: data.description,
        eventType: data.eventType,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime?.toISOString(),
        allDay: data.allDay,
        reminderMinutes: data.reminderMinutes,
      };

      if (isEditing && event) {
        await calendarService.updateEvent(event.id, eventData);
        toast.success(t('calendar.eventUpdated', 'Event updated'));
      } else {
        await calendarService.createEvent(eventData);
        toast.success(t('calendar.eventCreated', 'Event created'));
      }

      onSaved();
    } catch (error) {
      console.error('Failed to save event:', error);
      toast.error(t('calendar.saveError', 'Failed to save event'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !confirm(t('calendar.deleteConfirm', 'Are you sure you want to delete this event?'))) {
      return;
    }

    try {
      setDeleting(true);
      await calendarService.deleteEvent(event.id);
      toast.success(t('calendar.eventDeleted', 'Event deleted'));
      onSaved();
    } catch (error) {
      console.error('Failed to delete event:', error);
      toast.error(t('calendar.deleteError', 'Failed to delete event'));
    } finally {
      setDeleting(false);
    }
  };

  const eventTypeOptions = [
    { value: 'study', label: t('calendar.eventTypes.study', 'Study Session'), icon: BookOpen, color: 'text-blue-500' },
    { value: 'deadline', label: t('calendar.eventTypes.deadline', 'Deadline'), icon: AlertCircle, color: 'text-amber-500' },
    { value: 'exam', label: t('calendar.eventTypes.exam', 'Exam'), icon: GraduationCap, color: 'text-red-500' },
    { value: 'other', label: t('calendar.eventTypes.other', 'Other'), icon: CalendarIcon, color: 'text-gray-500' },
  ];

  const reminderOptions = [
    { value: 0, label: t('calendar.reminder.none', 'No reminder') },
    { value: 15, label: t('calendar.reminder.15min', '15 minutes before') },
    { value: 30, label: t('calendar.reminder.30min', '30 minutes before') },
    { value: 60, label: t('calendar.reminder.1hour', '1 hour before') },
    { value: 1440, label: t('calendar.reminder.1day', '1 day before') },
  ];

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing 
              ? t('calendar.editEvent', 'Edit Event')
              : t('calendar.createEvent', 'Create Event')
            }
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t('calendar.editEventDesc', 'Update the event details below')
              : t('calendar.createEventDesc', 'Fill in the details for your new event')
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('calendar.eventTitle', 'Title')}</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder={t('calendar.titlePlaceholder', 'Enter event title')}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Event Type */}
          <div className="space-y-2">
            <Label>{t('calendar.eventType', 'Event Type')}</Label>
            <div className="grid grid-cols-4 gap-2">
              {eventTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setValue('eventType', option.value as EventFormData['eventType'])}
                  className={cn(
                    'flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all',
                    eventType === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/50'
                  )}
                >
                  <option.icon className={cn('h-5 w-5', option.color)} />
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="allDay">{t('calendar.allDay', 'All day event')}</Label>
            <Switch
              id="allDay"
              checked={allDay}
              onCheckedChange={(checked: boolean) => setValue('allDay', checked)}
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">{t('calendar.startDate', 'Start Date')}</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="startDate"
                  type="date"
                  {...register('startDate')}
                  className="pl-10"
                />
              </div>
            </div>
            {!allDay && (
              <div className="space-y-2">
                <Label htmlFor="startTime">{t('calendar.startTime', 'Start Time')}</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="startTime"
                    type="time"
                    {...register('startTime')}
                    className="pl-10"
                  />
                </div>
              </div>
            )}
          </div>

          {/* End Date & Time (optional) */}
          {!allDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="endDate">{t('calendar.endDate', 'End Date')} ({t('common.optional', 'optional')})</Label>
                <Input
                  id="endDate"
                  type="date"
                  {...register('endDate')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">{t('calendar.endTime', 'End Time')}</Label>
                <Input
                  id="endTime"
                  type="time"
                  {...register('endTime')}
                />
              </div>
            </div>
          )}

          {/* Reminder */}
          <div className="space-y-2">
            <Label>{t('calendar.reminder', 'Reminder')}</Label>
            <Select
              value={String(watch('reminderMinutes') || 60)}
              onValueChange={(value) => setValue('reminderMinutes', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reminderOptions.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('calendar.description', 'Description')} ({t('common.optional', 'optional')})</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder={t('calendar.descriptionPlaceholder', 'Add notes or details')}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            {isEditing ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete')}
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading 
                  ? t('common.saving', 'Saving...')
                  : isEditing 
                    ? t('common.save', 'Save')
                    : t('common.create', 'Create')
                }
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EventModal;
