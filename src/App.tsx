import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ToastContainer } from './components/Toast';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage, SignupPage, ForgotPasswordPage } from './pages/AuthPage';
import { ProfilePage, ProfileEditPage } from './pages/ProfilePage';
import { PlayersPage } from './pages/PlayersPage';
import { EventsPage, EventDetailPage } from './pages/EventsPage';
import { EventCreatePage } from './pages/EventCreatePage';
import { PartnersPage, PartnerRequestPage } from './pages/PartnersPage';
import { GearPage, GearDetailPage, GearCreatePage } from './pages/GearPage';
import { CourtsPage, CourtDetailPage } from './pages/CourtsPage';
import { SchedulingPage } from './pages/SchedulingPage';
import { DashboardPage, ImpactDashboardPage } from './pages/DashboardPage';
import { AdminPage } from './pages/AdminPage';

// Static pages
import { AboutPage, PrivacyPage, TermsPage, ContactPage } from './pages/static/AboutPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (user) {
    const from = (location.state as any)?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />

          {/* Auth Routes - Public only when not logged in */}
          <Route path="/auth/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
          <Route path="/auth/signup" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />
          <Route path="/auth/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />

          {/* Player Routes */}
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/players/:id" element={<ProfilePage />} />

          {/* Event Routes */}
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/create" element={<ProtectedRoute><EventCreatePage /></ProtectedRoute>} />
          <Route path="/events/:id" element={<EventDetailPage />} />

          {/* Partner Routes */}
          <Route path="/partners" element={<PartnersPage />} />
          <Route path="/partners/request/:id" element={<PartnerRequestPage />} />

          {/* Gear Routes */}
          <Route path="/gear" element={<GearPage />} />
          <Route path="/gear/:id" element={<GearDetailPage />} />
          <Route path="/gear/create" element={<ProtectedRoute><GearCreatePage /></ProtectedRoute>} />

          {/* Courts Routes */}
          <Route path="/courts" element={<CourtsPage />} />
          <Route path="/courts/:id" element={<CourtDetailPage />} />

          {/* Scheduling Route */}
          <Route path="/schedule" element={<SchedulingPage />} />

          {/* Protected Dashboard Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/profile/edit" element={<ProtectedRoute><ProfileEditPage /></ProtectedRoute>} />
          <Route path="/impact" element={<ImpactDashboardPage />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        </Routes>
      </main>
      <Footer />
      <ToastContainer />
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-gray-50">
          <AppRoutes />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
