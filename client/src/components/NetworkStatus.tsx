import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NetworkStatus() {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Show "back online" message briefly
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium transition-all duration-300',
        isOnline
          ? 'bg-green-500 text-white'
          : 'bg-yellow-500 text-yellow-900'
      )}
    >
      {isOnline ? (
        <span className="flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4" />
          {t('common.backOnline', 'You\'re back online')}
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          {t('common.offline', 'You\'re offline. Some features may be unavailable.')}
        </span>
      )}
    </div>
  );
}

export default NetworkStatus;
