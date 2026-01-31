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
  Trash2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('profile.title', 'Profile')}</h1>
        <p className="text-muted-foreground">
          {t('profile.subtitle', 'Manage your account information')}
        </p>
      </div>

      <div className="space-y-6">
        {/* Avatar Section */}
        <div className="rounded-2xl bg-card border border-border">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">{t('profile.avatar', 'Profile Picture')}</h2>
            <div className="flex items-center gap-6">
              <div className="relative group">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile?.avatarUrl} alt={profile?.firstName || 'User'} />
                  <AvatarFallback className="text-2xl bg-primary/20 text-primary">{getInitials()}</AvatarFallback>
                </Avatar>
                <button
                  onClick={handleAvatarClick}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={t('profile.changeAvatar', 'Change avatar')}
                >
                  <Camera className="h-6 w-6 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {profile?.firstName} {profile?.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={handleAvatarClick}
                >
                  {t('profile.uploadPhoto', 'Upload Photo')}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Info */}
        <div className="rounded-2xl bg-card border border-border">
          <div className="p-6 flex flex-row items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t('profile.personalInfo', 'Personal Information')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('profile.personalInfoDesc', 'Update your personal details')}
              </p>
            </div>
            {!isEditing && (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                {t('common.edit', 'Edit')}
              </Button>
            )}
          </div>
          <div className="px-6 pb-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t('auth.firstName', 'First Name')}</Label>
                {isEditing ? (
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                ) : (
                  <p className="text-sm py-2 text-foreground">{profile?.firstName || '-'}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t('auth.lastName', 'Last Name')}</Label>
                {isEditing ? (
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                ) : (
                  <p className="text-sm py-2 text-foreground">{profile?.lastName || '-'}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('auth.email', 'Email')}</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{profile?.email}</span>
                {profile?.emailVerified ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-500">
                    <CheckCircle className="h-3 w-3" />
                    {t('profile.verified', 'Verified')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-500">
                    <XCircle className="h-3 w-3" />
                    {t('profile.notVerified', 'Not verified')}
                  </span>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('common.save', 'Save')}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Account Info */}
        <div className="rounded-2xl bg-card border border-border">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">{t('profile.accountInfo', 'Account Information')}</h2>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {t('profile.memberSince', 'Member since')}:
              </span>
              <span className="text-sm text-foreground">
                {profile?.createdAt && format(parseISO(profile.createdAt), 'MMMM d, yyyy', { locale })}
              </span>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-2xl bg-card border border-destructive/50">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-destructive flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5" />
              {t('profile.dangerZone', 'Danger Zone')}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {t('profile.dangerZoneDesc', 'Irreversible and destructive actions')}
            </p>
            {!showDeleteConfirm ? (
              <Button 
                variant="destructive" 
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('profile.deleteAccount', 'Delete Account')}
              </Button>
            ) : (
              <div className="space-y-4 p-4 border border-destructive/50 rounded-lg bg-destructive/5">
                <p className="text-sm font-medium text-destructive">
                  {t('profile.deleteWarning', 'This action cannot be undone. All your data will be permanently deleted.')}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="deletePassword">
                    {t('profile.confirmPassword', 'Enter your password to confirm')}
                  </Label>
                  <Input
                    id="deletePassword"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder={t('auth.password', 'Password')}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteAccount}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
