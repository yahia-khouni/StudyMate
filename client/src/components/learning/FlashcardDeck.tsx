import { useState, useEffect, useCallback } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, Layers, Sparkles, Brain, ChevronLeft } from 'lucide-react';
import {
  getChapterFlashcardDecks,
  generateFlashcards,
  getCardsForReview,
  recordFlashcardReview,
  getDeckProgress,
  type FlashcardDeck as FlashcardDeckType,
  type FlashcardForReview,
  type DeckProgressStats,
  type GenerateFlashcardsOptions,
} from '@/services/learning.service';
import { cn } from '@/lib/utils';

interface FlashcardDeckProps {
  chapterId: string;
  chapterTitle: string;
  courseLanguage: 'en' | 'fr';
  hasProcessedContent: boolean;
}

type ViewState = 'list' | 'review';

// Quality ratings for SM-2 algorithm
const QUALITY_RATINGS = [
  { value: 0, label: 'Blackout', color: 'bg-red-500' },
  { value: 1, label: 'Wrong', color: 'bg-orange-500' },
  { value: 2, label: 'Hard', color: 'bg-yellow-500' },
  { value: 3, label: 'Okay', color: 'bg-blue-500' },
  { value: 4, label: 'Good', color: 'bg-green-400' },
  { value: 5, label: 'Easy', color: 'bg-green-600' },
];

