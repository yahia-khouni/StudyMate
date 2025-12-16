import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  GripVertical,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  MessageSquare,
  X,
} from 'lucide-react';
import { useState } from 'react';
import {
  getCourseWithProgress,
  getChapters,
  deleteChapter,
  markChapterComplete,
  type Chapter,
} from '@/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CreateChapterDialog } from '@/components/courses/CreateChapterDialog';
import { EditChapterDialog } from '@/components/courses/EditChapterDialog';
import { ChatInterface } from '@/components/learning';

export function CourseDetailPage() {
  const { t } = useTranslation();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateChapterOpen, setIsCreateChapterOpen] = useState(false);
  const [editChapter, setEditChapter] = useState<Chapter | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // courseId is already a string (UUID)
  const courseIdStr = courseId || '';

  const {
    data: course,
    isLoading: courseLoading,
    error: courseError,
  } = useQuery({
    queryKey: ['course', courseIdStr],
    queryFn: () => getCourseWithProgress(courseIdStr),
    enabled: !!courseIdStr,
  });

  const {
    data: chapters = [],
    isLoading: chaptersLoading,
    error: chaptersError,
  } = useQuery({
    queryKey: ['chapters', courseIdStr],
    queryFn: () => getChapters(courseIdStr),
    enabled: !!courseIdStr,
  });

  const deleteChapterMutation = useMutation({
    mutationFn: (chapterId: string) => deleteChapter(courseIdStr, chapterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', courseIdStr] });
      queryClient.invalidateQueries({ queryKey: ['course', courseIdStr] });
      toast.success(t('chapters.deleteSuccess'));
    },
    onError: () => {
      toast.error(t('chapters.deleteError'));
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: (chapterId: string) => markChapterComplete(courseIdStr, chapterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', courseIdStr] });
      queryClient.invalidateQueries({ queryKey: ['course', courseIdStr] });
      toast.success(t('chapters.markedComplete'));
    },
    onError: () => {
      toast.error(t('chapters.markCompleteError'));
    },
  });

  const handleDeleteChapter = (chapterId: string) => {
    if (confirm(t('chapters.confirmDelete'))) {
      deleteChapterMutation.mutate(chapterId);
    }
  };

  const isLoading = courseLoading || chaptersLoading;
  const error = courseError || chaptersError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="container py-8">
        <Button variant="ghost" onClick={() => navigate('/courses')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.back')}
        </Button>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-destructive">{t('courses.loadError')}</p>
          <Button onClick={() => navigate('/courses')}>{t('courses.backToList')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <Button variant="ghost" onClick={() => navigate('/courses')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('common.back')}
      </Button>

      {/* Course Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">{course.title}</h1>
            {course.description && (
              <p className="text-muted-foreground max-w-2xl">{course.description}</p>
            )}
          </div>
          <Badge variant={course.language === 'en' ? 'default' : 'secondary'}>
            {course.language.toUpperCase()}
          </Badge>
        </div>

        {/* Progress Overview */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold">{course.chapterCount}</div>
                <div className="text-sm text-muted-foreground">{t('courses.totalChapters')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{course.completedChapters}</div>
                <div className="text-sm text-muted-foreground">{t('courses.completedChapters')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{course.progress}%</div>
                <div className="text-sm text-muted-foreground">{t('courses.progress')}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Syllabus */}
        {course.syllabus && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{t('courses.syllabus')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{course.syllabus}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Chapters Section */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">{t('chapters.title')}</h2>
        <Button onClick={() => setIsCreateChapterOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('chapters.create')}
        </Button>
      </div>

      {chapters.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('chapters.empty')}</h3>
            <p className="text-muted-foreground mb-4">{t('chapters.emptyDescription')}</p>
            <Button onClick={() => setIsCreateChapterOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('chapters.createFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {chapters.map((chapter, index) => (
            <ChapterCard
              key={chapter.id}
              chapter={chapter}
              courseId={courseIdStr}
              index={index}
              onEdit={() => setEditChapter(chapter)}
              onDelete={() => handleDeleteChapter(chapter.id)}
              onMarkComplete={() => markCompleteMutation.mutate(chapter.id)}
            />
          ))}
        </div>
      )}

      <CreateChapterDialog
        courseId={courseIdStr}
        open={isCreateChapterOpen}
        onOpenChange={setIsCreateChapterOpen}
      />

      {editChapter && (
        <EditChapterDialog
          courseId={courseIdStr}
          chapter={editChapter}
          open={!!editChapter}
          onOpenChange={(open) => !open && setEditChapter(null)}
        />
      )}

      {/* Chat FAB Button */}
      <Button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40"
        size="icon"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>

      {/* Chat Panel */}
      {isChatOpen && (
        <div className="fixed bottom-6 right-6 w-[450px] h-[600px] bg-background border rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <span className="font-semibold">{t('learning.chat.title')}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatInterface 
              courseId={courseIdStr} 
              courseName={course.title}
              courseLanguage={course.language || 'en'}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface ChapterCardProps {
  chapter: Chapter;
  courseId: string;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onMarkComplete: () => void;
}

function ChapterCard({ chapter, courseId, index, onEdit, onDelete, onMarkComplete }: ChapterCardProps) {
  const { t } = useTranslation();

  const statusConfig = {
    draft: { icon: Clock, color: 'text-yellow-500', label: t('chapters.status.draft') },
    processing: { icon: Loader2, color: 'text-blue-500', label: t('chapters.status.processing') },
    ready: { icon: AlertCircle, color: 'text-green-500', label: t('chapters.status.ready') },
    completed: { icon: CheckCircle, color: 'text-green-600', label: t('chapters.status.completed') },
  };

  const status = statusConfig[chapter.status];
  const StatusIcon = status.icon;

  return (
    <Card className="group">
      <CardContent className="flex items-center gap-4 py-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <GripVertical className="h-5 w-5 cursor-grab" />
          <span className="font-medium w-8 text-center">{index + 1}</span>
        </div>

        <Link
          to={`/courses/${courseId}/chapters/${chapter.id}`}
          className="flex-1 min-w-0"
        >
          <div className="font-medium hover:text-primary transition-colors">
            {chapter.title}
          </div>
          {chapter.description && (
            <p className="text-sm text-muted-foreground truncate">{chapter.description}</p>
          )}
        </Link>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <StatusIcon className={`h-3 w-3 ${status.color} ${chapter.status === 'processing' ? 'animate-spin' : ''}`} />
            {status.label}
          </Badge>

          {chapter.status === 'ready' && (
            <Button variant="outline" size="sm" onClick={onMarkComplete}>
              <CheckCircle className="mr-1 h-3 w-3" />
              {t('chapters.markComplete')}
            </Button>
          )}

          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default CourseDetailPage;
