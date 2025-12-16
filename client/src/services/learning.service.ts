import api from './api';

// ============ TYPES ============

// Summary Types
export interface Summary {
  id: string;
  chapterId: string;
  chapterTitle: string;
  courseId: string;
  language: 'en' | 'fr';
  content: string;
  createdAt: string;
  updatedAt: string;
}

// Quiz Types
export interface Quiz {
  id: string;
  chapterId: string;
  chapterTitle: string;
  courseId: string;
  title: string;
  language: 'en' | 'fr';
  difficulty: 'easy' | 'medium' | 'hard';
  questionCount: number;
  questions?: QuizQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  questionOrder: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  quizTitle: string;
  chapterId: string;
  chapterTitle: string;
  courseId?: string;
  userId: string;
  answers: QuizAnswer[];
  score: number;
  passed: boolean;
  timeTakenSeconds: number;
  correctCount?: number;
  totalQuestions?: number;
  questionResults?: QuizAnswer[];
  createdAt: string;
}

export interface QuizAnswer {
  questionId: string;
  questionIndex: number;
  userAnswer: number;
  correctAnswer: number;
  isCorrect: boolean;
}

export interface QuizAttemptReview extends QuizAttempt {
  quiz: {
    id: string;
    title: string;
    difficulty: string;
  };
  questionReviews: {
    questionText: string;
    options: string[];
    correctAnswerIndex: number;
    explanation: string;
    userAnswer: number;
    isCorrect: boolean;
  }[];
}

export interface QuizStats {
  quizzesTaken: number;
  totalAttempts: number;
  averageScore: number;
  passedCount: number;
  totalTimeSeconds: number;
}

export interface GenerateQuizOptions {
  language?: 'en' | 'fr';
  difficulty?: 'easy' | 'medium' | 'hard';
  questionCount?: number;
}

// Flashcard Types
export interface FlashcardDeck {
  id: string;
  chapterId: string;
  chapterTitle: string;
  courseId: string;
  name: string;
  language: 'en' | 'fr';
  cardCount: number;
  cards?: Flashcard[];
  stats?: DeckProgressStats;
  createdAt: string;
  updatedAt: string;
}

export interface Flashcard {
  id: string;
  deckId: string;
  frontContent: string;
  backContent: string;
  cardOrder: number;
  progress?: FlashcardProgress;
}

