import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { getCurrentUser } from '@/services/auth.service';

// Lazy load pages for better performance
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));

// Course pages
const CoursesListPage = lazy(() => import('@/pages/courses/CoursesListPage'));
const CourseDetailPage = lazy(() => import('@/pages/courses/CourseDetailPage'));
const ChapterViewPage = lazy(() => import('@/pages/courses/ChapterViewPage'));

// Layout
const MainLayout = lazy(() => import('@/components/MainLayout'));

// Loading fallback
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

// Redirect authenticated users away from auth pages
function AuthRoute() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <PageLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/courses" replace />;
  }

  return <Outlet />;
}

// Auth initialization hook
function useAuthInit() {
  const { setUser, setLoading, isAuthenticated, user } = useAuthStore();
  const { connect, disconnect } = useNotificationStore();

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await getCurrentUser();
        setUser(response.user);
      } catch {
        // Token is invalid, clear it
        localStorage.removeItem('accessToken');
        setUser(null);
      }
    };

    // Only init if we haven't already loaded the user
    if (!isAuthenticated) {
      initAuth();
    } else {
      setLoading(false);
    }
  }, [setUser, setLoading, isAuthenticated]);

  // Connect WebSocket when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      connect(user.id);
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, user?.id, connect, disconnect]);
}

function App() {
  // Initialize auth state on app load
  useAuthInit();
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-right" />
    </>
  );
}

// Create router with future flags to suppress warnings
const router = createBrowserRouter(
  [
    // Public routes
    { path: '/', element: <Suspense fallback={<PageLoader />}><LandingPage /></Suspense> },
    
    // Auth routes - redirect if already logged in
    {
      element: <AuthRoute />,
      children: [
        { path: '/login', element: <Suspense fallback={<PageLoader />}><LoginPage /></Suspense> },
        { path: '/register', element: <Suspense fallback={<PageLoader />}><RegisterPage /></Suspense> },
        { path: '/forgot-password', element: <Suspense fallback={<PageLoader />}><ForgotPasswordPage /></Suspense> },
        { path: '/reset-password', element: <Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense> },
      ],
    },
    { path: '/verify-email', element: <Suspense fallback={<PageLoader />}><VerifyEmailPage /></Suspense> },

    // Protected routes
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <Suspense fallback={<PageLoader />}><MainLayout /></Suspense>,
          children: [
            { path: '/courses', element: <Suspense fallback={<PageLoader />}><CoursesListPage /></Suspense> },
            { path: '/courses/:courseId', element: <Suspense fallback={<PageLoader />}><CourseDetailPage /></Suspense> },
            { path: '/courses/:courseId/chapters/:chapterId', element: <Suspense fallback={<PageLoader />}><ChapterViewPage /></Suspense> },
          ],
        },
      ],
    },

    // 404 - redirect to home
    { path: '*', element: <Navigate to="/" replace /> },
  ],
  {
    future: {
      // @ts-expect-error - These are valid future flags but types may be outdated
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
);

export default App;
