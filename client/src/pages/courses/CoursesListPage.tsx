import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, BookOpen, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { getCourses, deleteCourse, type Course } from '@/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export function CoursesListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);

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
    },
    onError: () => {
      toast.error(t('courses.deleteError'));
    },
  });

  const handleDelete = (courseId: string) => {
    if (confirm(t('courses.confirmDelete'))) {
      deleteCourseMutation.mutate(courseId);
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
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('courses.title')}</h1>
          <p className="text-muted-foreground">{t('courses.subtitle')}</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('courses.create')}
        </Button>
      </div>

      {/* Streak Widget */}
      <div className="mb-8">
        <StreakWidget />
      </div>

      {courses.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('courses.empty')}</h3>
            <p className="text-muted-foreground mb-4">{t('courses.emptyDescription')}</p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('courses.createFirst')}
            </Button>
          </CardContent>
        </Card>
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

  return (
    <Card className="group relative overflow-hidden hover:shadow-lg transition-shadow">
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: course.color || '#6366f1' }}
      />
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <Link to={`/courses/${course.id}`} className="flex-1">
          <CardTitle className="text-lg hover:text-primary transition-colors line-clamp-2">
            {course.title}
          </CardTitle>
        </Link>
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
      </CardHeader>
      <CardContent>
        <Link to={`/courses/${course.id}`}>
          {course.description && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{course.description}</p>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('courses.progress')}</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

export default CoursesListPage;
