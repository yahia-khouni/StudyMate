import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  LayoutDashboard, 
  BookOpen, 
  Calendar, 
  Sparkles,
  Settings,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { logout } from '@/services/auth.service';

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

export function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout: logoutStore } = useAuthStore();

  const navItems: NavItem[] = [
    { icon: LayoutDashboard, label: t('nav.dashboard', 'Dashboard'), href: '/dashboard' },
    { icon: BookOpen, label: t('nav.courses', 'My Courses'), href: '/courses' },
    { icon: Calendar, label: t('nav.calendar', 'Calendar'), href: '/calendar' },
    { icon: Sparkles, label: t('nav.aiGenerators', 'AI Generators'), href: '/ai-generators' },
    { icon: Settings, label: t('nav.settings', 'Settings'), href: '/settings' },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      logoutStore();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      logoutStore();
      navigate('/login');
    }
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    const firstInitial = user.firstName?.charAt(0) || '';
    const lastInitial = user.lastName?.charAt(0) || '';
    return `${firstInitial}${lastInitial}`.toUpperCase() || 'U';
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[220px] bg-[hsl(var(--sidebar))] border-r border-[hsl(var(--sidebar-border))] flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <BookOpen className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-bold text-lg text-foreground">StudyAI</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'sidebar-item',
                active && 'active'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile Section */}
      <div className="p-4 border-t border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user?.avatarUrl} alt={user?.firstName} />
            <AvatarFallback className="bg-primary/20 text-primary">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {t('user.premiumStudent', 'Premium Student')}
            </p>
          </div>
        </div>

        {/* Logout */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 mt-2 text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          {t('auth.logout', 'Log out')}
        </Button>
      </div>
    </aside>
  );
}

export default Sidebar;
