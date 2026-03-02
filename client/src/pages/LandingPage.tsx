import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { 
  BookOpen, 
  Brain, 
  Calendar, 
  Flame, 
  Globe, 
  Sparkles, 
  ArrowRight,
  CheckCircle2,
  Zap,
  Users,
  GraduationCap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useAuthStore } from '@/stores/authStore';

export default function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuthStore();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const features = [
    {
      icon: Brain,
      title: t('landing.features.aiLearning.title', 'AI-Powered Learning'),
      description: t('landing.features.aiLearning.description', 'Generate summaries, quizzes, and flashcards automatically from your materials.'),
      color: 'from-violet-500 to-purple-500',
    },
    {
      icon: BookOpen,
      title: t('landing.features.courseManagement.title', 'Course Management'),
      description: t('landing.features.courseManagement.description', 'Organize your courses, chapters, and materials in one place.'),
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Sparkles,
      title: t('landing.features.smartChatbot.title', 'Smart AI Chatbot'),
      description: t('landing.features.smartChatbot.description', 'Ask questions and get answers based on your uploaded content.'),
      color: 'from-amber-500 to-orange-500',
    },
    {
      icon: Calendar,
      title: t('landing.features.studyCalendar.title', 'Study Calendar'),
      description: t('landing.features.studyCalendar.description', 'Plan your study sessions and track deadlines automatically.'),
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: Flame,
      title: t('landing.features.streakTracking.title', 'Streak Tracking'),
      description: t('landing.features.streakTracking.description', 'Stay motivated with daily streaks and progress tracking.'),
      color: 'from-red-500 to-rose-500',
    },
    {
      icon: Globe,
      title: t('landing.features.bilingual.title', 'Bilingual Support'),
      description: t('landing.features.bilingual.description', 'Full English and French support for UI and AI content.'),
      color: 'from-indigo-500 to-blue-500',
    },
  ];

  const benefits = [
    t('landing.benefits.saveTime', 'Save hours on creating study materials'),
    t('landing.benefits.retention', 'Improve retention with spaced repetition'),
    t('landing.benefits.organized', 'Stay organized with smart course management'),
    t('landing.benefits.progress', 'Track your progress with detailed analytics'),
  ];

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/20" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Gradient Background Effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/5 to-transparent rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t('common.appName', 'StudyMate')}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
              <Link to="/login">{t('auth.login', 'Sign In')}</Link>
            </Button>
            <Button size="sm" className="shadow-lg shadow-primary/25" asChild>
              <Link to="/register">
                {t('auth.register', 'Get Started')}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-28 sm:pt-36 pb-16 sm:pb-24 px-4 sm:px-6">
        <div className="container mx-auto text-center max-w-5xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8 animate-fade-in">
            <Zap className="w-4 h-4" />
            {t('landing.hero.badge', 'AI-Powered Study Platform')}
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            <span className="block text-foreground">{t('landing.hero.titleLine1', 'Study Smarter,')}</span>
            <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              {t('landing.hero.titleLine2', 'Not Harder')}
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            {t('landing.hero.description', 'Transform your learning with AI-generated summaries, quizzes, and flashcards. Upload your materials and let AI do the heavy lifting.')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button size="lg" className="text-base px-8 py-6 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all" asChild>
              <Link to="/register">
                {t('landing.hero.cta.primary', 'Start Learning Free')}
                <Sparkles className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 py-6 rounded-xl hover:bg-muted/50 transition-all" asChild>
              <Link to="/login">
                {t('landing.hero.cta.secondary', 'Sign In')}
              </Link>
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span>{t('landing.hero.trust.free', 'Free to start')}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span>{t('landing.hero.trust.noCard', 'No credit card required')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span>{t('landing.hero.trust.students', 'Join 1000+ students')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" id="features">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              {t('landing.features.title', 'Everything You Need to Excel')}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              {t('landing.features.subtitle', 'Powerful AI tools designed for university students in tech and science fields.')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <GlassCard 
                key={index} 
                className="p-6 group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/50 bg-card/50"
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                {t('landing.benefits.title', 'Why Students Love StudyMate')}
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                {t('landing.benefits.description', 'Join thousands of students who have transformed their study habits with our AI-powered platform.')}
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </div>
                    <span className="text-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-3xl blur-2xl" />
              <GlassCard className="relative p-8 border-border/50 bg-card/80">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{t('landing.demo.title', 'AI Study Assistant')}</div>
                    <div className="text-sm text-muted-foreground">{t('landing.demo.subtitle', 'Always ready to help')}</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted/50 text-sm">
                    <span className="text-muted-foreground">📚 </span>
                    {t('landing.demo.example1', 'Uploaded: "Machine Learning Fundamentals.pdf"')}
                  </div>
                  <div className="p-4 rounded-xl bg-primary/10 text-sm">
                    <span className="text-primary">✨ </span>
                    {t('landing.demo.example2', 'Generated: 25 flashcards, 10 quiz questions, comprehensive summary')}
                  </div>
                  <div className="p-4 rounded-xl bg-green-500/10 text-sm">
                    <span className="text-green-500">🎯 </span>
                    {t('landing.demo.example3', 'Quiz score: 85% - Great progress!')}
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="container mx-auto max-w-4xl">
          <GlassCard className="p-8 sm:p-12 text-center relative overflow-hidden border-border/50 bg-card/50">
            {/* Background decoration */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              {t('landing.cta.title', 'Ready to Transform Your Study Routine?')}
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto text-lg">
              {t('landing.cta.description', 'Join students who are already studying smarter with AI-powered tools. Start for free today.')}
            </p>
            <Button size="lg" className="text-base px-8 py-6 rounded-xl shadow-lg shadow-primary/25" asChild>
              <Link to="/register">
                {t('landing.cta.button', 'Get Started Now')}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </GlassCard>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 border-t border-border/50">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <span>{t('common.appName', 'StudyMate')}</span>
          </div>
          <p>© 2025 StudyMate. {t('landing.footer.rights', 'Built with ❤️ for students.')}</p>
        </div>
      </footer>
    </div>
  );
}
