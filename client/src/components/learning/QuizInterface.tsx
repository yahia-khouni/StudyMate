import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Loader2, Play, CheckCircle, XCircle, Trophy, Clock, Sparkles, ChevronRight, RotateCcw } from 'lucide-react';
import {
  getChapterQuizzes,
  generateQuiz,
  getQuiz,
  submitQuizAttempt,
  type Quiz,
  type QuizAttempt,
  type GenerateQuizOptions,
} from '@/services/learning.service';
import { cn } from '@/lib/utils';

interface QuizInterfaceProps {
  chapterId: string;
  chapterTitle: string;
  courseLanguage: 'en' | 'fr';
  hasProcessedContent: boolean;
}

type QuizState = 'list' | 'taking' | 'results';

export function QuizInterface({
  chapterId,
  chapterTitle,
  courseLanguage,
  hasProcessedContent,
}: QuizInterfaceProps) {
  const { t } = useTranslation();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [quizState, setQuizState] = useState<QuizState>('list');
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startTimeRef = useRef<number>(0);

  // Generate options
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionCount, setQuestionCount] = useState<number>(5);

  async function loadQuizzes() {
    setLoading(true);
    setError(null);
    try {
      const data = await getChapterQuizzes(chapterId);
      setQuizzes(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuizzes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const options: GenerateQuizOptions = {
        language: courseLanguage,
        difficulty,
        questionCount,
      };
      const newQuiz = await generateQuiz(chapterId, options);
      setQuizzes([newQuiz, ...quizzes]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate quiz');
    } finally {
      setGenerating(false);
    }
  }

  async function startQuiz(quizId: string) {
    setLoading(true);
    try {
      const quiz = await getQuiz(quizId);
      setActiveQuiz(quiz);
      setAnswers(new Array(quiz.questions?.length || 0).fill(null));
      setCurrentQuestion(0);
      setQuizState('taking');
      startTimeRef.current = Date.now();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  }

  function selectAnswer(answerIndex: number) {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);
  }

  function nextQuestion() {
    if (activeQuiz && currentQuestion < (activeQuiz.questions?.length || 0) - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  }

  function previousQuestion() {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  }

  async function submitQuiz() {
    if (!activeQuiz) return;
    
    // Check if all questions answered
    if (answers.some(a => a === null)) {
      setError('Please answer all questions before submitting');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const result = await submitQuizAttempt(
        activeQuiz.id,
        answers as number[],
        timeTaken
      );
      setAttempt(result);
      setQuizState('results');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  }

  function resetQuiz() {
    setActiveQuiz(null);
    setAnswers([]);
    setCurrentQuestion(0);
    setAttempt(null);
    setQuizState('list');
    loadQuizzes();
  }

  if (!hasProcessedContent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t('learning.quiz.title', 'Quizzes')}
          </CardTitle>
          <CardDescription>
            {t('learning.quiz.noContent', 'Upload and process materials to generate quizzes.')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Quiz List View
  if (quizState === 'list') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                {t('learning.quiz.title', 'Quizzes')}
              </CardTitle>
              <CardDescription>{chapterTitle}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Generate Quiz Form */}
          <div className="mb-6 p-4 border rounded-lg bg-muted/50">
            <h4 className="font-medium mb-3">{t('learning.quiz.generateNew', 'Generate New Quiz')}</h4>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  {t('learning.quiz.difficulty', 'Difficulty')}
                </label>
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as 'easy' | 'medium' | 'hard')}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">{t('learning.quiz.easy', 'Easy')}</SelectItem>
                    <SelectItem value="medium">{t('learning.quiz.medium', 'Medium')}</SelectItem>
                    <SelectItem value="hard">{t('learning.quiz.hard', 'Hard')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  {t('learning.quiz.questions', 'Questions')}
                </label>
                <Select value={questionCount.toString()} onValueChange={(v) => setQuestionCount(parseInt(v))}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('learning.quiz.generating', 'Generating...')}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t('learning.quiz.generate', 'Generate')}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Quiz List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" className="mt-4" onClick={loadQuizzes}>
                {t('common.retry', 'Retry')}
              </Button>
            </div>
          ) : quizzes.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {t('learning.quiz.noQuizzes', 'No quizzes yet. Generate one to get started!')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <h4 className="font-medium">{quiz.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={
                        quiz.difficulty === 'easy' ? 'secondary' :
                        quiz.difficulty === 'medium' ? 'default' : 'destructive'
                      }>
                        {quiz.difficulty}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {quiz.questionCount} {t('learning.quiz.questionsLabel', 'questions')}
                      </span>
                    </div>
                  </div>
                  <Button onClick={() => startQuiz(quiz.id)}>
                    <Play className="mr-2 h-4 w-4" />
                    {t('learning.quiz.start', 'Start')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Taking Quiz View
  if (quizState === 'taking' && activeQuiz?.questions) {
    const question = activeQuiz.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / activeQuiz.questions.length) * 100;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{activeQuiz.title}</CardTitle>
              <CardDescription>
                {t('learning.quiz.questionOf', 'Question {{current}} of {{total}}', {
                  current: currentQuestion + 1,
                  total: activeQuiz.questions.length,
                })}
              </CardDescription>
            </div>
            <Badge variant={
              activeQuiz.difficulty === 'easy' ? 'secondary' :
              activeQuiz.difficulty === 'medium' ? 'default' : 'destructive'
            }>
              {activeQuiz.difficulty}
            </Badge>
          </div>
          <Progress value={progress} className="mt-2" />
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-4">{question.questionText}</h3>
            <div className="space-y-3">
              {question.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => selectAnswer(index)}
                  className={cn(
                    'w-full text-left p-4 border rounded-lg transition-colors',
                    answers[currentQuestion] === index
                      ? 'border-primary bg-primary/10'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <span className="font-medium mr-2">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  {option}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={previousQuestion}
            disabled={currentQuestion === 0}
          >
            {t('common.previous', 'Previous')}
          </Button>
          <div className="flex gap-2">
            {currentQuestion < activeQuiz.questions.length - 1 ? (
              <Button onClick={nextQuestion}>
                {t('common.next', 'Next')}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={submitQuiz}
                disabled={submitting || answers.some(a => a === null)}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('learning.quiz.submitting', 'Submitting...')}
                  </>
                ) : (
                  t('learning.quiz.submit', 'Submit Quiz')
                )}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    );
  }

  // Results View
  if (quizState === 'results' && attempt && activeQuiz?.questions) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {attempt.passed ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <XCircle className="h-6 w-6 text-red-500" />
            )}
            {attempt.passed
              ? t('learning.quiz.passed', 'Congratulations! You Passed!')
              : t('learning.quiz.failed', 'Keep Practicing!')}
          </CardTitle>
          <CardDescription>{activeQuiz.title}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold">{attempt.score.toFixed(0)}%</div>
              <div className="text-sm text-muted-foreground">{t('learning.quiz.score', 'Score')}</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold">
                {attempt.correctCount}/{attempt.totalQuestions}
              </div>
              <div className="text-sm text-muted-foreground">{t('learning.quiz.correct', 'Correct')}</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold flex items-center justify-center">
                <Clock className="h-5 w-5 mr-1" />
                {Math.floor(attempt.timeTakenSeconds / 60)}:{(attempt.timeTakenSeconds % 60).toString().padStart(2, '0')}
              </div>
              <div className="text-sm text-muted-foreground">{t('learning.quiz.time', 'Time')}</div>
            </div>
          </div>

          <h4 className="font-medium mb-4">{t('learning.quiz.review', 'Review Answers')}</h4>
          <div className="space-y-4">
            {activeQuiz.questions.map((question, index) => {
              const result = attempt.questionResults?.[index];
              const isCorrect = result?.isCorrect;

              return (
                <div
                  key={question.id}
                  className={cn(
                    'p-4 border rounded-lg',
                    isCorrect ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'
                  )}
                >
                  <div className="flex items-start gap-2 mb-2">
                    {isCorrect ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{question.questionText}</p>
                      <div className="mt-2 text-sm">
                        <p>
                          <span className="text-muted-foreground">{t('learning.quiz.yourAnswer', 'Your answer')}:</span>{' '}
                          <span className={isCorrect ? 'text-green-600' : 'text-red-600'}>
                            {question.options[result?.userAnswer ?? 0]}
                          </span>
                        </p>
                        {!isCorrect && (
                          <p>
                            <span className="text-muted-foreground">{t('learning.quiz.correctAnswer', 'Correct answer')}:</span>{' '}
                            <span className="text-green-600">
                              {question.options[question.correctAnswerIndex]}
                            </span>
                          </p>
                        )}
                        <p className="mt-2 text-muted-foreground italic">
                          {question.explanation}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={resetQuiz} className="w-full">
            <RotateCcw className="mr-2 h-4 w-4" />
            {t('learning.quiz.backToQuizzes', 'Back to Quizzes')}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return null;
}
