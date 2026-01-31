import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore } from '@/stores/authStore';
import { getCurrentUser } from '@/services/auth.service';
import { Button } from '@/components/ui/button';

type CallbackStatus = 'processing' | 'success' | 'error';

export default function AuthCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setUser = useAuthStore((state) => state.setUser);
  const setLoading = useAuthStore((state) => state.setLoading);
  
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      // Check for error from OAuth provider
      const error = searchParams.get('error');
      if (error) {
        const errorDescription = searchParams.get('error_description') || t('auth.oauthError', 'Authentication failed');
        setStatus('error');
        setErrorMessage(errorDescription);
        return;
      }

      // Get token from URL
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setErrorMessage(t('auth.noTokenReceived', 'No authentication token received'));
        return;
      }

      try {
        // Store the token
        localStorage.setItem('accessToken', token);
        
        // Fetch user data
        const response = await getCurrentUser();
        setUser(response.user);
        setLoading(false);
        
        setStatus('success');
        toast.success(t('auth.loginSuccess', 'Welcome back!'));
        
        // Redirect to dashboard after brief success state
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 500);
      } catch (err) {
        console.error('OAuth callback error:', err);
        // Clear any stored token
        localStorage.removeItem('accessToken');
        setUser(null);
        setLoading(false);
        
        setStatus('error');
        setErrorMessage(t('auth.sessionError', 'Failed to establish session. Please try again.'));
      }
    };

    handleCallback();
  }, [searchParams, setUser, setLoading, navigate, t]);

  const handleRetry = () => {
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-6">
        <div className="text-center space-y-4">
          {status === 'processing' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <h1 className="text-xl font-semibold">
                {t('auth.processing', 'Completing sign in...')}
              </h1>
              <p className="text-muted-foreground">
                {t('auth.pleaseWait', 'Please wait while we set up your session.')}
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h1 className="text-xl font-semibold text-green-600">
                {t('auth.loginSuccess', 'Welcome back!')}
              </h1>
              <p className="text-muted-foreground">
                {t('auth.redirecting', 'Redirecting to dashboard...')}
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <h1 className="text-xl font-semibold text-destructive">
                {t('auth.authFailed', 'Authentication Failed')}
              </h1>
              <p className="text-muted-foreground">
                {errorMessage}
              </p>
              <Button onClick={handleRetry} className="mt-4">
                {t('auth.tryAgain', 'Try Again')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
