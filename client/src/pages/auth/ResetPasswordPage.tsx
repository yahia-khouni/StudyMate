import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, Lock, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resetPassword } from '@/services/auth.service';
import { getErrorMessage } from '@/services/api';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations/auth';

type ResetStatus = 'form' | 'loading' | 'success' | 'error' | 'invalid-token';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<ResetStatus>('form');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  // Check if token is present
  useEffect(() => {
    if (!token) {
      setStatus('invalid-token');
    }
  }, [token]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setStatus('invalid-token');
      return;
    }

    setStatus('loading');
    try {
      await resetPassword(token, data.password);
      setStatus('success');
      toast.success(t('auth.passwordResetSuccess'));
      // Redirect to login after 3 seconds
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setStatus('error');
      setError(getErrorMessage(err));
    }
  };

  // Invalid token state
  if (status === 'invalid-token') {
    return (
      <AuthLayout title={t('auth.invalidLink', 'Invalid Link')}>
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-red-600">
              {t('auth.invalidResetLink', 'Invalid Reset Link')}
            </h2>
            <p className="text-muted-foreground mt-2">
              {t('auth.invalidResetLinkDescription', 'This password reset link is invalid or has expired. Please request a new one.')}
            </p>
          </div>
          <Button asChild className="w-full">
            <Link to="/forgot-password">{t('auth.requestNewLink', 'Request New Link')}</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <AuthLayout title={t('auth.passwordResetSuccess')}>
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-green-600">
              {t('auth.passwordResetSuccess')}
            </h2>
            <p className="text-muted-foreground mt-2">
              {t('auth.passwordResetSuccessDescription', 'Your password has been reset successfully. You can now log in with your new password.')}
            </p>
          </div>
          <Button asChild className="w-full">
            <Link to="/login">{t('auth.login')}</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <AuthLayout title={t('auth.resetFailed', 'Reset Failed')}>
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-red-600">
              {t('auth.resetFailed', 'Password Reset Failed')}
            </h2>
            <p className="text-muted-foreground mt-2">{error}</p>
          </div>
          <div className="space-y-2">
            <Button
              onClick={() => setStatus('form')}
              className="w-full"
            >
              {t('auth.tryAgain', 'Try Again')}
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/forgot-password">{t('auth.requestNewLink', 'Request New Link')}</Link>
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Loading state
  if (status === 'loading') {
    return (
      <AuthLayout title={t('auth.resetPasswordTitle')}>
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin" />
          </div>
          <p className="text-muted-foreground">
            {t('auth.resettingPassword', 'Resetting your password...')}
          </p>
        </div>
      </AuthLayout>
    );
  }

  // Form state
  return (
    <AuthLayout
      title={t('auth.resetPasswordTitle')}
      subtitle={t('auth.resetPasswordDescription')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Lock Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-8 w-8 text-primary" />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.newPassword')}</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={isSubmitting}
              {...register('password')}
              className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-red-500">{errors.password.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {t('auth.passwordRequirements', 'Password must be at least 8 characters long')}
          </p>
        </div>

        {/* Confirm Password Field */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={isSubmitting}
              {...register('confirmPassword')}
              className={errors.confirmPassword ? 'border-red-500 pr-10' : 'pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('common.loading')}
            </>
          ) : (
            t('auth.resetPassword')
          )}
        </Button>

        {/* Back to Login */}
        <div className="text-center">
          <Link 
            to="/login" 
            className="text-sm text-muted-foreground hover:text-primary"
          >
            {t('auth.backToLogin')}
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
