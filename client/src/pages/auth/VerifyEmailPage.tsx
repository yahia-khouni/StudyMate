import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Mail, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { verifyEmail, resendVerification } from '@/services/auth.service';
import { getErrorMessage } from '@/services/api';

type VerificationStatus = 'idle' | 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const emailFromState = (location.state as { email?: string })?.email;

  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState(emailFromState || '');

  const verifyToken = useCallback(async (verificationToken: string) => {
    setStatus('loading');
    try {
      await verifyEmail(verificationToken);
      setStatus('success');
      toast.success(t('auth.emailVerified'));
      // Redirect to login after 3 seconds
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setStatus('error');
      setError(getErrorMessage(err));
    }
  }, [navigate, t]);

  // If token is present, verify it
  useEffect(() => {
    if (token) {
      verifyToken(token);
    }
  }, [token, verifyToken]);

  const handleResend = async () => {
    if (!email) {
      toast.error(t('auth.emailRequired'));
      return;
    }
    
    setResending(true);
    try {
      await resendVerification(email);
      toast.success(t('auth.verifyEmailSent'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  // If token is being verified
  if (token) {
    return (
      <AuthLayout title={t('auth.verifyEmailTitle')}>
        <div className="text-center space-y-6">
          {status === 'loading' && (
            <>
              <div className="flex justify-center">
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
              </div>
              <p className="text-muted-foreground">
                {t('auth.verifyingEmail', 'Verifying your email...')}
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-green-600">
                  {t('auth.emailVerified')}
                </h2>
                <p className="text-muted-foreground mt-2">
                  {t('auth.redirectingToLogin', 'Redirecting to login...')}
                </p>
              </div>
              <Button asChild>
                <Link to="/login">{t('auth.login')}</Link>
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <XCircle className="h-10 w-10 text-red-600" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-red-600">
                  {t('auth.verificationFailed', 'Verification Failed')}
                </h2>
                <p className="text-muted-foreground mt-2">{error}</p>
              </div>
              <div className="space-y-2">
                <Button asChild variant="outline" className="w-full">
                  <Link to="/login">{t('auth.login')}</Link>
                </Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link to="/register">{t('auth.register')}</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </AuthLayout>
    );
  }

  // No token - show waiting screen
  return (
    <AuthLayout
      title={t('auth.verifyEmailTitle')}
      subtitle={t('auth.verifyEmailDescription')}
    >
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-10 w-10 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground">
            {t('auth.checkInbox', "We've sent a verification link to your email. Please check your inbox and click the link to verify your account.")}
          </p>
          {email && (
            <p className="font-medium">{email}</p>
          )}
        </div>

        <div className="pt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('auth.didntReceive', "Didn't receive the email?")}
          </p>
          
          {!email && (
            <div className="space-y-2">
              <input
                type="email"
                placeholder={t('auth.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <Button
            onClick={handleResend}
            disabled={resending || !email}
            variant="outline"
            className="w-full"
          >
            {resending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('common.loading')}
              </>
            ) : (
              t('auth.resendVerification')
            )}
          </Button>
        </div>

        <div className="pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {t('auth.wrongEmail', 'Wrong email?')}{' '}
            <Link to="/register" className="text-primary hover:underline">
              {t('auth.registerAgain', 'Register again')}
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
