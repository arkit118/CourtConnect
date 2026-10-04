import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useParams } from 'react-router-dom';
import { AlertTriangle, AlertOctagon, ShieldAlert, Users, Compass } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ToastContainer } from './components/Toast';
import { LegalGateModal } from './components/LegalGateModal';
import { ScrollToTop } from './components/ScrollToTop';
import { MaintenanceGate } from './components/MaintenanceGate';
import { CONTACT_EMAIL, hasAcceptedCurrentTerms } from './lib/legal';
import { useLegalGateStore } from './hooks/useLegalGate';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage } from './pages/AuthPage';
import { ProfilePage, ProfileEditPage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { PlayersPage } from './pages/PlayersPage';
import { EventsPage, EventDetailPage } from './pages/EventsPage';
import { EventCreatePage } from './pages/EventCreatePage';
import { GearPage, GearDetailPage, GearCreatePage } from './pages/GearPage';
import { CourtsPage, CourtDetailPage } from './pages/CourtsPage';
import { SchedulingPage } from './pages/SchedulingPage';
import { DashboardPage, ImpactDashboardPage } from './pages/DashboardPage';
import { AdminPage } from './pages/AdminPage';
import { MatchesPage } from './pages/MatchesPage';
import { ChatPage } from './pages/ChatPage';
import { ParentalConsentPage } from './pages/ParentalConsentPage';

// Static pages
import { AboutPage, ContactPage } from './pages/static/AboutPage';
import { TermsPage, PrivacyPage, SafetyPage, CommunityGuidelinesPage } from './pages/static/LegalPages';

// Shown in place of protected content (never as a redirect - a redirect
// here risks bouncing the user between routes that both require
// acceptance) for a signed-in user whose profile has loaded but who
// hasn't accepted the current Terms/Privacy version yet. This is the
// "immediately after login, before protected pages" half of the legal
// gate; useActionGate (see hooks/useActionGate.ts) covers the "before a
// specific write action" half on pages that stay reachable while signed
// out (Schedule, Gear, Events).
function NeedsLegalGate() {
  const requestLegalAcceptance = useLegalGateStore((s) => s.request);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="card p-8 text-center max-w-md w-full border bg-primary-50 border-primary-200">
        <ShieldAlert className="w-10 h-10 mx-auto mb-4 text-primary-800" />
        <h1 className="text-lg font-bold text-secondary-900 mb-2">Please accept our Terms and Privacy Policy</h1>
        <p className="text-sm text-primary-800 mb-6">
          We've updated our Terms of Service and Privacy Policy. Please review and accept them to continue.
        </p>
        <button
          type="button"
          className="btn-primary"
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true);
            try {
              await requestLegalAcceptance();
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting ? 'Opening...' : 'Review and Accept Terms'}
        </button>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
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

  // profile still loading (or profileError) - let the page itself handle
  // that via useAuth(), same as before this gate existed.
  if (profile && !hasAcceptedCurrentTerms(profile)) {
    return <NeedsLegalGate />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!user || profile?.role !== 'admin' || profile?.is_banned) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// For pages built on other members' real profile data (the player
// directory and player profiles). Signed-out visitors get an explanation
// with Sign in / Create account instead of a bare redirect, and never any
// player data; signed-in users still pass the current Terms gate.
function MembersOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-gray-50 px-4 py-16">
        <div className="card p-8 text-center max-w-md w-full">
          <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-primary-600" />
          </div>
          <h1 className="font-display text-xl font-bold text-secondary-900 mb-2">Sign in to find players</h1>
          <p className="text-sm text-secondary-600 mb-6">
            To protect members' privacy, player profiles are only visible to signed-in CourtConnect members.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/auth/login" state={{ from: location }} className="btn-primary flex-1">Sign in</Link>
            <Link to="/auth/signup" className="btn-outline flex-1">Create account</Link>
          </div>
        </div>
      </div>
    );
  }

  if (profile && !hasAcceptedCurrentTerms(profile)) {
    return <NeedsLegalGate />;
  }

  return <>{children}</>;
}

// A session opened from a password-reset email belongs on the Reset
// Password screen until a new password is set, wherever the link landed
// (Supabase falls back to the Site URL if the reset URL isn't allow-listed).
function PasswordRecoveryRedirect() {
  const { passwordRecovery, user } = useAuth();
  const location = useLocation();
  if (passwordRecovery && user && location.pathname !== '/auth/reset-password') {
    return <Navigate to="/auth/reset-password" replace />;
  }
  return null;
}

function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-gray-50 px-4 py-16">
      <div className="card p-8 text-center max-w-md w-full">
        <Compass className="w-10 h-10 text-primary-500 mx-auto mb-4" />
        <h1 className="font-display text-xl font-bold text-secondary-900 mb-2">Page not found</h1>
        <p className="text-sm text-secondary-600 mb-6">That link doesn't go anywhere on CourtConnect.</p>
        <Link to="/" className="btn-primary">Go to home</Link>
      </div>
    </div>
  );
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

