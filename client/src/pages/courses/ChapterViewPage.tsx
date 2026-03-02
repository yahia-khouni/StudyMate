import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ChevronRight, 
  FileText, 
  Trash2, 
  Loader2, 
  Sparkles,
  Brain,
  Layers,
  Clock,
  Flame,
  HelpCircle,
  Plus,
  Cloud
} from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import {
  getChapter,
  getMaterials,
  deleteMaterial,
  getCourse,
  processMaterial,
  type Material,
  type ProcessingResult,
} from '@/services';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { UploadMaterialDialog } from '@/components/courses/UploadMaterialDialog';
import { QuizInterface, FlashcardDeck } from '@/components/learning';
import { getSummary, generateSummary, regenerateSummary } from '@/services/learning.service';
import { ProcessingDialog } from '@/components/materials/ProcessingDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { getChapterProgress } from '@/services/progress.service';
import { formatDistanceToNow } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ChapterViewPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'fr' ? fr : enUS;
  const { courseId, chapterId } = useParams<{ courseId: string; chapterId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  
  // Active view state - what content to show in the main area
  // 'content' = extracted material, 'summary' = AI summary, 'quiz' = quiz interface, 'flashcards' = flashcard deck
  const [activeView, setActiveView] = useState<'content' | 'summary' | 'quiz' | 'flashcards'>('content');
  
  // Processing state
  const [processingMaterialId, setProcessingMaterialId] = useState<string | null>(null);
  const [processingMaterialName, setProcessingMaterialName] = useState<string>('');
  const [isProcessingDialogOpen, setIsProcessingDialogOpen] = useState(false);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  // Confirm dialog state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  const { data: materials = [], isLoading: materialsLoading } = useQuery({
    queryKey: ['materials', courseIdStr, chapterIdStr],
    queryFn: () => getMaterials(courseIdStr, chapterIdStr),
    enabled: !!courseIdStr && !!chapterIdStr,
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasPendingMaterials = data?.some(
        (m: Material) => m.status === 'pending' || m.status === 'processing'
      );
      return hasPendingMaterials ? 5000 : false;
    },
  });

  const { data: chapterProgress } = useQuery({
    queryKey: ['chapterProgress', chapterIdStr],
    queryFn: () => getChapterProgress(chapterIdStr),
    enabled: !!chapterIdStr,
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: (materialId: string) => deleteMaterial(courseIdStr, chapterIdStr, materialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials', courseIdStr, chapterIdStr] });
      toast.success(t('materials.deleteSuccess'));
      setDeleteConfirm(null);
    },
    onError: () => {
      toast.error(t('materials.deleteError'));
    },
  });

  const processMaterialMutation = useMutation({
    mutationFn: (materialId: string) => processMaterial(courseIdStr, chapterIdStr, materialId),
    onSuccess: (result) => {
      setProcessingResult(result);
      setProcessingMaterialId(null);
      queryClient.invalidateQueries({ queryKey: ['materials', courseIdStr, chapterIdStr] });
      queryClient.invalidateQueries({ queryKey: ['chapter', courseIdStr, chapterIdStr] });
      queryClient.invalidateQueries({ queryKey: ['chapterProgress', chapterIdStr] });
      if (result.success) {
        toast.success(t('materials.processSuccess', 'Material processed successfully'));
      }
    },
    onError: (error: Error) => {
      setProcessingError(error.message);
      setProcessingMaterialId(null);
      toast.error(t('materials.processError', 'Failed to process material'));
    },
  });

  const handleStartProcessing = (material: Material) => {
    setProcessingMaterialId(material.id);
    setProcessingMaterialName(material.originalFilename);
    setProcessingResult(null);
    setProcessingError(null);
    setIsProcessingDialogOpen(true);
    processMaterialMutation.mutate(material.id);
  };

  const handleCloseProcessingDialog = () => {
    setIsProcessingDialogOpen(false);
    setProcessingMaterialId(null);
    setProcessingMaterialName('');
  };

  const handleUploadSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['materials', courseIdStr, chapterIdStr] });
    queryClient.invalidateQueries({ queryKey: ['chapter', courseIdStr, chapterIdStr] });
    setIsUploadOpen(false);
  }, [queryClient, courseIdStr, chapterIdStr]);

  const confirmDeleteMaterial = () => {
    if (deleteConfirm) {
      deleteMaterialMutation.mutate(deleteConfirm);
    }
  };

  const isLoading = chapterLoading || materialsLoading || courseLoading;
  const error = chapterError;

  // Calculate reading time estimate (roughly 200 words per minute)
  const getReadingTime = () => {
    const completedMaterial = materials.find(m => m.status === 'completed' && m.extractedText);
    if (completedMaterial?.extractedText) {
      const wordCount = completedMaterial.extractedText.split(/\s+/).length;
      return Math.max(1, Math.ceil(wordCount / 200));
    }
    return 15; // Default estimate
  };

  // Get primary source material
  const primaryMaterial = materials.find(m => m.status === 'completed') || materials[0];
  
  // Get last updated time
  const getLastUpdated = () => {
    if (chapter?.updatedAt) {
      return formatDistanceToNow(new Date(chapter.updatedAt), { addSuffix: true, locale });
    }
    return t('chapter.recently', 'recently');
  };

  // Derive values for learning components
  const courseLanguage = (course?.language || 'en') as 'en' | 'fr';
  const hasProcessedContent = chapter?.status === 'ready' || chapter?.status === 'completed';

  // Get structured content for display
  const getDisplayContent = () => {
    const completedMaterial = materials.find(m => m.status === 'completed');
    if (completedMaterial?.structuredContent) {
      return completedMaterial.structuredContent;
    }
    if (completedMaterial?.extractedText) {
      return { text: completedMaterial.extractedText };
    }
    return null;
  };

  const displayContent = getDisplayContent();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="py-8 px-6">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-destructive">{t('chapters.loadError')}</p>
          <Button onClick={() => navigate(`/courses/${courseIdStr}`)}>
            {t('chapters.backToCourse')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 px-6">
      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area - Left 2/3 */}
        <div className="lg:col-span-2">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link to="/courses" className="hover:text-foreground transition-colors">
              {t('nav.courses', 'Courses')}
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link to={`/courses/${courseIdStr}`} className="hover:text-foreground transition-colors">
              {course?.name || t('course.untitled', 'Untitled Course')}
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">{chapter.title}</span>
          </nav>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <Badge className="bg-primary/20 text-primary border-0 text-xs font-medium">
                {t('chapter.lesson', 'LESSON')}
              </Badge>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {getReadingTime()} {t('chapter.minRead', 'min read')}
              </span>
            </div>
            
            <h1 className="text-3xl font-bold text-foreground mb-3">
              {chapter.title}
            </h1>
            
            <p className="text-sm text-muted-foreground">
              {t('chapter.lastUpdated', 'Last updated')} {getLastUpdated()}
              {primaryMaterial && (
                <> • {t('chapter.basedOn', 'Based on')} "{primaryMaterial.originalFilename}"</>
              )}
            </p>
          </div>

          {/* Content Display - switches based on activeView */}
          {activeView === 'content' && (
            displayContent ? (
              <MarkdownContent content={displayContent} />
            ) : materials.length > 0 ? (
              /* Show pending materials that need processing */
              <div className="rounded-2xl bg-card border border-border p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {t('chapter.materialsUploaded', 'Materials Uploaded')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t('chapter.processToExtract', 'Process your files to extract and display content')}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {materials.map((material) => (
                    <div 
                      key={material.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          material.status === 'completed' ? "bg-green-500/20" :
                          material.status === 'processing' ? "bg-blue-500/20" :
                          material.status === 'failed' ? "bg-red-500/20" :
                          "bg-amber-500/20"
                        )}>
                          <FileText className={cn(
                            "h-5 w-5",
                            material.status === 'completed' ? "text-green-500" :
                            material.status === 'processing' ? "text-blue-500" :
                            material.status === 'failed' ? "text-red-500" :
                            "text-amber-500"
                          )} />
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            {material.originalFilename}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {material.status === 'completed' ? t('materials.processed', 'Processed') :
                             material.status === 'processing' ? t('materials.processing', 'Processing...') :
                             material.status === 'failed' ? t('materials.failed', 'Failed') :
                             t('materials.pending', 'Pending')}
                          </p>
                        </div>
                      </div>
                      
                      {material.status === 'pending' && (
                        <Button 
                          size="sm"
                          onClick={() => handleStartProcessing(material)}
                          className="bg-primary hover:bg-primary/90"
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          {t('materials.process', 'Process')}
                        </Button>
                      )}
                      {material.status === 'processing' && (
                        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                      )}
                      {material.status === 'failed' && (
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartProcessing(material)}
                          className="text-red-500 border-red-500/50 hover:bg-red-500/10"
                        >
                          {t('common.retry', 'Retry')}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-card border border-border p-12 text-center">
                <Cloud className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {t('chapter.noContent', 'No content yet')}
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  {t('chapter.uploadToStart', 'Upload a PDF or document to extract and display chapter content. Our AI will process it automatically.')}
                </p>
                <Button onClick={() => setIsUploadOpen(true)}>
                  <Cloud className="mr-2 h-4 w-4" />
                  {t('materials.uploadFirst', 'Upload Material')}
                </Button>
              </div>
            )
          )}

          {activeView === 'summary' && (
            <InlineSummaryViewer 
              chapterId={chapterIdStr}
              courseLanguage={courseLanguage}
              hasProcessedContent={hasProcessedContent}
              onBack={() => setActiveView('content')}
            />
          )}

          {activeView === 'quiz' && (
            <div className="rounded-2xl bg-card border border-border p-6">
              <Button 
                variant="ghost" 
                onClick={() => setActiveView('content')} 
                className="mb-4 -ml-2"
              >
                <ChevronRight className="mr-2 h-4 w-4 rotate-180" />
                {t('common.back', 'Back to Content')}
              </Button>
              <QuizInterface 
                chapterId={chapterIdStr}
                chapterTitle={chapter.title}
                courseLanguage={courseLanguage}
                hasProcessedContent={hasProcessedContent}
              />
            </div>
          )}

          {activeView === 'flashcards' && (
            <div className="rounded-2xl bg-card border border-border p-6">
              <Button 
                variant="ghost" 
                onClick={() => setActiveView('content')} 
                className="mb-4 -ml-2"
              >
                <ChevronRight className="mr-2 h-4 w-4 rotate-180" />
                {t('common.back', 'Back to Content')}
              </Button>
              <FlashcardDeck 
                chapterId={chapterIdStr}
                chapterTitle={chapter.title}
                courseLanguage={courseLanguage}
                hasProcessedContent={hasProcessedContent}
              />
            </div>
          )}
        </div>

        {/* Right Sidebar - 1/3 */}
        <div className="space-y-6">
          {/* Add Source Material */}
          <div 
            className="rounded-2xl bg-card border border-dashed border-border p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
            onClick={() => setIsUploadOpen(true)}
          >
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Cloud className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground mb-1">
              {t('chapter.addSource', 'Add Source Material')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('chapter.dragDrop', 'Drag & drop PDF/DOCX here')}
            </p>
          </div>

          {/* AI Toolbox */}
          <div className="rounded-2xl bg-card border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t('chapter.aiToolbox', 'AI Toolbox')}
              </h3>
            </div>

            <div className="space-y-3">
              {/* Generate Summary */}
              <button
                onClick={() => setActiveView('summary')}
                disabled={!hasProcessedContent}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all",
                  activeView === 'summary' && "ring-2 ring-blue-500",
                  hasProcessedContent 
                    ? "bg-blue-500/10 hover:bg-blue-500/20 cursor-pointer" 
                    : "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Plus className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">
                    {t('chapter.generateSummary', 'Generate Summary')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('chapter.summaryDesc', 'Create a concise bullet-point summary of this chapter.')}
                  </p>
                </div>
              </button>

              {/* Start Quiz */}
              <button
                onClick={() => setActiveView('quiz')}
                disabled={!hasProcessedContent}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all",
                  activeView === 'quiz' && "ring-2 ring-emerald-500",
                  hasProcessedContent 
                    ? "bg-emerald-500/10 hover:bg-emerald-500/20 cursor-pointer" 
                    : "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Brain className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm">
                    {t('chapter.startQuiz', 'Start Quiz')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('chapter.quizDesc', 'Test your knowledge with {{count}} AI-generated questions.', { 
                      count: chapterProgress?.quizzes?.totalQuizzes || 10 
                    })}
                  </p>
                </div>
              </button>

              {/* View Flashcards */}
              <button
                onClick={() => setActiveView('flashcards')}
                disabled={!hasProcessedContent}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all",
                  activeView === 'flashcards' && "ring-2 ring-amber-500",
                  hasProcessedContent 
                    ? "bg-amber-500/10 hover:bg-amber-500/20 cursor-pointer" 
                    : "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Layers className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">
                    {t('chapter.viewFlashcards', 'View Flashcards')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('chapter.flashcardsDesc', 'Review {{count}} key terms and definitions.', {
                      count: chapterProgress?.flashcards?.totalCards || 0
                    })}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Progress */}
          <div className="rounded-2xl bg-card border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t('chapter.progress', 'Progress')}
              </h3>
            </div>

            {/* Mastery Score */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  {t('chapter.masteryScore', 'Mastery Score')}
                </span>
                <span className="text-lg font-bold text-foreground">
                  {chapterProgress?.flashcards?.masteryPercent || 0}%
                </span>
              </div>
              <Progress 
                value={chapterProgress?.flashcards?.masteryPercent || 0} 
                className="h-2"
              />
            </div>

            {/* Time and Streak */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {t('chapter.time', 'Time')}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {Math.round((chapterProgress?.flashcards?.reviewedCards || 0) * 0.5)}m
                </p>
              </div>
              <div className="rounded-xl bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {t('chapter.streak', 'Streak')}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {chapterProgress?.quizzes?.totalAttempts || 0} {t('chapter.days', 'Days')}
                </p>
              </div>
            </div>
          </div>

          {/* Sources */}
          {materials.length > 0 && (
            <div className="rounded-2xl bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('chapter.sources', 'Sources')}
                </h3>
              </div>

              <div className="space-y-3">
                {materials.map((material) => (
                  <SourceItem 
                    key={material.id} 
                    material={material}
                    locale={locale}
                    onProcess={() => handleStartProcessing(material)}
                    onDelete={() => setDeleteConfirm(material.id)}
                    isProcessing={processingMaterialId === material.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Need Help */}
          <button className="w-full flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <HelpCircle className="h-4 w-4" />
            {t('chapter.needHelp', 'Need help with this chapter?')}
          </button>
        </div>
      </div>

      {/* Dialogs */}
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

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title={t('materials.delete')}
        description={t('materials.confirmDelete')}
        confirmText={t('common.delete')}
        onConfirm={confirmDeleteMaterial}
        variant="danger"
        loading={deleteMaterialMutation.isPending}
      />
    </div>
  );
}

// Markdown Content Component - Renders content as GitHub-style markdown
type ContentType = string | { text?: string; sections?: Array<{ title?: string; content?: string; items?: string[] }> };

function MarkdownContent({ content }: { content: ContentType }) {
  // Extract markdown string from content
  const getMarkdownString = (): string => {
    if (typeof content === 'string') {
      return content;
    }
    if (typeof content === 'object' && 'text' in content && content.text) {
      return content.text;
    }
    if (typeof content === 'object' && 'sections' in content && Array.isArray(content.sections)) {
      // Convert sections to markdown
      return content.sections.map((section, index) => {
        let md = '';
        if (section.title) {
          md += `## ${index + 1}. ${section.title}\n\n`;
        }
        if (section.content) {
          md += `${section.content}\n\n`;
        }
        if (section.items && Array.isArray(section.items)) {
          md += section.items.map(item => `- ${item}`).join('\n') + '\n\n';
        }
        return md;
      }).join('');
    }
    return JSON.stringify(content, null, 2);
  };

  const markdownContent = getMarkdownString();

  return (
    <div className="prose prose-invert prose-lg max-w-none
      prose-headings:text-foreground prose-headings:font-bold
      prose-h1:text-3xl prose-h1:mb-6 prose-h1:mt-8 prose-h1:border-b prose-h1:border-border prose-h1:pb-3
      prose-h2:text-2xl prose-h2:mb-4 prose-h2:mt-8 prose-h2:flex prose-h2:items-center prose-h2:gap-3
      prose-h3:text-xl prose-h3:mb-3 prose-h3:mt-6
      prose-h4:text-lg prose-h4:mb-2 prose-h4:mt-4
      prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-4
      prose-a:text-primary prose-a:no-underline hover:prose-a:underline
      prose-strong:text-foreground prose-strong:font-semibold
      prose-em:text-muted-foreground prose-em:italic
      prose-code:text-primary prose-code:bg-muted/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-muted/30 prose-pre:border prose-pre:border-border prose-pre:rounded-xl prose-pre:p-4
      prose-ul:text-muted-foreground prose-ul:my-4
      prose-ol:text-muted-foreground prose-ol:my-4
      prose-li:text-muted-foreground prose-li:my-1 prose-li:marker:text-primary
      prose-blockquote:border-l-primary prose-blockquote:border-l-4 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground
      prose-hr:border-border prose-hr:my-8
      prose-table:border-collapse
      prose-th:border prose-th:border-border prose-th:p-2 prose-th:bg-muted/30
      prose-td:border prose-td:border-border prose-td:p-2
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {markdownContent}
      </ReactMarkdown>
    </div>
  );
}

// Inline Summary Viewer - Displays summary in the content area
interface InlineSummaryViewerProps {
  chapterId: string;
  courseLanguage: 'en' | 'fr';
  hasProcessedContent: boolean;
  onBack: () => void;
}

function InlineSummaryViewer({
  chapterId,
  courseLanguage,
  hasProcessedContent,
  onBack,
}: InlineSummaryViewerProps) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<{ id: string; content: string; updatedAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'fr'>(courseLanguage);
  const [error, setError] = useState<string | null>(null);

  async function loadSummary() {
    setLoading(true);
    setError(null);
    try {
      const data = await getSummary(chapterId, selectedLanguage);
      setSummary(data);
    } catch {
      // No summary yet is not an error
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, selectedLanguage]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const newSummary = await generateSummary(chapterId, selectedLanguage);
      setSummary(newSummary);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate() {
    if (!summary) return;
    setGenerating(true);
    setError(null);
    try {
      const newSummary = await regenerateSummary(summary.id);
      setSummary(newSummary);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate summary');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onBack} 
            className="-ml-2"
          >
            <ChevronRight className="mr-1 h-4 w-4 rotate-180" />
            {t('common.back', 'Back')}
          </Button>
          <div className="h-4 w-px bg-border" />
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('learning.summary.title', 'AI Summary')}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={selectedLanguage} 
            onChange={(e) => setSelectedLanguage(e.target.value as 'en' | 'fr')}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
          {summary && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('learning.summary.regenerate', 'Regenerate')
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={loadSummary}>
            {t('common.retry', 'Retry')}
          </Button>
        </div>
      ) : summary ? (
        <div className="prose prose-invert prose-lg max-w-none
          prose-headings:text-foreground prose-headings:font-bold
          prose-h1:text-2xl prose-h1:mb-4 prose-h1:mt-6
          prose-h2:text-xl prose-h2:mb-3 prose-h2:mt-5
          prose-h3:text-lg prose-h3:mb-2 prose-h3:mt-4
          prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-3
          prose-strong:text-foreground
          prose-ul:text-muted-foreground prose-ul:my-3
          prose-ol:text-muted-foreground prose-ol:my-3
          prose-li:text-muted-foreground prose-li:my-1 prose-li:marker:text-primary
          prose-code:text-primary prose-code:bg-muted/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
        ">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {summary.content}
          </ReactMarkdown>
          <p className="text-xs text-muted-foreground mt-6 pt-4 border-t border-border">
            {t('learning.summary.lastUpdated', 'Last updated')}: {new Date(summary.updatedAt).toLocaleString()}
          </p>
        </div>
      ) : (
        <div className="text-center py-12">
          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {t('learning.summary.noSummary', 'No summary yet')}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {t('learning.summary.generateDesc', 'Generate an AI-powered summary of this chapter\'s content.')}
          </p>
          <Button onClick={handleGenerate} disabled={generating || !hasProcessedContent}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('learning.summary.generating', 'Generating...')}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {t('learning.summary.generate', 'Generate Summary')}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// Source Item Component
function SourceItem({ 
  material, 
  locale,
  onProcess,
  onDelete,
  isProcessing
}: { 
  material: Material;
  locale: typeof enUS;
  onProcess: () => void;
  onDelete: () => void;
  isProcessing: boolean;
}) {
  const { t } = useTranslation();
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTimeAgo = () => {
    if (material.createdAt) {
      return formatDistanceToNow(new Date(material.createdAt), { addSuffix: false, locale });
    }
    return t('chapter.recently', 'recently');
  };

  const isPending = material.status === 'pending';
  const isProcessingStatus = material.status === 'processing' || isProcessing;
  const isFailed = material.status === 'failed';

  return (
    <div className="flex items-start gap-3 group">
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
        isFailed ? "bg-destructive/20" : "bg-rose-500/20"
      )}>
        <FileText className={cn(
          "h-5 w-5",
          isFailed ? "text-destructive" : "text-rose-500"
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {material.originalFilename}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(material.fileSize)} • {t('chapter.added', 'Added')} {getTimeAgo()}
        </p>
        {isFailed && material.processingError && (
          <p className="text-xs text-destructive mt-1 truncate">
            {material.processingError}
          </p>
        )}
        {(isPending || isFailed) && (
          <Button 
            variant="link" 
            size="sm" 
            className="h-auto p-0 text-xs text-primary"
            onClick={onProcess}
            disabled={isProcessingStatus}
          >
            {isProcessingStatus ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                {t('materials.processing', 'Processing...')}
              </>
            ) : (
              t('materials.processNow', 'Process now')
            )}
          </Button>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default ChapterViewPage;
