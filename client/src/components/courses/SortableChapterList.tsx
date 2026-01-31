/**
 * Sortable Chapter List
 * Drag and drop functionality for reordering chapters
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Edit,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { type Chapter } from '@/services';

interface SortableChapterListProps {
  chapters: Chapter[];
  courseId: string;
  onReorder: (chapterIds: string[]) => void;
  onEdit: (chapter: Chapter) => void;
  onDelete: (chapterId: string) => void;
  onMarkComplete: (chapterId: string) => void;
}

export function SortableChapterList({
  chapters,
  courseId,
  onReorder,
  onEdit,
  onDelete,
  onMarkComplete,
}: SortableChapterListProps) {
  const [items, setItems] = useState(chapters);
  
  // Update local state when chapters prop changes
  if (chapters.length !== items.length || chapters.some((c, i) => c.id !== items[i]?.id)) {
    setItems(chapters);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      
      // Call the reorder API with new order
      onReorder(newItems.map((item) => item.id));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {items.map((chapter, index) => (
            <SortableChapterCard
              key={chapter.id}
              chapter={chapter}
              courseId={courseId}
              index={index}
              onEdit={() => onEdit(chapter)}
              onDelete={() => onDelete(chapter.id)}
              onMarkComplete={() => onMarkComplete(chapter.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface SortableChapterCardProps {
  chapter: Chapter;
  courseId: string;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onMarkComplete: () => void;
}

function SortableChapterCard({
  chapter,
  courseId,
  index,
  onEdit,
  onDelete,
  onMarkComplete,
}: SortableChapterCardProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const statusConfig = {
    draft: { icon: Clock, color: 'text-yellow-500', label: t('chapters.status.draft') },
    processing: { icon: Loader2, color: 'text-blue-500 animate-spin', label: t('chapters.status.processing') },
    ready: { icon: AlertCircle, color: 'text-green-500', label: t('chapters.status.ready') },
    completed: { icon: CheckCircle, color: 'text-green-600', label: t('chapters.status.completed') },
  };

  const status = statusConfig[chapter.status];
  const StatusIcon = status.icon;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'group transition-shadow',
        isDragging && 'shadow-lg ring-2 ring-primary/20 opacity-90'
      )}
    >
      <CardContent className="flex items-center gap-4 py-4">
        {/* Drag Handle */}
        <button
          className="flex items-center gap-2 text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
          aria-label={t('chapters.dragToReorder', 'Drag to reorder')}
        >
          <GripVertical className="h-5 w-5" />
          <span className="font-medium w-8 text-center">{index + 1}</span>
        </button>

        {/* Chapter Link */}
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

        {/* Status & Materials */}
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="flex items-center gap-1">
            <StatusIcon className={cn('h-3 w-3', status.color)} />
            {status.label}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {chapter.processedMaterials}/{chapter.materialCount}
          </span>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={t('common.more', 'More actions')}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              {t('common.edit')}
            </DropdownMenuItem>
            {chapter.status !== 'completed' && (
              <DropdownMenuItem onClick={onMarkComplete}>
                <CheckCircle className="mr-2 h-4 w-4" />
                {t('chapters.markComplete')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('common.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

export default SortableChapterList;
