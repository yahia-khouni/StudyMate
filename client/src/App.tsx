import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';

// Pages (to be created in Phase 2+)
import LandingPage from '@/pages/LandingPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen gradient-bg">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          
          {/* Auth routes - Phase 2 */}
          {/* <Route path="/login" element={<LoginPage />} /> */}
          {/* <Route path="/register" element={<RegisterPage />} /> */}
          {/* <Route path="/verify-email" element={<VerifyEmailPage />} /> */}
          {/* <Route path="/forgot-password" element={<ForgotPasswordPage />} /> */}
          {/* <Route path="/reset-password" element={<ResetPasswordPage />} /> */}

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
        <Toaster position="top-right" />
      </div>
    </BrowserRouter>
  );
}

export default App;
