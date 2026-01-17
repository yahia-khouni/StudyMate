/**
 * Streak Widget Component
 * Displays current streak with flame animation
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, Trophy, Calendar, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import streakService, { StreakInfo, ActivityHistory } from '@/services/streak.service';

interface StreakWidgetProps {
  className?: string;
  showHistory?: boolean;
  compact?: boolean;
}

export function StreakWidget({ className, showHistory = false, compact = false }: StreakWidgetProps) {
  const { t } = useTranslation();
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [history, setHistory] = useState<ActivityHistory | null>(null);
  const [hasActivityToday, setHasActivityToday] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStreakData() {
      try {
        setLoading(true);
        const [streakData, activityToday] = await Promise.all([
          streakService.getStreak(),
          streakService.hasActivityToday(),
        ]);
        setStreak(streakData);
        setHasActivityToday(activityToday);

        if (showHistory) {
          const historyData = await streakService.getActivityHistory(30);
          setHistory(historyData);
        }
      } catch (error) {
        console.error('Failed to load streak data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadStreakData();
  }, [showHistory]);

  if (loading) {
    return (
      <div className={cn('animate-pulse bg-muted rounded-lg p-4', className)}>
        <div className="h-8 bg-muted-foreground/10 rounded w-24" />
      </div>
    );
  }

  if (!streak) return null;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className={cn(
          'relative',
          streak.currentStreak > 0 && hasActivityToday && 'animate-pulse'
        )}>
          <Flame 
            className={cn(
              'h-5 w-5',
              streak.currentStreak > 0 
                ? 'text-orange-500 fill-orange-500' 
                : 'text-muted-foreground'
            )} 
          />
          {streak.currentStreak > 0 && hasActivityToday && (
            <span className="absolute -inset-1 rounded-full bg-orange-500/20 animate-ping" />
          )}
        </div>
        <span className="font-bold text-lg">
          {streak.currentStreak}
        </span>
      </div>
    );
  }

  return (
    <div className={cn(
      'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 rounded-xl p-6 border border-orange-200 dark:border-orange-800',
      className
    )}>
      {/* Main Streak Display */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'relative p-3 rounded-full bg-gradient-to-br from-orange-400 to-red-500',
            streak.currentStreak > 0 && hasActivityToday && 'streak-flame'
          )}>
            <Flame className="h-8 w-8 text-white" />
            {streak.currentStreak > 0 && (
              <span className="absolute inset-0 rounded-full bg-orange-400 animate-ping opacity-25" />
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t('dashboard.currentStreak', 'Current Streak')}
            </p>
            <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {streak.currentStreak}
              <span className="text-lg font-normal text-muted-foreground ml-1">
                {t('dashboard.days', 'days')}
              </span>
            </p>
          </div>
        </div>

        {!hasActivityToday && streak.currentStreak > 0 && (
          <div className="bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {t('dashboard.studyToday', 'Study today!')}
          </div>
        )}

        {hasActivityToday && (
          <div className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            {t('dashboard.onTrack', 'On track!')}
          </div>
        )}
      </div>

      {/* Longest Streak */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Trophy className="h-4 w-4 text-amber-500" />
        <span>
          {t('dashboard.longestStreak', 'Longest')}: 
          <span className="font-semibold text-foreground ml-1">
            {streak.longestStreak} {t('dashboard.days', 'days')}
          </span>
        </span>
      </div>

      {/* Activity History Heatmap */}
      {showHistory && history && (
        <div className="mt-4 pt-4 border-t border-orange-200 dark:border-orange-800">
          <p className="text-xs text-muted-foreground mb-2">
            {t('dashboard.last30Days', 'Last 30 days')}
          </p>
          <div className="flex flex-wrap gap-1">
            {generateLast30Days().map((date) => {
              const count = history.dailyActivity[date] || 0;
              return (
                <div
                  key={date}
                  className={cn(
                    'w-3 h-3 rounded-sm transition-colors',
                    count === 0 && 'bg-muted',
                    count === 1 && 'bg-orange-200 dark:bg-orange-800',
                    count === 2 && 'bg-orange-300 dark:bg-orange-700',
                    count >= 3 && 'bg-orange-500 dark:bg-orange-500',
                  )}
                  title={`${date}: ${count} activities`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Activity Stats */}
      {showHistory && history && (
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <ActivityStat 
            label={t('dashboard.uploads', 'Uploads')} 
            count={history.totalActivities.upload} 
          />
          <ActivityStat 
            label={t('dashboard.quizzes', 'Quizzes')} 
            count={history.totalActivities.quiz} 
          />
          <ActivityStat 
            label={t('dashboard.flashcards', 'Flashcards')} 
            count={history.totalActivities.flashcard_review} 
          />
          <ActivityStat 
            label={t('dashboard.chats', 'Chats')} 
            count={history.totalActivities.chat} 
          />
        </div>
      )}
    </div>
  );
}

function ActivityStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="bg-white/50 dark:bg-white/5 rounded-lg p-2">
      <p className="text-lg font-bold text-foreground">{count}</p>
      <p className="text-xs text-muted-foreground truncate">{label}</p>
    </div>
  );
}

function generateLast30Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    days.push(date.toISOString().split('T')[0]);
  }
  
  return days;
}

export default StreakWidget;
