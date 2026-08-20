import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, ChevronDown, Settings, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { Logo } from './brand/Logo';

const navLinks = [
  { to: '/events', label: 'Events' },
  { to: '/players', label: 'Players' },
  { to: '/matches', label: 'Matches' },
  { to: '/gear', label: 'Gear Exchange' },
  { to: '/courts', label: 'Courts' },
  { to: '/schedule', label: 'Schedule' },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { user, profile, isAuthenticated, signOut } = useAuth();
  const { addToast } = useToastStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch (err: any) {
      console.error('Error signing out:', err);
      addToast({ type: 'error', message: err?.message || 'Failed to sign out. Please try again.' });
    } finally {
      // Local auth state is always cleared by signOut() regardless of
      // whether the server call errored, so it's safe to always navigate
      // away and update the UI here too.
      setSigningOut(false);
      navigate('/');
    }
  };

  const isActive = (path: string) =>
    location.pathname === path || (path === '/matches' && location.pathname.startsWith('/matches/'));

  return (
    <header className="safe-top safe-x sticky top-0 z-50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-secondary-100 shadow-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-18">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center shrink-0">
              <Logo variant="lockup" className="h-8 md:h-10" />
            </Link>
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 ${
                    isActive(link.to)
                      ? 'bg-primary-600 text-white'
                      : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-secondary-50 transition-colors"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.name}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary-600" />
                    </div>
                  )}
                  <ChevronDown className="w-4 h-4 text-secondary-400 hidden sm:block" />
                </button>
                {isProfileOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsProfileOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-elevated border border-secondary-100 py-2 z-50">
                      <div className="px-4 py-3 border-b border-secondary-100">
                        <p className="font-semibold text-secondary-900">{profile?.name}</p>
                        <p className="text-sm text-secondary-500">{user?.email}</p>
                      </div>
                      <div className="py-2">
                        <Link
                          to="/dashboard"
                          className="flex items-center gap-3 px-4 py-2 text-sm font-semibold text-secondary-700 hover:bg-secondary-50"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <Settings className="w-4 h-4" />
                          Dashboard
                        </Link>
                        <Link
                          to="/profile"
                          className="flex items-center gap-3 px-4 py-2 text-sm font-semibold text-secondary-700 hover:bg-secondary-50"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <User className="w-4 h-4" />
                          My Profile
                        </Link>
                        <Link
                          to="/settings"
                          className="flex items-center gap-3 px-4 py-2 text-sm font-semibold text-secondary-700 hover:bg-secondary-50"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <Settings className="w-4 h-4" />
                          Settings
                        </Link>
                      </div>
                      <div className="border-t border-secondary-100 pt-2">
                        <button
                          onClick={() => {
                            setIsProfileOpen(false);
                            handleSignOut();
                          }}
                          disabled={signingOut}
                          className="flex items-center gap-3 w-full px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {signingOut ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <LogOut className="w-4 h-4" />
                          )}
                          {signingOut ? 'Signing out...' : 'Sign Out'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/auth/login"
                  className="btn-ghost hidden sm:inline-flex"
                >
                  Sign In
                </Link>
                <Link to="/auth/signup" className="btn-primary">
                  Join Now
                </Link>
              </div>
            )}

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-secondary-50"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="lg:hidden border-t border-secondary-100 py-4">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-4 py-3 rounded-xl text-[15px] font-semibold transition-colors duration-200 ${
                    isActive(link.to)
                      ? 'bg-primary-600 text-white'
                      : 'text-secondary-700 hover:text-secondary-900 hover:bg-secondary-50 active:bg-secondary-100'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {isAuthenticated ? (
                <>
                  <div className="border-t border-secondary-100 mt-2 pt-2">
                    <Link
                      to="/dashboard"
                      className="block px-4 py-3 rounded-xl text-[15px] font-semibold text-secondary-700 hover:text-secondary-900 hover:bg-secondary-50 active:bg-secondary-100"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/profile"
                      className="block px-4 py-3 rounded-xl text-[15px] font-semibold text-secondary-700 hover:text-secondary-900 hover:bg-secondary-50 active:bg-secondary-100"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      My Profile
                    </Link>
                    <Link
                      to="/settings"
                      className="block px-4 py-3 rounded-xl text-[15px] font-semibold text-secondary-700 hover:text-secondary-900 hover:bg-secondary-50 active:bg-secondary-100"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleSignOut();
                      }}
                      disabled={signingOut}
                      className="w-full text-left px-4 py-3 rounded-xl text-[15px] font-semibold text-red-600 hover:bg-red-50 active:bg-red-100 disabled:opacity-50"
                    >
                      {signingOut ? 'Signing out...' : 'Sign Out'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="border-t border-secondary-100 mt-2 pt-3 flex flex-col gap-2">
                  <Link
                    to="/auth/login"
                    className="px-4 py-3 rounded-xl text-[15px] font-semibold text-secondary-700 hover:text-secondary-900 hover:bg-secondary-50 text-center"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/auth/signup"
                    className="btn-primary justify-center"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Join Now
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
