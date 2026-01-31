import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Flame,
  Brain,
  Clock,
  ChevronRight,
  Upload,
  FileQuestion,
  Layers,
  Mic,
  Plus,
  TrendingUp,
  BookOpen,
  Target,
  FileText,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getDashboardData, type DashboardData } from '@/services/progress.service';
import { formatDistanceToNow, format, parseISO, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'fr' ? fr : enUS;
  const { user } = useAuthStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardData,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl bg-card p-8 text-center border border-border">
          <p className="text-destructive">{t('dashboard.loadError', 'Failed to load dashboard')}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            {t('common.retry', 'Retry')}
          </Button>
        </div>
      </div>
    );
  }

  // Calculate stats from API data
  const studyStreak = data?.stats?.streak?.current || 0;
  const cardsMastered = data?.stats?.flashcards?.masteredCards || 0;
  const totalReviews = data?.stats?.flashcards?.totalReviews || 0;
  
  // Calculate hours learned (estimate ~3 minutes per activity)
  const totalActivities = (data?.weeklyActivity?.totalActivities || 0) + totalReviews;
  const hoursLearned = Math.round(totalActivities * 3 / 60) || 0;
  
  // Weekly activity stats
  const weeklyFlashcards = data?.weeklyActivity?.byType?.flashcardReviews || 0;
  const weeklyActivities = data?.weeklyActivity?.totalActivities || 0;
  
  // Calculate weekly progress percentage (goal: 50 activities/week)
  const weeklyGoal = 50;
  const weeklyProgress = Math.min(100, Math.round(weeklyActivities / weeklyGoal * 100));
  
  // Hours this week
  const hoursThisWeek = (weeklyActivities * 3 / 60).toFixed(1);
  
  // Calculate streak percentile based on streak length
  const getStreakPercentile = (streak: number) => {
    if (streak >= 30) return 1;
    if (streak >= 14) return 5;
    if (streak >= 7) return 10;
    if (streak >= 3) return 25;
    return 50;
  };
  const streakPercentile = getStreakPercentile(studyStreak);
  
  // Get next deadline info
  const nextDeadline = data?.upcomingDeadlines?.[0];
  const getDeadlineText = () => {
    if (!nextDeadline) return null;
    try {
      const deadlineDate = parseISO(nextDeadline.date);
      const daysUntil = differenceInDays(deadlineDate, new Date());
      
      if (daysUntil === 0) return t('dashboard.deadlineToday', 'Today');
      if (daysUntil === 1) return t('dashboard.deadlineTomorrow', 'Tomorrow');
      if (daysUntil < 0) return t('dashboard.deadlinePassed', 'Passed');
      return t('dashboard.inXDays', 'In {{days}} days', { days: daysUntil });
    } catch {
      return t('dashboard.upcoming', 'Upcoming');
    }
  };

  return (
    <div className="p-6">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          {t('dashboard.welcomeBack', 'Welcome back, {{name}}', { name: user?.firstName || 'Student' })} 
          <span className="text-2xl">👋</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          {weeklyProgress > 0 
            ? t('dashboard.progressMessageDynamic', "You've completed {{percent}}% of your weekly goals. {{encouragement}}", { 
                percent: weeklyProgress,
                encouragement: weeklyProgress >= 75 ? t('dashboard.keepItUp', 'Keep it up!') : weeklyProgress >= 50 ? t('dashboard.almostThere', 'Almost there!') : t('dashboard.keepGoing', 'Keep going!')
              })
            : t('dashboard.startLearning', 'Start learning to track your progress!')
          }
        </p>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Study Streak */}
        <div className="stats-card stats-card-blue">
          <div className="stats-icon">
            <Flame className="h-5 w-5" />
          </div>
          <p className="stats-label">{t('dashboard.studyStreak', 'Study Streak')}</p>
          <p className="stats-value">{studyStreak} {t('dashboard.days', 'Days')}</p>
          <div className="stats-subtitle stats-subtitle-success">
            <TrendingUp className="h-3 w-3" />
            <span>{studyStreak > 0 
              ? t('dashboard.topPercentLearners', 'Top {{percent}}% of learners', { percent: streakPercentile })
              : t('dashboard.startStreak', 'Start your streak!')}
            </span>
          </div>
          {/* Red accent line at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500" />
        </div>

        {/* Cards Mastered */}
        <div className="stats-card stats-card-cyan">
          <div className="stats-icon">
            <Brain className="h-5 w-5" />
          </div>
          <p className="stats-label">{t('dashboard.cardsMastered', 'Cards Mastered')}</p>
          <p className="stats-value">{cardsMastered}</p>
          <div className="stats-subtitle stats-subtitle-info">
            <TrendingUp className="h-3 w-3" />
            <span>{weeklyFlashcards > 0 
              ? `+${weeklyFlashcards} ${t('dashboard.thisWeek', 'this week')}`
              : t('dashboard.reviewCards', 'Review some cards!')}
            </span>
          </div>
        </div>

        {/* Hours Learned */}
        <div className="stats-card stats-card-purple">
          <div className="stats-icon">
            <Clock className="h-5 w-5" />
          </div>
          <p className="stats-label">{t('dashboard.hoursLearned', 'Hours Learned')}</p>
          <p className="stats-value">{hoursLearned}h</p>
          <div className="stats-subtitle stats-subtitle-info">
            <TrendingUp className="h-3 w-3" />
            <span>{Number(hoursThisWeek) > 0 
              ? `+${hoursThisWeek}h ${t('dashboard.thisWeek', 'this week')}`
              : t('dashboard.startLearningHours', 'Start learning!')}
            </span>
          </div>
        </div>

        {/* Up Next Card */}
        <div className="up-next-card">
          <p className="up-next-label">{t('dashboard.upNext', 'UP NEXT')}</p>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {nextDeadline?.title || t('dashboard.noUpcoming', 'No upcoming deadlines')}
          </h3>
          <div className="flex items-center gap-3 mt-4">
            {nextDeadline ? (
              <>
                <span className="text-sm text-muted-foreground">
                  {getDeadlineText()}
                </span>
                <Link to={`/calendar`}>
                  <Button size="sm" variant="secondary" className="bg-muted/80 text-foreground hover:bg-muted">
                    {t('dashboard.prepareNow', 'Prepare Now')}
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/calendar">
                <Button size="sm" variant="secondary" className="bg-muted/80 text-foreground hover:bg-muted">
                  <Plus className="h-4 w-4 mr-1" />
                  {t('dashboard.addDeadline', 'Add Deadline')}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Active Courses & Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Courses */}
          <div className="rounded-2xl bg-card p-6 border border-border">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">
                {t('dashboard.activeCourses', 'Active Courses')}
              </h2>
              <Link to="/courses" className="text-sm text-primary hover:underline flex items-center gap-1">
                {t('common.viewAll', 'View All')}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {data?.courses?.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {t('dashboard.noCourses', 'No courses yet. Create your first course!')}
                </p>
                <Link to="/courses">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('courses.create', 'Create Course')}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {data?.courses?.slice(0, 3).map((course, index) => (
                  <CourseCard key={course.id} course={course} index={index} />
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl bg-card p-6 border border-border">
            <h2 className="text-lg font-semibold text-foreground mb-5">
              {t('dashboard.recentActivity', 'Recent Activity')}
            </h2>
            
            {data?.recentActivity?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('dashboard.noActivity', 'No recent activity')}
              </p>
            ) : (
              <div className="space-y-3">
                {data?.recentActivity?.slice(0, 5).map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} locale={locale} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Quick Actions & Deadlines */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="rounded-2xl bg-card p-6 border border-border">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">
              {t('dashboard.quickActions', 'QUICK ACTIONS')}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <QuickActionButton
                icon={<Upload className="h-5 w-5" />}
                label={t('dashboard.uploadPDF', 'Upload PDF')}
                href="/courses"
                iconBg="bg-primary/20"
                iconColor="text-primary"
              />
              <QuickActionButton
                icon={<FileQuestion className="h-5 w-5" />}
                label={t('dashboard.newQuiz', 'New Quiz')}
                href="/courses"
                iconBg="bg-emerald-500/20"
                iconColor="text-emerald-500"
                badge="2"
              />
              <QuickActionButton
                icon={<Layers className="h-5 w-5" />}
                label={t('dashboard.flashcards', 'Flashcards')}
                href="/courses"
                iconBg="bg-purple-500/20"
                iconColor="text-purple-500"
              />
              <QuickActionButton
                icon={<Mic className="h-5 w-5" />}
                label={t('dashboard.audioNotes', 'Audio Notes')}
                href="/courses"
                iconBg="bg-rose-500/20"
                iconColor="text-rose-500"
              />
            </div>
          </div>

          {/* Deadlines */}
          <div className="rounded-2xl bg-card p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-muted-foreground">
                {t('dashboard.deadlines', 'Deadlines')}
              </h2>
              <Link to="/calendar" className="text-xs text-primary hover:underline">
                {t('common.viewCalendar', 'View Calendar')}
              </Link>
            </div>

            {data?.upcomingDeadlines?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('dashboard.noDeadlines', 'No upcoming deadlines')}
              </p>
            ) : (
              <div className="space-y-3">
                {data?.upcomingDeadlines?.slice(0, 3).map((deadline) => (
                  <DeadlineItem key={deadline.id} deadline={deadline} locale={locale} />
                ))}
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full mt-4 text-muted-foreground">
              <Plus className="h-4 w-4 mr-2" />
              {t('dashboard.addDeadline', 'Add Deadline')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Course Card Component
function CourseCard({ course, index }: { course: DashboardData['courses'][0]; index: number }) {
  const { t } = useTranslation();
  
  const getStatusBadge = (progress: number) => {
    if (progress >= 90) {
      return { label: t('status.completed', 'Completed'), className: 'status-badge-completed' };
    }
    if (progress >= 50) {
      return { label: t('status.onTrack', 'On Track'), className: 'status-badge-success' };
    }
    return { label: t('status.needsReview', 'Needs Review'), className: 'status-badge-warning' };
  };

  const status = getStatusBadge(course.progress);
  
  // Cycle through color schemes based on index
  const colorSchemes = [
    { icon: 'course-icon-blue', progress: 'progress-blue', IconComponent: BookOpen },
    { icon: 'course-icon-pink', progress: 'progress-pink', IconComponent: Layers },
    { icon: 'course-icon-teal', progress: 'progress-teal', IconComponent: Brain },
    { icon: 'course-icon-orange', progress: 'progress-orange', IconComponent: Target },
    { icon: 'course-icon-purple', progress: 'progress-purple', IconComponent: FileText },
  ];
  
  const scheme = colorSchemes[index % colorSchemes.length];
  const Icon = scheme.IconComponent;

  return (
    <Link to={`/courses/${course.id}`} className="block">
      <div className="course-card group">
        <div className="flex items-start gap-4">
          {/* Course Icon */}
          <div className={cn('course-icon', scheme.icon)}>
            <Icon className="h-6 w-6" />
          </div>

          {/* Course Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {course.name}
              </h3>
              <span className={cn('status-badge', status.className)}>
                {status.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {t('dashboard.chapterInfo', 'Chapter {{current}}: {{topic}}', {
                current: course.completedChapters + 1,
                topic: course.chapterCount > 0 ? `Module ${course.completedChapters + 1}` : 'Getting Started'
              })}
            </p>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className={scheme.progress}>
                <Progress value={course.progress} className="h-2" />
              </div>
              <div className="flex justify-end">
                <span className="text-xs text-muted-foreground">{course.progress}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Quick Action Button Component
function QuickActionButton({
  icon,
  label,
  href,
  iconBg,
  iconColor,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  iconBg: string;
  iconColor: string;
  badge?: string;
}) {
  return (
    <Link to={href}>
      <div className="quick-action-btn relative">
        {badge && (
          <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center">
            {badge}
          </span>
        )}
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBg)}>
          <span className={iconColor}>{icon}</span>
        </div>
        <span className="text-sm text-foreground">{label}</span>
      </div>
    </Link>
  );
}

// Deadline Item Component
function DeadlineItem({
  deadline,
  locale,
}: {
  deadline: DashboardData['upcomingDeadlines'][0];
  locale: typeof enUS;
}) {
  const date = parseISO(deadline.date);
  const month = format(date, 'MMM', { locale }).toUpperCase();
  const day = format(date, 'd', { locale });
  const time = format(date, 'h:mm a', { locale });

  // Determine badge color based on urgency
  const isUrgent = isToday(date) || isTomorrow(date);
  const badgeBg = isUrgent ? 'bg-rose-500/20' : 'bg-primary/20';
  const badgeText = isUrgent ? 'text-rose-400' : 'text-primary';

  return (
    <div className="deadline-item">
      <div className={cn('deadline-date', badgeBg)}>
        <span className={cn('text-[10px] font-medium', badgeText)}>{month}</span>
        <span className={cn('text-lg font-bold', badgeText)}>{day}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{deadline.title}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  );
}

// Activity Item Component
function ActivityItem({
  activity,
  locale,
}: {
  activity: DashboardData['recentActivity'][0];
  locale: typeof enUS;
}) {
  const { t } = useTranslation();

  const activityConfig: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
    upload: { icon: Upload, label: t('dashboard.uploadedFile', 'Uploaded file'), color: 'text-primary', bg: 'bg-primary/20' },
    quiz: { icon: Target, label: t('dashboard.tookQuiz', 'Took quiz'), color: 'text-emerald-500', bg: 'bg-emerald-500/20' },
    flashcard_review: { icon: Brain, label: t('dashboard.reviewedFlashcards', 'Reviewed flashcards'), color: 'text-purple-500', bg: 'bg-purple-500/20' },
    chat: { icon: MessageSquare, label: t('dashboard.chatSession', 'Chat session'), color: 'text-amber-500', bg: 'bg-amber-500/20' },
    summary: { icon: FileText, label: t('dashboard.generatedSummary', 'Generated Summary'), color: 'text-cyan-500', bg: 'bg-cyan-500/20' },
  };

  const config = activityConfig[activity.type] || {
    icon: FileText,
    label: activity.type,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
  };
  const Icon = config.icon;

  const timeAgo = formatDistanceToNow(parseISO(activity.timestamp), {
    addSuffix: true,
    locale,
  });

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', config.bg)}>
        <Icon className={cn('h-4 w-4', config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{config.label}</p>
        <p className="text-xs text-muted-foreground">
          {activity.entityType || 'Study session'}
        </p>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{timeAgo}</span>
    </div>
  );
}

// Loading Skeleton
function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div>
        <div className="h-8 bg-muted rounded w-64 mb-2" />
        <div className="h-4 bg-muted rounded w-96" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-muted rounded-2xl" />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-80 bg-muted rounded-2xl" />
          <div className="h-48 bg-muted rounded-2xl" />
        </div>
        <div className="space-y-6">
          <div className="h-48 bg-muted rounded-2xl" />
          <div className="h-64 bg-muted rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
