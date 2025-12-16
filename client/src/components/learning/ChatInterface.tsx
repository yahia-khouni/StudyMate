import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Loader2,
  MessageCircle,
  Send,
  Plus,
  ChevronDown,
  User,
  Bot,
  BookOpen,
  Trash2,
} from 'lucide-react';
import {
  startChat,
  getChatSession,
  getCourseChatSessions,
  sendChatMessage,
  deleteChatSession,
  type ChatSession,
  type ChatMessage,
  type ChatSource,
} from '@/services/learning.service';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface ChatInterfaceProps {
  courseId: string;
  courseName: string;
  courseLanguage: 'en' | 'fr';
}

export function ChatInterface({
  courseId,
  courseName,
  courseLanguage: _courseLanguage,
}: ChatInterfaceProps) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadSessions() {
    setLoading(true);
    setError(null);
    try {
      const data = await getCourseChatSessions(courseId);
      setSessions(data);
      
      // If there's a recent session, load it
      if (data.length > 0) {
        await loadSession(data[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load chat sessions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function loadSession(sessionId: string) {
    try {
      const session = await getChatSession(sessionId);
      setActiveSession(session);
      setMessages(session.messages || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load chat session');
    }
  }

  async function handleNewChat() {
    setLoading(true);
    setError(null);
    try {
      const result = await startChat(courseId);
      setSessions([result.session, ...sessions]);
      setActiveSession(result.session);
      setMessages([]);
      inputRef.current?.focus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start new chat');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage() {
    if (!inputMessage.trim() || sending) return;

    // If no active session, create one
    if (!activeSession) {
      await handleNewChat();
    }

    const messageText = inputMessage.trim();
    setInputMessage('');
    setSending(true);
    setError(null);

    // Optimistically add user message
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      sessionId: activeSession?.id || '',
      role: 'user',
      content: messageText,
      sources: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      let sessionId = activeSession?.id;
      
      // If no active session, start a new one
      if (!sessionId) {
        const result = await startChat(courseId, messageText);
        setSessions([result.session, ...sessions]);
        setActiveSession(result.session);
        sessionId = result.session.id;
        
        if (result.userMessage && result.assistantMessage) {
          setMessages([result.userMessage, result.assistantMessage]);
          return;
        }
      }

      const result = await sendChatMessage(sessionId!, messageText);
      
      // Replace temp message with real ones
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMessage.id),
        result.userMessage,
        result.assistantMessage,
      ]);

      // Update session in list
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, messageCount: s.messageCount + 2, updatedAt: new Date().toISOString() }
            : s
        )
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    
    if (!confirm(t('learning.chat.confirmDelete', 'Are you sure you want to delete this chat?'))) {
      return;
    }

    try {
      await deleteChatSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
        setMessages([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete chat');
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              {t('learning.chat.title', 'Study Assistant')}
            </CardTitle>
            <CardDescription>{courseName}</CardDescription>
          </div>
          <Button onClick={handleNewChat} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            {t('learning.chat.newChat', 'New Chat')}
          </Button>
        </div>
      </CardHeader>

      <div className="flex-1 flex overflow-hidden border-t">
        {/* Sessions Sidebar */}
        <div className="w-48 border-r bg-muted/30 overflow-y-auto">
          <div className="p-2">
            <h4 className="text-xs font-medium text-muted-foreground mb-2 px-2">
              {t('learning.chat.history', 'Chat History')}
            </h4>
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2">
                {t('learning.chat.noChats', 'No chats yet')}
              </p>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    className={cn(
                      'group flex items-center justify-between p-2 rounded-md cursor-pointer text-sm',
                      activeSession?.id === session.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    )}
                  >
                    <span className="truncate flex-1">
                      {session.title || t('learning.chat.untitled', 'New Chat')}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => handleDeleteSession(session.id, e)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            {loading && messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">
                  {t('learning.chat.welcome', 'Ask me anything about your course!')}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {t(
                    'learning.chat.welcomeDesc',
                    'I can help you understand concepts, answer questions, and explain topics from your uploaded materials.'
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {sending && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Bot className="h-5 w-5" />
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">{t('learning.chat.thinking', 'Thinking...')}</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {error && (
            <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('learning.chat.placeholder', 'Type your question...')}
                disabled={sending}
                className="flex-1"
              />
              <Button onClick={handleSendMessage} disabled={sending || !inputMessage.trim()}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const { t } = useTranslation();
  const isUser = message.role === 'user';
  const [sourcesOpen, setSourcesOpen] = useState(false);

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-lg p-3',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        <div className={cn('prose prose-sm', isUser ? 'prose-invert' : 'dark:prose-invert')}>
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen} className="mt-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between p-1 h-auto">
                <span className="flex items-center gap-1 text-xs">
                  <BookOpen className="h-3 w-3" />
                  {t('learning.chat.sources', '{{count}} sources', { count: message.sources.length })}
                </span>
                <ChevronDown
                  className={cn('h-3 w-3 transition-transform', sourcesOpen && 'rotate-180')}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {message.sources.map((source, index) => (
                <SourceCard key={index} source={source} />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        <p className="text-xs opacity-60 mt-1">
          {new Date(message.createdAt).toLocaleTimeString()}
        </p>
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}

function SourceCard({ source }: { source: ChatSource }) {
  return (
    <div className="text-xs p-2 bg-background/50 rounded border">
      <div className="font-medium">{source.chapterTitle}</div>
      <p className="text-muted-foreground mt-1 line-clamp-2">{source.excerpt}</p>
    </div>
  );
}
