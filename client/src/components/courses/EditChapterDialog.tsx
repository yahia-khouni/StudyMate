import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { updateChapter, type Chapter } from '@/services';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useEffect } from 'react';

const updateChapterSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
});

type UpdateChapterForm = z.infer<typeof updateChapterSchema>;

interface EditChapterDialogProps {
  courseId: string;
  chapter: Chapter;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditChapterDialog({ courseId, chapter, open, onOpenChange }: EditChapterDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateChapterForm>({
    resolver: zodResolver(updateChapterSchema),
    defaultValues: {
      title: chapter.title,
      description: chapter.description || '',
    },
  });

  // Reset form when chapter changes
  useEffect(() => {
    reset({
      title: chapter.title,
      description: chapter.description || '',
    });
  }, [chapter, reset]);

  const updateChapterMutation = useMutation({
    mutationFn: (data: UpdateChapterForm) => updateChapter(courseId, chapter.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', courseId] });
      queryClient.invalidateQueries({ queryKey: ['chapter', courseId, chapter.id] });
      toast.success(t('chapters.updateSuccess'));
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t('chapters.updateError'));
    },
  });

  const onSubmit = (data: UpdateChapterForm) => {
    updateChapterMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('chapters.editTitle')}</DialogTitle>
          <DialogDescription>{t('chapters.editDescription')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-chapter-title">{t('chapters.fields.title')} *</Label>
            <Input
              id="edit-chapter-title"
              {...register('title')}
              placeholder={t('chapters.fields.titlePlaceholder')}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-chapter-description">{t('chapters.fields.description')}</Label>
            <Textarea
              id="edit-chapter-description"
              {...register('description')}
              placeholder={t('chapters.fields.descriptionPlaceholder')}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={updateChapterMutation.isPending}>
              {updateChapterMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
