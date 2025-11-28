import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { BookOpen, Brain, Calendar, Flame, Globe, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function LandingPage() {
  const { t } = useTranslation();

  const features = [
    {
      icon: Brain,
      titleKey: 'AI-Powered Learning',
      descriptionKey: 'Generate summaries, quizzes, and flashcards automatically from your materials.',
    },
    {
      icon: BookOpen,
      titleKey: 'Course Management',
      descriptionKey: 'Organize your courses, chapters, and materials in one place.',
    },
    {
      icon: Sparkles,
      titleKey: 'Smart Chatbot',
      descriptionKey: 'Ask questions and get answers based on your uploaded content.',
    },
    {
      icon: Calendar,
      titleKey: 'Study Calendar',
      descriptionKey: 'Plan your study sessions and track deadlines automatically.',
    },
    {
      icon: Flame,
      titleKey: 'Streak Tracking',
      descriptionKey: 'Stay motivated with daily streaks and progress tracking.',
    },
    {
      icon: Globe,
      titleKey: 'Bilingual Support',
      descriptionKey: 'Full English and French support for UI and AI content.',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-white/70 dark:bg-gray-900/70 border-b border-white/20">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-heading font-bold text-gradient">
              {t('common.appName')}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Button variant="ghost" asChild>
              <Link to="/login">{t('auth.login')}</Link>
            </Button>
            <Button asChild>
              <Link to="/register">{t('auth.register')}</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-5xl md:text-6xl font-heading font-bold mb-6">
            <span className="text-gradient">AI-Powered</span> Study Platform
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Transform your learning experience with intelligent summaries, quizzes, and a personal AI tutor. 
            Study smarter, not harder.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8" asChild>
              <Link to="/register">
                Get Started Free
                <Sparkles className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-4">
            Everything You Need to Excel
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Powerful tools designed for university students in tech and science fields.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <GlassCard key={index} className="p-6 hover:shadow-glass-lg transition-shadow">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-heading font-semibold mb-2">{feature.titleKey}</h3>
                <p className="text-muted-foreground text-sm">{feature.descriptionKey}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <GlassCard className="p-8 md:p-12 text-center glass-card-lg">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Ready to Transform Your Study Routine?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join thousands of students who are already studying smarter with AI-powered tools.
            </p>
            <Button size="lg" className="text-lg px-8" asChild>
              <Link to="/register">
                Start Learning Today
                <Sparkles className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </GlassCard>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border/50">
        <div className="container mx-auto text-center text-muted-foreground text-sm">
          <p>© 2025 StudyAI. Built with ❤️ for students.</p>
        </div>
      </footer>
    </div>
  );
}
