import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { createChapter } from '@/services';
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

const createChapterSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
});

type CreateChapterForm = z.infer<typeof createChapterSchema>;

interface CreateChapterDialogProps {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateChapterDialog({ courseId, open, onOpenChange }: CreateChapterDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateChapterForm>({
    resolver: zodResolver(createChapterSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  });

  const createChapterMutation = useMutation({
    mutationFn: (data: CreateChapterForm) => createChapter(courseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', courseId] });
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(t('chapters.createSuccess'));
      reset();
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t('chapters.createError'));
    },
  });

  const onSubmit = (data: CreateChapterForm) => {
    createChapterMutation.mutate(data);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      reset();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('chapters.createTitle')}</DialogTitle>
          <DialogDescription>{t('chapters.createDescription')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chapter-title">{t('chapters.fields.title')} *</Label>
            <Input
              id="chapter-title"
              {...register('title')}
              placeholder={t('chapters.fields.titlePlaceholder')}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="chapter-description">{t('chapters.fields.description')}</Label>
            <Textarea
              id="chapter-description"
              {...register('description')}
              placeholder={t('chapters.fields.descriptionPlaceholder')}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createChapterMutation.isPending}>
              {createChapterMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('chapters.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
