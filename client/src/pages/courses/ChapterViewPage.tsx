import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Upload, FileText, Trash2, CheckCircle, Clock, AlertCircle, Loader2, BookOpen, Brain, Layers, Play, RotateCcw, Eye } from 'lucide-react';
import { useState, useCallback } from 'react';
import {
  getChapter,
  getMaterials,
  deleteMaterial,
  getCourse,
  processMaterial,
  resetMaterial,
  type Material,
  type ProcessingResult,
} from '@/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { UploadMaterialDialog } from '@/components/courses/UploadMaterialDialog';
import { SummaryViewer, QuizInterface, FlashcardDeck } from '@/components/learning';
import { ProcessingDialog } from '@/components/materials/ProcessingDialog';

export function ChapterViewPage() {
  const { t } = useTranslation();
  const { courseId, chapterId } = useParams<{ courseId: string; chapterId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('materials');
  
  // Processing state
  const [processingMaterialId, setProcessingMaterialId] = useState<string | null>(null);
  const [processingMaterialName, setProcessingMaterialName] = useState<string>('');
  const [isProcessingDialogOpen, setIsProcessingDialogOpen] = useState(false);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  // Viewing material state (for completed materials)
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // IDs are already strings (UUIDs)
  const courseIdStr = courseId || '';
  const chapterIdStr = chapterId || '';

  const {
    data: chapter,
    isLoading: chapterLoading,
    error: chapterError,
  } = useQuery({
    queryKey: ['chapter', courseIdStr, chapterIdStr],
    queryFn: () => getChapter(courseIdStr, chapterIdStr),
    enabled: !!courseIdStr && !!chapterIdStr,
  });

  const {
    data: course,
    isLoading: courseLoading,
  } = useQuery({
    queryKey: ['course', courseIdStr],
    queryFn: () => getCourse(courseIdStr),
    enabled: !!courseIdStr,
  });

  const {
    data: materials = [],
    isLoading: materialsLoading,
    error: materialsError,
  } = useQuery({
    queryKey: ['materials', courseIdStr, chapterIdStr],
    queryFn: () => getMaterials(courseIdStr, chapterIdStr),
    enabled: !!courseIdStr && !!chapterIdStr,
    // Poll for status updates when there are processing materials
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasPendingMaterials = data?.some(
        (m: Material) => m.status === 'pending' || m.status === 'processing'
      );
      return hasPendingMaterials ? 5000 : false;
    },
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: (materialId: string) => deleteMaterial(courseIdStr, chapterIdStr, materialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials', courseIdStr, chapterIdStr] });
      toast.success(t('materials.deleteSuccess'));
    },
    onError: () => {
      toast.error(t('materials.deleteError'));
    },
  });

  // Process material mutation
  const processMaterialMutation = useMutation({
    mutationFn: (materialId: string) => processMaterial(courseIdStr, chapterIdStr, materialId),
    onSuccess: (result) => {
      setProcessingResult(result);
      setProcessingMaterialId(null);
      queryClient.invalidateQueries({ queryKey: ['materials', courseIdStr, chapterIdStr] });
      queryClient.invalidateQueries({ queryKey: ['chapter', courseIdStr, chapterIdStr] });
      if (result.success) {
        toast.success(t('materials.processSuccess', 'Material processed successfully'));
      } else {
        toast.error(t('materials.processPartialError', 'Processing completed with errors'));
      }
    },
    onError: (error: Error) => {
      setProcessingError(error.message);
      setProcessingMaterialId(null);
      queryClient.invalidateQueries({ queryKey: ['materials', courseIdStr, chapterIdStr] });
      toast.error(t('materials.processError', 'Failed to process material'));
    },
  });

  // Reset material mutation
  const resetMaterialMutation = useMutation({
    mutationFn: (materialId: string) => resetMaterial(courseIdStr, chapterIdStr, materialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials', courseIdStr, chapterIdStr] });
      queryClient.invalidateQueries({ queryKey: ['chapter', courseIdStr, chapterIdStr] });
      toast.success(t('materials.resetSuccess', 'Material reset to pending'));
    },
    onError: () => {
      toast.error(t('materials.resetError', 'Failed to reset material'));
    },
  });

  const handleDeleteMaterial = (materialId: string) => {
    if (confirm(t('materials.confirmDelete'))) {
      deleteMaterialMutation.mutate(materialId);
    }
  };

  const handleStartProcessing = (material: Material) => {
    setProcessingMaterialId(material.id);
    setProcessingMaterialName(material.originalFilename);
    setProcessingResult(null);
    setProcessingError(null);
    setIsProcessingDialogOpen(true);
    processMaterialMutation.mutate(material.id);
  };

  const handleResetMaterial = (materialId: string) => {
    if (confirm(t('materials.confirmReset', 'Are you sure you want to reset this material? This will clear all processing data.'))) {
      resetMaterialMutation.mutate(materialId);
    }
  };

  const handleCloseProcessingDialog = () => {
    setIsProcessingDialogOpen(false);
    setProcessingMaterialId(null);
    setProcessingMaterialName('');
    // Keep result/error for reference until next processing
  };

  const handleViewMaterial = (material: Material) => {
    setViewingMaterial(material);
    setIsViewDialogOpen(true);
  };

  const handleCloseViewDialog = () => {
    setIsViewDialogOpen(false);
    setViewingMaterial(null);
  };

  // Build a ProcessingResult-like object from material for viewing
  const getViewResultFromMaterial = (material: Material): ProcessingResult => ({
    success: material.status === 'completed',
    materialId: material.id,
    stages: material.status === 'completed' ? [
      { stage: 'COMPLETE', message: 'Processing completed', percentage: 100, timestamp: Date.now() }
    ] : [],
    extractedTextLength: material.extractedText?.length || 0,
    chunksCreated: 0, // Not stored in material
    embeddingsGenerated: 0, // Not stored in material
    structuredContent: material.structuredContent || null,
    error: material.processingError || null,
    processingTimeMs: 0, // Not stored in material
  });

  const handleUploadSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['materials', courseIdStr, chapterIdStr] });
    queryClient.invalidateQueries({ queryKey: ['chapter', courseIdStr, chapterIdStr] });
    setIsUploadOpen(false);
  }, [queryClient, courseIdStr, chapterIdStr]);

  const isLoading = chapterLoading || materialsLoading || courseLoading;
  const error = chapterError || materialsError;

  // Derive values for learning components
  const courseLanguage = (course?.language || 'en') as 'en' | 'fr';
  const hasProcessedContent = chapter?.status === 'ready' || chapter?.status === 'completed';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="container py-8">
        <Button variant="ghost" onClick={() => navigate(`/courses/${courseIdStr}`)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.back')}
        </Button>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-destructive">{t('chapters.loadError')}</p>
          <Button onClick={() => navigate(`/courses/${courseIdStr}`)}>
            {t('chapters.backToCourse')}
          </Button>
        </div>
      </div>
    );
  }

  const statusConfig = {
    draft: { icon: Clock, color: 'text-yellow-500', label: t('chapters.status.draft'), bg: 'bg-yellow-50' },
    processing: { icon: Loader2, color: 'text-blue-500', label: t('chapters.status.processing'), bg: 'bg-blue-50' },
    ready: { icon: AlertCircle, color: 'text-green-500', label: t('chapters.status.ready'), bg: 'bg-green-50' },
    completed: { icon: CheckCircle, color: 'text-green-600', label: t('chapters.status.completed'), bg: 'bg-green-50' },
  };

  const status = statusConfig[chapter.status];
  const StatusIcon = status.icon;

  return (
    <div className="container py-8">
      <Button variant="ghost" onClick={() => navigate(`/courses/${courseIdStr}`)} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('common.back')}
      </Button>

      {/* Chapter Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">{chapter.title}</h1>
            {chapter.description && (
              <p className="text-muted-foreground max-w-2xl">{chapter.description}</p>
            )}
          </div>
          <Badge variant="outline" className={`flex items-center gap-1 ${status.bg}`}>
            <StatusIcon className={`h-4 w-4 ${status.color} ${chapter.status === 'processing' ? 'animate-spin' : ''}`} />
            {status.label}
          </Badge>
        </div>
      </div>

      {/* Processed Content (if available) */}
      {chapter.processedContent && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('chapters.processedContent')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <pre className="whitespace-pre-wrap text-sm">{chapter.processedContent}</pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Learning Tools Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="materials" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('materials.title')}
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t('learning.summary.title')}
          </TabsTrigger>
          <TabsTrigger value="quiz" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            {t('learning.quiz.title')}
          </TabsTrigger>
          <TabsTrigger value="flashcards" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            {t('learning.flashcards.title')}
          </TabsTrigger>
        </TabsList>

        {/* Materials Tab */}
        <TabsContent value="materials">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">{t('materials.title')}</h2>
            <Button onClick={() => setIsUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              {t('materials.upload')}
            </Button>
          </div>

          {materials.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('materials.empty')}</h3>
                <p className="text-muted-foreground mb-4">{t('materials.emptyDescription')}</p>
                <Button onClick={() => setIsUploadOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  {t('materials.uploadFirst')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {materials.map((material) => (
                <MaterialCard
                  key={material.id}
                  material={material}
                  onDelete={() => handleDeleteMaterial(material.id)}
                  onProcess={() => handleStartProcessing(material)}
                  onReset={() => handleResetMaterial(material.id)}
                  onView={() => handleViewMaterial(material)}
                  isProcessing={processingMaterialId === material.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary">
          <SummaryViewer 
            chapterId={chapterIdStr} 
            chapterTitle={chapter.title}
            courseLanguage={courseLanguage}
            hasProcessedContent={hasProcessedContent}
          />
        </TabsContent>

        {/* Quiz Tab */}
        <TabsContent value="quiz">
          <QuizInterface 
            chapterId={chapterIdStr}
            chapterTitle={chapter.title}
            courseLanguage={courseLanguage}
            hasProcessedContent={hasProcessedContent}
          />
        </TabsContent>

        {/* Flashcards Tab */}
        <TabsContent value="flashcards">
          <FlashcardDeck 
            chapterId={chapterIdStr}
            chapterTitle={chapter.title}
            courseLanguage={courseLanguage}
            hasProcessedContent={hasProcessedContent}
          />
        </TabsContent>
      </Tabs>

      <UploadMaterialDialog
        courseId={courseIdStr}
        chapterId={chapterIdStr}
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        onSuccess={handleUploadSuccess}
      />

      <ProcessingDialog
        open={isProcessingDialogOpen}
        onClose={handleCloseProcessingDialog}
        isProcessing={processMaterialMutation.isPending}
        materialName={processingMaterialName}
        result={processingResult}
        error={processingError}
      />

      {/* Dialog for viewing completed material content */}
      {viewingMaterial && (
        <ProcessingDialog
          open={isViewDialogOpen}
          onClose={handleCloseViewDialog}
          isProcessing={false}
          materialName={viewingMaterial.originalFilename}
          result={getViewResultFromMaterial(viewingMaterial)}
          error={viewingMaterial.processingError || null}
        />
      )}
    </div>
  );
}

interface MaterialCardProps {
  material: Material;
  onDelete: () => void;
  onProcess: () => void;
  onReset: () => void;
  onView: () => void;
  isProcessing: boolean;
}

function MaterialCard({ material, onDelete, onProcess, onReset, onView, isProcessing }: MaterialCardProps) {
  const { t } = useTranslation();

  const statusConfig = {
    pending: { icon: Clock, color: 'text-yellow-500', label: t('materials.status.pending') },
    processing: { icon: Loader2, color: 'text-blue-500', label: t('materials.status.processing') },
    completed: { icon: CheckCircle, color: 'text-green-600', label: t('materials.status.completed') },
    failed: { icon: AlertCircle, color: 'text-red-500', label: t('materials.status.failed') },
  };

  const status = statusConfig[material.status];
  const StatusIcon = status.icon;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canProcess = material.status === 'pending' || material.status === 'failed';
  const canReset = material.status === 'completed' || material.status === 'failed';
  const canView = material.status === 'completed';

  return (
    <Card className={canView ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''} onClick={canView ? onView : undefined}>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="p-2 bg-muted rounded-lg">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{material.originalFilename}</div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{material.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}</span>
            <span>•</span>
            <span>{formatFileSize(material.fileSize)}</span>
          </div>
          {material.processingError && (
            <div className="text-xs text-red-500 mt-1 truncate" title={material.processingError}>
              {material.processingError}
            </div>
          )}
        </div>

        <Badge variant="outline" className="flex items-center gap-1">
          <StatusIcon className={`h-3 w-3 ${status.color} ${material.status === 'processing' || isProcessing ? 'animate-spin' : ''}`} />
          {isProcessing ? t('materials.status.processing') : status.label}
        </Badge>

        {/* Action Buttons */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {canView && (
            <Button
              variant="outline"
              size="sm"
              onClick={onView}
              className="text-primary"
              title={t('materials.view', 'View Content')}
            >
              <Eye className="h-4 w-4 mr-1" />
              {t('materials.view', 'View')}
            </Button>
          )}

          {canProcess && (
            <Button
              variant="outline"
              size="sm"
              onClick={onProcess}
              disabled={isProcessing}
              className="text-primary"
              title={t('materials.process', 'Process')}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  {t('materials.process', 'Process')}
                </>
              )}
            </Button>
          )}

          {canReset && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onReset}
              disabled={isProcessing}
              title={t('materials.reset', 'Reset')}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={isProcessing}
            className="text-destructive hover:text-destructive"
            title={t('materials.delete', 'Delete')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ChapterViewPage;
