/**
 * Study Plan Wizard Component
 * Generate a study plan for a course based on exam date
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addDays } from 'date-fns';
import { Calendar as CalendarIcon, GraduationCap, Clock, BookOpen, Sparkles, CheckCircle2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// Checkbox removed - using custom day buttons instead
import { cn } from '@/lib/utils';
import calendarService, { StudyPlanResult } from '@/services/calendar.service';
import { getCourses, type Course } from '@/services/course.service';
import { toast } from 'sonner';

interface StudyPlanWizardProps {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
  preselectedCourseId?: string;
}

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

export function StudyPlanWizard({ open, onClose, onGenerated, preselectedCourseId }: StudyPlanWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [result, setResult] = useState<StudyPlanResult | null>(null);

  // Form state
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [examDate, setExamDate] = useState<string>(format(addDays(new Date(), 14), 'yyyy-MM-dd'));
  const [sessionsPerDay, setSessionsPerDay] = useState<number>(2);
  const [sessionDuration, setSessionDuration] = useState<number>(60);
  const [studyDays, setStudyDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [preferredTime, setPreferredTime] = useState<string>('09:00');

  useEffect(() => {
    if (open) {
      loadCourses();
      setStep(1);
      setResult(null);
      if (preselectedCourseId) {
        setSelectedCourseId(preselectedCourseId);
      }
    }
  }, [open, preselectedCourseId]);

  async function loadCourses() {
    try {
      const response = await getCourses();
      setCourses(response.courses || []);
    } catch (error) {
      console.error('Failed to load courses:', error);
    }
  }

  const toggleStudyDay = (day: number) => {
    setStudyDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleGenerate = async () => {
    if (!selectedCourseId || !examDate) {
      toast.error(t('calendar.selectCourseAndDate', 'Please select a course and exam date'));
      return;
    }

    if (studyDays.length === 0) {
      toast.error(t('calendar.selectStudyDays', 'Please select at least one study day'));
      return;
    }

    try {
      setLoading(true);
      const planResult = await calendarService.generateStudyPlan({
        courseId: selectedCourseId,
        examDate,
        sessionsPerDay,
        sessionDuration,
        studyDays,
        preferredTime,
      });
      setResult(planResult);
      setStep(3);
    } catch (error) {
      console.error('Failed to generate study plan:', error);
      const message = error instanceof Error ? error.message : t('calendar.generateError', 'Failed to generate study plan');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('calendar.studyPlanWizard', 'Study Plan Wizard')}
          </DialogTitle>
          <DialogDescription>
            {t('calendar.studyPlanDesc', 'Generate an optimized study schedule for your course')}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm',
                step >= s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}>
                {step > s ? <CheckCircle2 className="h-5 w-5" /> : s}
              </div>
              {s < 3 && (
                <div className={cn(
                  'w-16 h-1 mx-1',
                  step > s ? 'bg-primary' : 'bg-muted'
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Select Course */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center pb-4">
              <h3 className="text-lg font-semibold">{t('calendar.step1Title', 'Select a Course')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('calendar.step1Desc', 'Choose the course you want to create a study plan for')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t('calendar.course', 'Course')}</Label>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('calendar.selectCourse', 'Select a course')} />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        {course.title}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCourse && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">{selectedCourse.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedCourse.description || t('calendar.noDescription', 'No description')}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="text-muted-foreground">
                    📚 {selectedCourse.chapterCount || 0} {t('calendar.chapters', 'chapters')}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button 
                onClick={() => setStep(2)} 
                disabled={!selectedCourseId}
              >
                {t('common.next', 'Next')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Configure Schedule */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center pb-4">
              <h3 className="text-lg font-semibold">{t('calendar.step2Title', 'Configure Schedule')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('calendar.step2Desc', 'Set your exam date and study preferences')}
              </p>
            </div>

            {/* Exam Date */}
            <div className="space-y-2">
              <Label htmlFor="examDate" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                {t('calendar.examDate', 'Exam Date')}
              </Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="examDate"
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Study Days */}
            <div className="space-y-2">
              <Label>{t('calendar.studyDays', 'Study Days')}</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleStudyDay(day.value)}
                    className={cn(
                      'px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all',
                      studyDays.includes(day.value)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted hover:border-muted-foreground/50'
                    )}
                  >
                    {t(`calendar.weekdays.${day.label.toLowerCase()}`, day.label)}
                  </button>
                ))}
              </div>
            </div>

            {/* Sessions Per Day & Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('calendar.sessionsPerDay', 'Sessions per Day')}</Label>
                <Select 
                  value={String(sessionsPerDay)} 
                  onValueChange={(v) => setSessionsPerDay(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('calendar.sessionDuration', 'Session Duration')}</Label>
                <Select 
                  value={String(sessionDuration)} 
                  onValueChange={(v) => setSessionDuration(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 {t('calendar.minutes', 'minutes')}</SelectItem>
                    <SelectItem value="45">45 {t('calendar.minutes', 'minutes')}</SelectItem>
                    <SelectItem value="60">1 {t('calendar.hour', 'hour')}</SelectItem>
                    <SelectItem value="90">1.5 {t('calendar.hours', 'hours')}</SelectItem>
                    <SelectItem value="120">2 {t('calendar.hours', 'hours')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preferred Time */}
            <div className="space-y-2">
              <Label htmlFor="preferredTime" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t('calendar.preferredTime', 'Preferred Start Time')}
              </Label>
              <Input
                id="preferredTime"
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
              />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                {t('common.back', 'Back')}
              </Button>
              <Button onClick={handleGenerate} disabled={loading}>
                {loading ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                    {t('calendar.generating', 'Generating...')}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t('calendar.generate', 'Generate Plan')}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && result && (
          <div className="space-y-6 text-center">
            <div className="py-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold">{t('calendar.planCreated', 'Study Plan Created!')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('calendar.planCreatedDesc', 'Your study schedule has been added to your calendar')}
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-left">
              <h4 className="font-medium mb-3">{result.courseTitle}</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('calendar.chapters', 'Chapters')}:</span>
                  <span className="ml-2 font-medium">{result.chaptersCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('calendar.eventsCreated', 'Events')}:</span>
                  <span className="ml-2 font-medium">{result.eventsCreated}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('calendar.firstSession', 'First session')}:</span>
                  <span className="ml-2 font-medium">
                    {format(new Date(result.firstStudyDate), 'MMM d')}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('calendar.exam', 'Exam')}:</span>
                  <span className="ml-2 font-medium">
                    {format(new Date(result.examDate), 'MMM d')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={onClose}>
                {t('common.close', 'Close')}
              </Button>
              <Button onClick={onGenerated}>
                {t('calendar.viewCalendar', 'View Calendar')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default StudyPlanWizard;
