import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, BookOpen, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { getCourses, deleteCourse, type Course } from '@/services';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { CreateCourseDialog } from '@/components/courses/CreateCourseDialog';
import { EditCourseDialog } from '@/components/courses/EditCourseDialog';
import { StreakWidget } from '@/components/dashboard/StreakWidget';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export function CoursesListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['courses'],
    queryFn: getCourses,
  });

  // Extract courses array from paginated response
  const courses = data?.courses ?? [];

  const deleteCourseMutation = useMutation({
    mutationFn: deleteCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success(t('courses.deleteSuccess'));
      setDeleteConfirm(null);
    },
    onError: () => {
      toast.error(t('courses.deleteError'));
    },
  });

  const handleDelete = (courseId: string) => {
    setDeleteConfirm(courseId);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteCourseMutation.mutate(deleteConfirm);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-destructive">{t('courses.loadError')}</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['courses'] })}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('courses.title')}</h1>
          <p className="text-muted-foreground">{t('courses.subtitle')}</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('courses.create')}
        </Button>
      </div>

      {/* Streak Widget */}
      <div className="mb-8">
        <StreakWidget />
      </div>

      {courses.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border text-center py-12 px-6">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2 text-foreground">{t('courses.empty')}</h3>
          <p className="text-muted-foreground mb-4">{t('courses.emptyDescription')}</p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('courses.createFirst')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onEdit={() => setEditCourse(course)}
              onDelete={() => handleDelete(course.id)}
            />
          ))}
        </div>
      )}

      <CreateCourseDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      
      {editCourse && (
        <EditCourseDialog
          course={editCourse}
          open={!!editCourse}
          onOpenChange={(open) => !open && setEditCourse(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title={t('courses.deleteCourse')}
        description={t('courses.confirmDelete')}
        confirmText={t('common.delete')}
        onConfirm={confirmDelete}
        variant="danger"
        loading={deleteCourseMutation.isPending}
      />
    </div>
  );
}

interface CourseCardProps {
  course: Course;
  onEdit: () => void;
  onDelete: () => void;
}

function CourseCard({ course, onEdit, onDelete }: CourseCardProps) {
  const { t } = useTranslation();

  // Use progress from API response
  const progress = course.progress || 0;

  // Status badge
  const getStatus = (progress: number) => {
    if (progress >= 90) return { label: t('status.completed', 'Completed'), className: 'status-badge-completed' };
    if (progress >= 50) return { label: t('status.onTrack', 'On Track'), className: 'status-badge-success' };
    return { label: t('status.needsReview', 'Needs Review'), className: 'status-badge-warning' };
  };
  const status = getStatus(progress);

  return (
    <div className="course-card group relative overflow-hidden">
      {/* Color accent bar */}
      <div
        className="absolute inset-x-0 top-0 h-1 rounded-t-xl"
        style={{ backgroundColor: course.color || '#6366f1' }}
      />
      
      <div className="flex items-start gap-4 pt-2">
        {/* Course Icon */}
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${course.color || '#6366f1'}20` }}
        >
          <BookOpen className="h-6 w-6" style={{ color: course.color || '#6366f1' }} />
        </div>

        {/* Course Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <Link to={`/courses/${course.id}`} className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate hover:text-primary transition-colors">
                {course.title}
              </h3>
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`status-badge ${status.className}`}>
                {status.label}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">{t('common.more')}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit className="mr-2 h-4 w-4" />
                    {t('common.edit')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('common.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Link to={`/courses/${course.id}`}>
            {course.description && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{course.description}</p>
            )}
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-end">
                <span className="text-xs text-muted-foreground">{progress}%</span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default CoursesListPage;
