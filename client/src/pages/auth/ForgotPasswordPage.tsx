import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPassword } from '@/services/auth.service';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/lib/validations/auth';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await forgotPassword(data.email);
      setSubmittedEmail(data.email);
      setIsSubmitted(true);
      toast.success(t('auth.resetLinkSent'));
    } catch {
      // Don't show error for security - always show success
      // This prevents email enumeration attacks
      setSubmittedEmail(data.email);
      setIsSubmitted(true);
    }
  };

  // Success state
  if (isSubmitted) {
    return (
      <AuthLayout
        title={t('auth.checkYourEmail', 'Check Your Email')}
      >
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-muted-foreground">
              {t('auth.resetLinkSentDescription', 'If an account exists with this email, we\'ve sent you a password reset link.')}
            </p>
            <p className="font-medium">{submittedEmail}</p>
          </div>

          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              {t('auth.didntReceiveReset', "Didn't receive the email? Check your spam folder or try again.")}
            </p>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsSubmitted(false)}
            >
              {t('auth.tryAgain', 'Try again')}
            </Button>
          </div>

          <div className="pt-4 border-t border-border">
            <Link 
              to="/login" 
              className="inline-flex items-center text-sm text-primary hover:underline"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('auth.backToLogin')}
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.forgotPasswordTitle')}
      subtitle={t('auth.forgotPasswordDescription')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Email Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-8 w-8 text-primary" />
          </div>
        </div>

        {/* Email Field */}
        <div className="space-y-2">
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            disabled={isSubmitting}
            {...register('email')}
            className={errors.email ? 'border-red-500' : ''}
          />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
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
            t('auth.sendResetLink')
          )}
        </Button>

        {/* Back to Login */}
        <div className="text-center">
          <Link 
            to="/login" 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('auth.backToLogin')}
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
