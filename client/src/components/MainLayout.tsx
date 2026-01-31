import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sidebar } from '@/components/Sidebar';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { NetworkStatus } from '@/components/NetworkStatus';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { useAuthStore } from '@/stores/authStore';

export function MainLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuthStore();

  const getUserInitials = () => {
    if (!user) return 'U';
    const firstInitial = user.firstName?.charAt(0) || '';
    const lastInitial = user.lastName?.charAt(0) || '';
    return `${firstInitial}${lastInitial}`.toUpperCase() || 'U';
  };

  // Get page title based on current route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return t('nav.dashboard', 'Dashboard');
    if (path.startsWith('/courses')) return t('nav.courses', 'Courses');
    if (path === '/calendar') return t('nav.calendar', 'Calendar');
    if (path === '/settings') return t('nav.settings', 'Settings');
    if (path === '/profile') return t('nav.profile', 'Profile');
    return t('nav.dashboard', 'Dashboard');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Skip to content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        {t('common.skipToContent', 'Skip to main content')}
      </a>
      
      <NetworkStatus />
      
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <div className="pl-[220px]">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-full items-center justify-between px-6">
            {/* Page Title */}
            <h1 className="text-xl font-semibold text-foreground">
              {getPageTitle()}
            </h1>

            {/* Center - Search Bar */}
            <div className="flex-1 max-w-xl mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={t('common.searchPlaceholder', 'Search for courses, notes, or quizzes...')}
                  className="w-full pl-10 bg-muted/50 border-border focus:bg-background"
                />
              </div>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              
              {/* Upload Button */}
              <Link to="/courses">
                <Button className="gap-2 bg-primary hover:bg-primary/90">
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('common.uploadMaterial', 'Upload Material')}</span>
                </Button>
              </Link>

              {/* Notifications */}
              <NotificationDropdown />

              {/* User Avatar */}
              <Link to="/profile">
                <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
                  <AvatarImage src={user?.avatarUrl} alt={user?.firstName} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main id="main-content" className="min-h-[calc(100vh-4rem)]" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
