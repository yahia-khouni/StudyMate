import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Mail, 
  Calendar, 
  Shield, 
  Camera, 
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  User,
  Edit3,
  Save,
  X,
  Sparkles,
  Award
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GlassCard } from '@/components/ui/card';
import { 
  getProfile, 
  updateProfile, 
  deleteAccount,
  processAvatarFile,
  type UpdateProfileData 
} from '@/services/user.service';
import { useAuthStore } from '@/stores';
import { getErrorMessage } from '@/services/api';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);
  const locale = i18n.language === 'fr' ? fr : enUS;
  
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  // Sync form state when profile loads
  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateProfileData) => updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setIsEditing(false);
      toast.success(t('profile.updateSuccess', 'Profile updated successfully'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (password: string) => deleteAccount(password),
    onSuccess: () => {
      toast.success(t('profile.deleteSuccess', 'Account deleted'));
      logout();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleSave = () => {
    updateMutation.mutate({ firstName, lastName });
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await processAvatarFile(file);
      updateMutation.mutate({ avatarUrl: dataUrl });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDeleteAccount = () => {
    if (!deletePassword) {
      toast.error(t('profile.enterPassword', 'Please enter your password'));
      return;
    }
    deleteMutation.mutate(deletePassword);
  };

  const getInitials = () => {
    if (profile?.firstName && profile?.lastName) {
      return `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase();
    }
    return profile?.email?.[0]?.toUpperCase() || 'U';
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {t('profile.title', 'Profile')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('profile.subtitle', 'Manage your account information')}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Avatar & Quick Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Profile Card */}
          <GlassCard className="p-6 text-center relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-br from-primary/20 via-purple-500/20 to-pink-500/20" />
            
            <div className="relative">
              {/* Avatar */}
              <div className="relative inline-block -mt-2">
                <Avatar className="h-28 w-28 ring-4 ring-background shadow-xl">
                  <AvatarImage src={profile?.avatarUrl} alt={profile?.firstName || 'User'} />
                  <AvatarFallback className="text-3xl bg-gradient-to-br from-primary to-purple-600 text-white font-semibold">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={handleAvatarClick}
                  className="absolute bottom-1 right-1 p-2 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg"
                  aria-label={t('profile.changeAvatar', 'Change avatar')}
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              {/* Name & Email */}
              <div className="mt-4">
                <h2 className="text-xl font-semibold text-foreground">
                  {profile?.firstName} {profile?.lastName}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">{profile?.email}</p>
              </div>

              {/* Verification Badge */}
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-muted/50">
                {profile?.emailVerified ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-500">{t('profile.verified', 'Verified')}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-amber-500">{t('profile.notVerified', 'Not verified')}</span>
                  </>
                )}
              </div>
            </div>
          </GlassCard>

          {/* Account Stats */}
          <GlassCard className="p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Award className="h-4 w-4" />
              {t('profile.accountInfo', 'Account Information')}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('profile.memberSince', 'Member since')}</p>
                  <p className="text-sm font-medium text-foreground">
                    {profile?.createdAt && format(parseISO(profile.createdAt), 'MMMM d, yyyy', { locale })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Sparkles className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('profile.accountStatus', 'Status')}</p>
                  <p className="text-sm font-medium text-emerald-500">{t('profile.active', 'Active')}</p>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right Column - Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <GlassCard className="overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">{t('profile.personalInfo', 'Personal Information')}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t('profile.personalInfoDesc', 'Update your personal details')}
                  </p>
                </div>
              </div>
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2">
                  <Edit3 className="h-4 w-4" />
                  {t('common.edit', 'Edit')}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
                    {updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {t('common.save', 'Save')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            
            <div className="p-5 sm:p-6 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium">
                    {t('auth.firstName', 'First Name')}
                  </Label>
                  {isEditing ? (
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="h-11"
                      placeholder={t('auth.firstNamePlaceholder', 'Enter your first name')}
                    />
                  ) : (
                    <div className="h-11 px-3 flex items-center rounded-lg bg-muted/50 text-foreground">
                      {profile?.firstName || '-'}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium">
                    {t('auth.lastName', 'Last Name')}
                  </Label>
                  {isEditing ? (
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="h-11"
                      placeholder={t('auth.lastNamePlaceholder', 'Enter your last name')}
                    />
                  ) : (
                    <div className="h-11 px-3 flex items-center rounded-lg bg-muted/50 text-foreground">
                      {profile?.lastName || '-'}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('auth.email', 'Email Address')}</Label>
                <div className="h-11 px-3 flex items-center justify-between rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{profile?.email}</span>
                  </div>
                  {profile?.emailVerified ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-500">
                      <CheckCircle className="h-3.5 w-3.5" />
                      {t('profile.verified', 'Verified')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-500">
                      <XCircle className="h-3.5 w-3.5" />
                      {t('profile.notVerified', 'Not verified')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('profile.emailNote', 'Email cannot be changed after registration')}
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Danger Zone */}
          <GlassCard className="overflow-hidden border-destructive/30">
            <div className="p-5 sm:p-6 border-b border-destructive/20 bg-destructive/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <Shield className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h2 className="font-semibold text-destructive">{t('profile.dangerZone', 'Danger Zone')}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t('profile.dangerZoneDesc', 'Irreversible and destructive actions')}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-5 sm:p-6">
              {!showDeleteConfirm ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">{t('profile.deleteAccount', 'Delete Account')}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('profile.deleteAccountDesc', 'Permanently remove your account and all associated data')}
                    </p>
                  </div>
                  <Button 
                    variant="destructive" 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="gap-2 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('profile.deleteAccount', 'Delete Account')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 p-4 border border-destructive/30 rounded-xl bg-destructive/5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-destructive/10 shrink-0">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="font-medium text-destructive">
                        {t('profile.confirmDeleteTitle', 'Are you sure?')}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('profile.deleteWarning', 'This action cannot be undone. All your data will be permanently deleted.')}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deletePassword" className="text-sm font-medium">
                      {t('profile.confirmPassword', 'Enter your password to confirm')}
                    </Label>
                    <Input
                      id="deletePassword"
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder={t('auth.password', 'Password')}
                      className="h-11"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button 
                      variant="destructive" 
                      onClick={handleDeleteAccount}
                      disabled={deleteMutation.isPending}
                      className="gap-2"
                    >
                      {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t('profile.confirmDelete', 'Yes, delete my account')}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeletePassword('');
                      }}
                    >
                      {t('common.cancel', 'Cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