export interface FlashcardProgress {
  id: string;
  flashcardId: string;
  userId: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  status: 'learning' | 'known';
  nextReviewDate: string | null;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardForReview extends Omit<Flashcard, 'progress'> {
  progress: FlashcardProgress | null;
  deckName: string;
  chapterId: string;
  chapterTitle: string;
}

export interface DeckProgressStats {
  totalCards: number;
  reviewedCards: number;
  knownCards: number;
  learningCards: number;
  dueCards: number;
  completionPercentage?: number;
}

export interface FlashcardStats {
  decksStudied: number;
  totalCards: number;
  knownCards: number;
  dueToday: number;
}

export interface GenerateFlashcardsOptions {
  language?: 'en' | 'fr';
  cardCount?: number;
}

// Chat Types
export interface ChatSession {
  id: string;
  courseId: string;
  courseName: string;
  courseLanguage: 'en' | 'fr';
  userId: string;
  title: string | null;
  messageCount: number;
  messages?: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  courseId?: string;
  role: 'user' | 'assistant';
  content: string;
  sources: ChatSource[] | null;
  createdAt: string;
}

export interface ChatSource {
  chapterId: string;
  chapterTitle: string;
  excerpt: string;
}

export interface ChatStats {
  totalSessions: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
}

// ============ SUMMARY API ============

export async function getSummary(chapterId: string, language?: string): Promise<Summary | null> {
  try {
    const params = language ? { language } : {};
    const response = await api.get(`/chapters/${chapterId}/summary`, { params });
    return response.data.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getChapterSummaries(chapterId: string): Promise<Summary[]> {
  const response = await api.get(`/chapters/${chapterId}/summaries`);
  return response.data.data;
}

export async function generateSummary(chapterId: string, language?: string): Promise<Summary> {
  const response = await api.post(`/chapters/${chapterId}/summary/generate`, { language });
  return response.data.data;
}

export async function regenerateSummary(summaryId: string): Promise<Summary> {
  const response = await api.post(`/summaries/${summaryId}/regenerate`);
  return response.data.data;
}

export async function deleteSummary(summaryId: string): Promise<void> {
  await api.delete(`/summaries/${summaryId}`);
}

// ============ QUIZ API ============

export async function getQuiz(quizId: string): Promise<Quiz> {
  const response = await api.get(`/quizzes/${quizId}`);
  return response.data.data;
}

export async function getChapterQuizzes(chapterId: string, language?: string): Promise<Quiz[]> {
  const params = language ? { language } : {};
  const response = await api.get(`/chapters/${chapterId}/quizzes`, { params });
  return response.data.data;
}

export async function getCourseQuizzes(courseId: string): Promise<Quiz[]> {
  const response = await api.get(`/courses/${courseId}/quizzes`);
  return response.data.data;
}

export async function generateQuiz(chapterId: string, options?: GenerateQuizOptions): Promise<Quiz> {
  const response = await api.post(`/chapters/${chapterId}/quiz/generate`, options || {});
  return response.data.data;
}

export async function submitQuizAttempt(
  quizId: string,
  answers: number[],
  timeTakenSeconds?: number
): Promise<QuizAttempt> {
  const response = await api.post(`/quizzes/${quizId}/attempt`, {
    answers,
    timeTakenSeconds,
  });
  return response.data.data;
}

export async function getAttemptReview(attemptId: string): Promise<QuizAttemptReview> {
  const response = await api.get(`/quiz-attempts/${attemptId}/review`);
  return response.data.data;
}

export async function getUserQuizAttempts(courseId?: string, limit?: number): Promise<QuizAttempt[]> {
  const params: Record<string, any> = {};
  if (courseId) params.courseId = courseId;
  if (limit) params.limit = limit;
  const response = await api.get('/quiz-attempts', { params });
  return response.data.data;
}

export async function getBestQuizAttempt(quizId: string): Promise<QuizAttempt | null> {
  const response = await api.get(`/quizzes/${quizId}/best-attempt`);
  return response.data.data;
}

export async function getQuizStats(courseId?: string): Promise<QuizStats> {
  const params = courseId ? { courseId } : {};
  const response = await api.get('/quiz-stats', { params });
  return response.data.data;
}

export async function deleteQuiz(quizId: string): Promise<void> {
  await api.delete(`/quizzes/${quizId}`);
}

// ============ FLASHCARD API ============

export async function getFlashcardDeck(deckId: string): Promise<FlashcardDeck> {
  const response = await api.get(`/flashcard-decks/${deckId}`);
  return response.data.data;
}

export async function getFlashcardDeckWithProgress(deckId: string): Promise<FlashcardDeck> {
  const response = await api.get(`/flashcard-decks/${deckId}/with-progress`);
  return response.data.data;
}

export async function getDeckProgress(deckId: string): Promise<DeckProgressStats & { deck: { id: string; name: string; chapterId: string; chapterTitle: string } }> {
  const response = await api.get(`/flashcard-decks/${deckId}/progress`);
  return response.data.data;
}

export async function getChapterFlashcardDecks(chapterId: string, language?: string): Promise<FlashcardDeck[]> {
  const params = language ? { language } : {};
  const response = await api.get(`/chapters/${chapterId}/flashcard-decks`, { params });
  return response.data.data;
}

export async function getCourseFlashcardDecks(courseId: string): Promise<FlashcardDeck[]> {
  const response = await api.get(`/courses/${courseId}/flashcard-decks`);
  return response.data.data;
}

export async function generateFlashcards(
  chapterId: string,
  options?: GenerateFlashcardsOptions
): Promise<FlashcardDeck> {
  const response = await api.post(`/chapters/${chapterId}/flashcards/generate`, options || {});
  return response.data.data;
}

export async function getCardsForReview(
  deckId?: string,
  limit?: number
): Promise<FlashcardForReview[]> {
  const params: Record<string, any> = {};
  if (deckId) params.deckId = deckId;
  if (limit) params.limit = limit;
  const response = await api.get('/flashcards/review', { params });
  return response.data.data;
}

export async function recordFlashcardReview(
  flashcardId: string,
  quality: number
): Promise<{ flashcardId: string; quality: number; progress: FlashcardProgress }> {
  const response = await api.post(`/flashcards/${flashcardId}/review`, { quality });
  return response.data.data;
}

export async function updateFlashcard(
  flashcardId: string,
  updates: { frontContent?: string; backContent?: string }
): Promise<Flashcard> {
  const response = await api.put(`/flashcards/${flashcardId}`, updates);
  return response.data.data;
}

export async function getFlashcardStats(courseId?: string): Promise<FlashcardStats> {
  const params = courseId ? { courseId } : {};
  const response = await api.get('/flashcard-stats', { params });
  return response.data.data;
}

export async function deleteFlashcardDeck(deckId: string): Promise<void> {
  await api.delete(`/flashcard-decks/${deckId}`);
}

// ============ CHAT API ============

export async function startChat(
  courseId: string,
  message?: string
): Promise<{ session: ChatSession; userMessage?: ChatMessage; assistantMessage?: ChatMessage }> {
  const response = await api.post(`/courses/${courseId}/chat`, { message });
  return response.data.data;
}

export async function getChatSession(sessionId: string): Promise<ChatSession> {
  const response = await api.get(`/chat-sessions/${sessionId}`);
  return response.data.data;
}

export async function getCourseChatSessions(courseId: string): Promise<ChatSession[]> {
  const response = await api.get(`/courses/${courseId}/chat-sessions`);
  return response.data.data;
}

export async function getUserChatSessions(limit?: number): Promise<ChatSession[]> {
  const params = limit ? { limit } : {};
  const response = await api.get('/chat-sessions', { params });
  return response.data.data;
}

export async function sendChatMessage(
  sessionId: string,
  message: string
): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage }> {
  const response = await api.post(`/chat-sessions/${sessionId}/messages`, { message });
  return response.data.data;
}

export async function updateChatSession(sessionId: string, title: string): Promise<ChatSession> {
  const response = await api.put(`/chat-sessions/${sessionId}`, { title });
  return response.data.data;
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  await api.delete(`/chat-sessions/${sessionId}`);
}

export async function getChatStats(courseId?: string): Promise<ChatStats> {
  const params = courseId ? { courseId } : {};
  const response = await api.get('/chat-stats', { params });
  return response.data.data;
}
