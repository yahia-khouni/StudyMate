import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, RefreshCw, FileText, Sparkles } from 'lucide-react';
import { getSummary, generateSummary, regenerateSummary, type Summary } from '@/services/learning.service';
import ReactMarkdown from 'react-markdown';

interface SummaryViewerProps {
  chapterId: string;
  chapterTitle: string;
  courseLanguage: 'en' | 'fr';
  hasProcessedContent: boolean;
}

export function SummaryViewer({
  chapterId,
  chapterTitle,
  courseLanguage,
  hasProcessedContent,
}: SummaryViewerProps) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<Summary | null>(null);
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
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

  if (!hasProcessedContent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('learning.summary.title', 'Chapter Summary')}
          </CardTitle>
          <CardDescription>
            {t('learning.summary.noContent', 'Upload and process materials to generate a summary.')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('learning.summary.title', 'Chapter Summary')}
            </CardTitle>
            <CardDescription>{chapterTitle}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedLanguage} onValueChange={(v) => setSelectedLanguage(v as 'en' | 'fr')}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
            {summary ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {t('learning.summary.regenerate', 'Regenerate')}
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={generating}
              >
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
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" className="mt-4" onClick={loadSummary}>
              {t('common.retry', 'Retry')}
            </Button>
          </div>
        ) : summary ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{summary.content}</ReactMarkdown>
            <p className="text-xs text-muted-foreground mt-4">
              {t('learning.summary.lastUpdated', 'Last updated')}: {new Date(summary.updatedAt).toLocaleString()}
            </p>
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {t('learning.summary.noSummary', 'No summary available for this chapter.')}
            </p>
            <Button onClick={handleGenerate} disabled={generating}>
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
      </CardContent>
    </Card>
  );
}
