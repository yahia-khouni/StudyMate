import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Globe, 
  Palette, 
  Bell, 
  Lock, 
  Loader2,
  Moon,
  Sun,
  Monitor,
  Check
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  getSettings, 
  updateSettings, 
  changePassword,
} from '@/services/user.service';
import { getErrorMessage } from '@/services/api';

type Theme = 'light' | 'dark' | 'system';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  
  // Theme state (stored in localStorage)
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'system';
  });
  
  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Notifications state (local for now)
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('notifications') !== 'false';
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success(t('settings.updateSuccess', 'Settings updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(t('settings.passwordChanged', 'Password changed successfully'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleLanguageChange = (lang: 'en' | 'fr') => {
    i18n.changeLanguage(lang);
    localStorage.setItem('studyai-language', lang);
    updateSettingsMutation.mutate({ languagePreference: lang });
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Apply theme to document
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (newTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(newTheme);
    }
    
    toast.success(t('settings.themeChanged', 'Theme updated'));
  };

  const handleNotificationsChange = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    localStorage.setItem('notifications', String(enabled));
    toast.success(enabled 
      ? t('settings.notificationsEnabled', 'Notifications enabled')
      : t('settings.notificationsDisabled', 'Notifications disabled')
    );
  };

  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) {
      toast.error(t('auth.passwordMismatch', 'Passwords do not match'));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t('auth.passwordTooShort', 'Password must be at least 8 characters'));
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  if (isLoading) {
    return (
      <div className="py-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="py-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('settings.title', 'Settings')}</h1>
        <p className="text-muted-foreground">
          {t('settings.subtitle', 'Customize your experience')}
        </p>
      </div>

      <div className="space-y-6">
        {/* Language Settings */}
        <div className="rounded-2xl bg-card border border-border">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t('settings.language', 'Language')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('settings.languageDesc', 'Choose your preferred language')}
            </p>
          </div>
          <div className="p-6">
            <Select 
              value={settings?.languagePreference || i18n.language} 
              onValueChange={(value) => handleLanguageChange(value as 'en' | 'fr')}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">
                  <span className="flex items-center gap-2">
                    🇺🇸 English
                  </span>
                </SelectItem>
                <SelectItem value="fr">
                  <span className="flex items-center gap-2">
                    🇫🇷 Français
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Theme Settings */}
        <div className="rounded-2xl bg-card border border-border">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t('settings.theme', 'Theme')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('settings.themeDesc', 'Select your preferred color theme')}
            </p>
          </div>
          <div className="p-6">
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                onClick={() => handleThemeChange('light')}
                className="flex-1"
              >
                <Sun className="mr-2 h-4 w-4" />
                {t('settings.light', 'Light')}
                {theme === 'light' && <Check className="ml-2 h-4 w-4" />}
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                onClick={() => handleThemeChange('dark')}
                className="flex-1"
              >
                <Moon className="mr-2 h-4 w-4" />
                {t('settings.dark', 'Dark')}
                {theme === 'dark' && <Check className="ml-2 h-4 w-4" />}
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                onClick={() => handleThemeChange('system')}
                className="flex-1"
              >
                <Monitor className="mr-2 h-4 w-4" />
                {t('settings.system', 'System')}
                {theme === 'system' && <Check className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="rounded-2xl bg-card border border-border">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t('settings.notifications', 'Notifications')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('settings.notificationsDesc', 'Manage your notification preferences')}
            </p>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{t('settings.pushNotifications', 'Push Notifications')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('settings.pushNotificationsDesc', 'Receive notifications about your study progress')}
                </p>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={handleNotificationsChange}
                aria-label={t('settings.toggleNotifications', 'Toggle notifications')}
              />
            </div>
          </div>
        </div>

        {/* Password Settings */}
        <div className="rounded-2xl bg-card border border-border">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Lock className="h-5 w-5" />
              {t('settings.security', 'Security')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('settings.securityDesc', 'Manage your account security')}
            </p>
          </div>
          <div className="p-6">
            {!showPasswordForm ? (
              <Button variant="outline" onClick={() => setShowPasswordForm(true)}>
                {t('settings.changePassword', 'Change Password')}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">
                    {t('settings.currentPassword', 'Current Password')}
                  </Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">
                    {t('settings.newPassword', 'New Password')}
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">
                    {t('settings.confirmNewPassword', 'Confirm New Password')}
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handlePasswordChange}
                    disabled={changePasswordMutation.isPending}
                  >
                    {changePasswordMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t('settings.updatePassword', 'Update Password')}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowPasswordForm(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                  >
                    {t('common.cancel', 'Cancel')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