// /gear-exchange is an alias for /gear ("Gear Exchange" is the feature's
// display name; /gear is - and remains - the canonical route). This
// preserves the :id param when redirecting a gear detail link.
function GearExchangeDetailRedirect() {
  const { id } = useParams();
  return <Navigate to={`/gear/${id}`} replace />;
}

function BannedBanner() {
  const { profile } = useAuth();
  if (!profile?.is_banned) return null;

  return (
    <div className="bg-red-600 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-start gap-3 text-sm">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <p>
          Your account is restricted and cannot create bookings, listings, event registrations, reports, or profile
          changes. You can still browse public pages. If you believe this is a mistake, contact{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline font-medium">{CONTACT_EMAIL}</a>.
        </p>
      </div>
    </div>
  );
}

// Only shown when a signed-in user has no profile loaded at all - if one is
// already loaded, the app keeps working and background re-fetch failures
// are never surfaced (see AuthContext's reportProfileLoadFailure).
// AuthContext also retries automatically and clears this on success.
function ProfileErrorBanner() {
  const { profileError, profile, refreshProfile } = useAuth();
  const [retrying, setRetrying] = useState(false);
  if (!profileError || profile) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refreshProfile();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="bg-secondary-50 border-b border-secondary-200 text-secondary-700" role="status">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2.5">
          <AlertOctagon className="w-4 h-4 shrink-0 text-secondary-500" />
          <p>{profileError}</p>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="shrink-0 font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-60"
        >
          {retrying ? 'Trying...' : 'Try now'}
        </button>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <PasswordRecoveryRedirect />
      <Header />
      <ProfileErrorBanner />
      <BannedBanner />
      <main className="flex-1">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/safety" element={<SafetyPage />} />
          <Route path="/community-guidelines" element={<CommunityGuidelinesPage />} />

          {/* Auth Routes - Public only when not logged in */}
          <Route path="/auth/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
          <Route path="/auth/signup" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />
          <Route path="/auth/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
          {/* Not PublicOnlyRoute: the reset link signs the user in with a
              recovery session, and the page must stay reachable with it. */}
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

          {/* Player Routes - members only (real profile data) */}
          <Route path="/players" element={<MembersOnlyRoute><PlayersPage /></MembersOnlyRoute>} />
          <Route path="/players/:id" element={<MembersOnlyRoute><ProfilePage /></MembersOnlyRoute>} />

          {/* Event Routes */}
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/create" element={<ProtectedRoute><EventCreatePage /></ProtectedRoute>} />
          <Route path="/events/:id" element={<EventDetailPage />} />

          {/* /partners is retired as a separate product concept - Players
              and Partners were confusing as two overlapping nav items, so
              Partners' matching/request functionality was folded into
              /players (see PlayersPage.tsx). Both old routes alias
              straight to /players so existing links never 404, following
              the same pattern as the /gear-exchange alias below. */}
          <Route path="/partners" element={<Navigate to="/players" replace />} />
          <Route path="/partners/request/:id" element={<Navigate to="/players" replace />} />

          {/* Matching / Chat Routes - matching requires sign-in; the
              social/legal/consent eligibility gate itself is handled
              inside each page via useSocialEligibility, not here, so a
              signed-in-but-not-yet-eligible user still gets a clear
              in-page message instead of a redirect loop. */}
          <Route path="/matches" element={<ProtectedRoute><MatchesPage /></ProtectedRoute>} />
          <Route path="/matches/:id" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />

          {/* Parental consent - public, no account required for the parent/guardian */}
          <Route path="/parental-consent" element={<ParentalConsentPage />} />

          {/* Gear Routes */}
          <Route path="/gear" element={<GearPage />} />
          <Route path="/gear/:id" element={<GearDetailPage />} />
          <Route path="/gear/create" element={<ProtectedRoute><GearCreatePage /></ProtectedRoute>} />
          {/* /gear-exchange alias - see GearExchangeDetailRedirect above */}
          <Route path="/gear-exchange" element={<Navigate to="/gear" replace />} />
          <Route path="/gear-exchange/create" element={<Navigate to="/gear/create" replace />} />
          <Route path="/gear-exchange/:id" element={<GearExchangeDetailRedirect />} />

          {/* Courts Routes */}
          <Route path="/courts" element={<CourtsPage />} />
          <Route path="/courts/:id" element={<CourtDetailPage />} />

          {/* Scheduling Route */}
          <Route path="/schedule" element={<SchedulingPage />} />

          {/* Protected Dashboard Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/profile/edit" element={<ProtectedRoute><ProfileEditPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/impact" element={<ImpactDashboardPage />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />

          {/* Unknown URLs get a real page instead of an empty <main> */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
      <ToastContainer />
      <LegalGateModal />
    </>
  );
}

function App() {
  return (
    <Router>
      <MaintenanceGate>
        <AuthProvider>
          <div className="min-h-screen flex flex-col bg-gray-50">
            <AppRoutes />
          </div>
        </AuthProvider>
      </MaintenanceGate>
    </Router>
  );
}

export default App;
