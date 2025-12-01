import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { Loader2 } from 'lucide-react';

// Lazy load pages for better performance
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));

// Loading fallback
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen gradient-bg">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            
            {/* Auth routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected routes - Phase 3+ */}
            {/* <Route element={<ProtectedRoute />}> */}
            {/*   <Route path="/dashboard" element={<DashboardPage />} /> */}
            {/*   <Route path="/courses" element={<CoursesPage />} /> */}
            {/*   <Route path="/courses/:id" element={<CourseDetailPage />} /> */}
            {/*   <Route path="/calendar" element={<CalendarPage />} /> */}
            {/*   <Route path="/settings" element={<SettingsPage />} /> */}
            {/* </Route> */}

            {/* 404 */}
            {/* <Route path="*" element={<NotFoundPage />} /> */}
          </Routes>
        </Suspense>
        <Toaster position="top-right" />
      </div>
    </BrowserRouter>
  );
}

export default App;
