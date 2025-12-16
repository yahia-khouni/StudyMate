/**
 * ProcessingDialog Component
 * Modal that shows document processing progress and results
 * Blocks UI during processing and displays detailed results when complete
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  CheckCircle,
  XCircle,
  FileText,
  Layers,
  Brain,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { ProcessingResult, ProcessingStage } from '@/services/course.service';

interface ProcessingDialogProps {
  open: boolean;
  onClose: () => void;
  isProcessing: boolean;
  materialName: string;
  result: ProcessingResult | null;
  error: string | null;
}

const STAGE_ICONS: Record<string, React.ReactNode> = {
  LOAD: <FileText className="h-4 w-4" />,
  EXTRACT: <FileText className="h-4 w-4" />,
  STRUCTURE: <Layers className="h-4 w-4" />,
  CHUNK: <Layers className="h-4 w-4" />,
  EMBED: <Brain className="h-4 w-4" />,
  STORE: <Brain className="h-4 w-4" />,
  COMPLETE: <CheckCircle className="h-4 w-4 text-green-500" />,
  ERROR: <XCircle className="h-4 w-4 text-red-500" />,
};

function StageItem({ stage }: { stage: ProcessingStage }) {
  const isError = stage.stage === 'ERROR';
  const isComplete = stage.stage === 'COMPLETE';

  return (
    <div
      className={`flex items-start gap-3 p-2 rounded ${
        isError ? 'bg-red-50 dark:bg-red-950' : isComplete ? 'bg-green-50 dark:bg-green-950' : ''
      }`}
    >
      <div className="mt-0.5">{STAGE_ICONS[stage.stage] || <Clock className="h-4 w-4" />}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant={isError ? 'destructive' : isComplete ? 'default' : 'secondary'} className="text-xs">
            {stage.stage}
          </Badge>
          {stage.percentage >= 0 && (
            <span className="text-xs text-muted-foreground">{stage.percentage}%</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1 break-words">{stage.message}</p>
      </div>
    </div>
  );
}

export function ProcessingDialog({
  open,
  onClose,
  isProcessing,
  materialName,
  result,
  error,
}: ProcessingDialogProps) {
  const { t } = useTranslation();

  // Calculate current progress from result stages
  const currentProgress = result?.stages?.length
    ? Math.max(...result.stages.filter(s => s.percentage >= 0).map(s => s.percentage), 0)
    : 0;

  const canClose = !isProcessing;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && canClose && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col"
        onInteractOutside={(e) => {
          if (!canClose) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (!canClose) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isProcessing && <Loader2 className="h-5 w-5 animate-spin" />}
            {!isProcessing && result?.success && <CheckCircle className="h-5 w-5 text-green-500" />}
            {!isProcessing && (error || !result?.success) && <XCircle className="h-5 w-5 text-red-500" />}
            {t('processing.title', 'Document Processing')}
          </DialogTitle>
          <DialogDescription>
            {materialName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Progress Bar */}
          {isProcessing && (
            <div className="space-y-2">
              <Progress value={currentProgress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">
                {t('processing.inProgress', 'Processing... Please wait.')}
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-700 dark:text-red-300">
                    {t('processing.error', 'Processing Error')}
                  </h4>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Processing Stages */}
          {result?.stages && result.stages.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">
                {t('processing.stages', 'Processing Stages')}
              </h4>
              <ScrollArea className="h-[200px] border rounded-lg p-2">
                <div className="space-y-2">
                  {result.stages.map((stage, index) => (
                    <StageItem key={index} stage={stage} />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Results Summary */}
          {result && !isProcessing && (
            <div className="space-y-4">
              <h4 className="font-medium text-sm">
                {t('processing.results', 'Processing Results')}
              </h4>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">
                    {result.extractedTextLength.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('processing.characters', 'Characters')}
                  </div>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">{result.chunksCreated}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('processing.chunks', 'Chunks')}
                  </div>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">{result.embeddingsGenerated}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('processing.embeddings', 'Embeddings')}
                  </div>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">
                    {(result.processingTimeMs / 1000).toFixed(1)}s
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('processing.time', 'Time')}
                  </div>
                </div>
              </div>

              {/* Structured Content Preview */}
              {result.structuredContent && (
                <div className="space-y-2">
                  <h5 className="font-medium text-sm">
                    {t('processing.structuredContent', 'Structured Content')}
                  </h5>
                  <ScrollArea className="h-[150px] border rounded-lg p-3 bg-muted">
                    {/* Handle string (markdown) content */}
                    {typeof result.structuredContent === 'string' ? (
                      <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground">
                        {result.structuredContent.length > 2000 
                          ? result.structuredContent.substring(0, 2000) + '\n\n... [truncated]'
                          : result.structuredContent}
                      </pre>
                    ) : (
                      /* Handle object content with properties */
                      <div className="space-y-2">
                        {result.structuredContent.title && (
                          <p>
                            <span className="font-medium">{t('processing.extractedTitle', 'Title')}:</span>{' '}
                            {result.structuredContent.title}
                          </p>
                        )}
                        {result.structuredContent.summary && (
                          <div>
                            <span className="font-medium">{t('processing.summary', 'Summary')}:</span>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                              {result.structuredContent.summary}
                            </p>
                          </div>
                        )}
                        {result.structuredContent.keyPoints && result.structuredContent.keyPoints.length > 0 && (
                          <div>
                            <span className="font-medium">{t('processing.keyPoints', 'Key Points')}:</span>
                            <ul className="text-sm text-muted-foreground mt-1 list-disc list-inside">
                              {result.structuredContent.keyPoints.slice(0, 5).map((point: string, i: number) => (
                                <li key={i} className="line-clamp-1">{point}</li>
                              ))}
                              {result.structuredContent.keyPoints.length > 5 && (
                                <li className="text-muted-foreground/70">
                                  +{result.structuredContent.keyPoints.length - 5} more...
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}

              {/* Error in result */}
              {result.error && (
                <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    <strong>{t('processing.partialError', 'Note')}:</strong> {result.error}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button onClick={onClose} disabled={!canClose}>
            {isProcessing
              ? t('processing.pleaseWait', 'Please wait...')
              : t('common.close', 'Close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProcessingDialog;