export function FlashcardDeck({
  chapterId,
  chapterTitle,
  courseLanguage,
  hasProcessedContent,
}: FlashcardDeckProps) {
  const { t } = useTranslation();
  const [decks, setDecks] = useState<FlashcardDeckType[]>([]);
  const [activeDeck, setActiveDeck] = useState<FlashcardDeckType | null>(null);
  const [deckProgress, setDeckProgress] = useState<DeckProgressStats | null>(null);
  const [reviewCards, setReviewCards] = useState<FlashcardForReview[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewState, setViewState] = useState<ViewState>('list');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate options
  const [cardCount, setCardCount] = useState<number>(10);

  async function loadDecks() {
    setLoading(true);
    setError(null);
    try {
      const data = await getChapterFlashcardDecks(chapterId);
      setDecks(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load flashcard decks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDecks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const options: GenerateFlashcardsOptions = {
        language: courseLanguage,
        cardCount,
      };
      const newDeck = await generateFlashcards(chapterId, options);
      setDecks([newDeck, ...decks]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate flashcards');
    } finally {
      setGenerating(false);
    }
  }

  async function startReview(deckId: string) {
    setLoading(true);
    try {
      const [cards, progress] = await Promise.all([
        getCardsForReview(deckId, 20),
        getDeckProgress(deckId),
      ]);
      
      const deck = decks.find(d => d.id === deckId);
      setActiveDeck(deck || null);
      setDeckProgress(progress);
      setReviewCards(cards);
      setCurrentCardIndex(0);
      setIsFlipped(false);
      setViewState('review');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load flashcards for review');
    } finally {
      setLoading(false);
    }
  }

  const flipCard = useCallback(() => {
    setIsFlipped(!isFlipped);
  }, [isFlipped]);

  async function handleRating(quality: number) {
    if (reviewCards.length === 0 || recording) return;

    const currentCard = reviewCards[currentCardIndex];
    setRecording(true);
    
    try {
      await recordFlashcardReview(currentCard.id, quality);
      
      // Move to next card or end review
      if (currentCardIndex < reviewCards.length - 1) {
        setCurrentCardIndex(currentCardIndex + 1);
        setIsFlipped(false);
      } else {
        // Review complete - refresh progress
        if (activeDeck) {
          const progress = await getDeckProgress(activeDeck.id);
          setDeckProgress(progress);
        }
        setReviewCards([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record review');
    } finally {
      setRecording(false);
    }
  }

  function goBack() {
    setActiveDeck(null);
    setReviewCards([]);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setDeckProgress(null);
    setViewState('list');
    loadDecks();
  }

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (viewState !== 'review' || reviewCards.length === 0) return;

      if (e.code === 'Space') {
        e.preventDefault();
        flipCard();
      } else if (isFlipped) {
        if (e.key >= '0' && e.key <= '5') {
          handleRating(parseInt(e.key));
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewState, reviewCards, isFlipped, flipCard]);

  if (!hasProcessedContent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            {t('learning.flashcards.title', 'Flashcards')}
          </CardTitle>
          <CardDescription>
            {t('learning.flashcards.noContent', 'Upload and process materials to generate flashcards.')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Deck List View
  if (viewState === 'list') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                {t('learning.flashcards.title', 'Flashcards')}
              </CardTitle>
              <CardDescription>{chapterTitle}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Generate Flashcards Form */}
          <div className="mb-6 p-4 border rounded-lg bg-muted/50">
            <h4 className="font-medium mb-3">{t('learning.flashcards.generateNew', 'Generate New Deck')}</h4>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  {t('learning.flashcards.cardCount', 'Number of Cards')}
                </label>
                <Select value={cardCount.toString()} onValueChange={(v) => setCardCount(parseInt(v))}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('learning.flashcards.generating', 'Generating...')}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t('learning.flashcards.generate', 'Generate')}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Deck List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" className="mt-4" onClick={loadDecks}>
                {t('common.retry', 'Retry')}
              </Button>
            </div>
          ) : decks.length === 0 ? (
            <div className="text-center py-8">
              <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {t('learning.flashcards.noDecks', 'No flashcard decks yet. Generate one to get started!')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {decks.map((deck) => (
                <div
                  key={deck.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <h4 className="font-medium">{deck.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">
                        {deck.cardCount} {t('learning.flashcards.cards', 'cards')}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(deck.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button onClick={() => startReview(deck.id)}>
                    <Brain className="mr-2 h-4 w-4" />
                    {t('learning.flashcards.study', 'Study')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Review View
  if (viewState === 'review') {
    const currentCard = reviewCards[currentCardIndex];
    const reviewComplete = reviewCards.length === 0 || currentCardIndex >= reviewCards.length;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                {activeDeck?.name || t('learning.flashcards.review', 'Review')}
              </CardTitle>
              <CardDescription>
                {!reviewComplete && (
                  <>
                    {t('learning.flashcards.cardOf', 'Card {{current}} of {{total}}', {
                      current: currentCardIndex + 1,
                      total: reviewCards.length,
                    })}
                  </>
                )}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={goBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t('common.back', 'Back')}
            </Button>
          </div>
          {!reviewComplete && (
            <Progress value={((currentCardIndex) / reviewCards.length) * 100} className="mt-2" />
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reviewComplete ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold mb-2">
                {t('learning.flashcards.reviewComplete', 'Review Complete!')}
              </h3>
              {deckProgress && (
                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mt-6">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-green-500">{deckProgress.knownCards}</div>
                    <div className="text-sm text-muted-foreground">{t('learning.flashcards.known', 'Known')}</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-yellow-500">{deckProgress.learningCards}</div>
                    <div className="text-sm text-muted-foreground">{t('learning.flashcards.learning', 'Learning')}</div>
                  </div>
                </div>
              )}
              <Button className="mt-6" onClick={goBack}>
                {t('learning.flashcards.backToDecks', 'Back to Decks')}
              </Button>
            </div>
          ) : currentCard ? (
            <>
              {/* Flashcard */}
              <div
                onClick={flipCard}
                className={cn(
                  'relative h-64 cursor-pointer perspective-1000',
                  'transition-all duration-500',
                )}
              >
                <div
                  className={cn(
                    'absolute inset-0 border-2 rounded-xl p-6 flex items-center justify-center text-center',
                    'transition-transform duration-500 transform-style-preserve-3d backface-hidden',
                    isFlipped ? 'rotate-y-180' : '',
                    !isFlipped ? 'bg-primary/5 border-primary' : 'bg-muted'
                  )}
                >
                  <div className="text-lg">
                    {currentCard.frontContent}
                  </div>
                </div>
                <div
                  className={cn(
                    'absolute inset-0 border-2 rounded-xl p-6 flex items-center justify-center text-center',
                    'transition-transform duration-500 transform-style-preserve-3d backface-hidden',
                    isFlipped ? '' : '-rotate-y-180',
                    isFlipped ? 'bg-green-500/10 border-green-500' : 'bg-muted'
                  )}
                >
                  <div className="text-lg">
                    {currentCard.backContent}
                  </div>
                </div>
              </div>

              <p className="text-center text-sm text-muted-foreground mt-4">
                {isFlipped
                  ? t('learning.flashcards.ratePrompt', 'How well did you know this?')
                  : t('learning.flashcards.flipPrompt', 'Click card or press Space to flip')}
              </p>

              {/* Rating Buttons */}
              {isFlipped && (
                <div className="flex justify-center gap-2 mt-4">
                  {QUALITY_RATINGS.map((rating) => (
                    <Button
                      key={rating.value}
                      variant="outline"
                      size="sm"
                      onClick={() => handleRating(rating.value)}
                      disabled={recording}
                      className={cn('flex-col h-auto py-2 px-3', rating.color, 'hover:opacity-80 text-white border-0')}
                    >
                      <span className="text-xs font-bold">{rating.value}</span>
                      <span className="text-xs">{rating.label}</span>
                    </Button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {t('learning.flashcards.noDueCards', 'No cards due for review. Check back later!')}
              </p>
              <Button className="mt-4" onClick={goBack}>
                {t('learning.flashcards.backToDecks', 'Back to Decks')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}
