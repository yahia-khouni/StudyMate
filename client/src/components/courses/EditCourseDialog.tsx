import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { updateCourse, type Course } from '@/services';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useEffect } from 'react';

const updateCourseSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(255),
  description: z.string().optional(),
  syllabus: z.string().optional(),
  language: z.enum(['en', 'fr']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

type UpdateCourseForm = z.infer<typeof updateCourseSchema>;

interface EditCourseDialogProps {
  course: Course;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const colorOptions = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#3b82f6', label: 'Blue' },
];

export function EditCourseDialog({ course, open, onOpenChange }: EditCourseDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UpdateCourseForm>({
    resolver: zodResolver(updateCourseSchema),
    defaultValues: {
      title: course.title,
      description: course.description || '',
      syllabus: course.syllabus || '',
      language: course.language,
      color: course.color || '#6366f1',
    },
  });

  // Reset form when course changes
  useEffect(() => {
    reset({
      title: course.title,
      description: course.description || '',
      syllabus: course.syllabus || '',
      language: course.language,
      color: course.color || '#6366f1',
    });
  }, [course, reset]);

  const selectedColor = watch('color');

  const updateCourseMutation = useMutation({
    mutationFn: (data: UpdateCourseForm) => updateCourse(course.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['course', course.id] });
      toast.success(t('courses.updateSuccess'));
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t('courses.updateError'));
    },
  });

  const onSubmit = (data: UpdateCourseForm) => {
    updateCourseMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('courses.editTitle')}</DialogTitle>
          <DialogDescription>{t('courses.editDescription')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">{t('courses.fields.title')} *</Label>
            <Input
              id="edit-title"
              {...register('title')}
              placeholder={t('courses.fields.titlePlaceholder')}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">{t('courses.fields.description')}</Label>
            <Textarea
              id="edit-description"
              {...register('description')}
              placeholder={t('courses.fields.descriptionPlaceholder')}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-syllabus">{t('courses.fields.syllabus')}</Label>
            <Textarea
              id="edit-syllabus"
              {...register('syllabus')}
              placeholder={t('courses.fields.syllabusPlaceholder')}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('courses.fields.language')}</Label>
              <Select
                value={watch('language')}
                onValueChange={(value: 'en' | 'fr') => setValue('language', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('courses.fields.color')}</Label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      selectedColor === color.value
                        ? 'border-foreground scale-110'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setValue('color', color.value)}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={updateCourseMutation.isPending}>
              {updateCourseMutation.isPending && (
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
