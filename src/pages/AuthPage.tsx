import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { Mail, Lock, User, Eye, EyeOff, Calendar, Trophy, MapPin } from 'lucide-react';
import { calculateAge, ageBandForAge, MIN_SIGNUP_AGE } from '../lib/legal';
import { SKILL_LEVELS, UTR_MIN, UTR_MAX, isValidUtr } from '../lib/skillLevel';
import { AuthLayout } from '../components/brand/AuthLayout';
import { inAppLinkTarget } from '../lib/openExternal';

const DEFAULT_SIGNUP_LOCATION = 'Livingston, NJ';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToastStore();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      addToast({ type: 'success', message: 'Welcome back!' });
      navigate(from, { replace: true });
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to sign in' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout backTo="/" backLabel="Back to home" tagline="Your local court for Livingston, NJ tennis.">
      <h1 className="font-display text-2xl font-bold text-secondary-900 mb-2">Welcome back</h1>
      <p className="text-secondary-600 mb-8">Sign in to your CourtConnect account</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input pl-10"
              placeholder="you@example.com"
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pl-10 pr-10"
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="rounded border-secondary-300" />
            <span className="text-sm text-secondary-600">Remember me</span>
          </label>
          <Link to="/auth/forgot-password" className="text-sm text-primary-600 hover:text-primary-700">
            Forgot password?
          </Link>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="text-center text-secondary-600 mt-8">
        Don't have an account?{' '}
        <Link to="/auth/signup" className="text-primary-600 font-semibold hover:text-primary-700">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}

export function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [skillLevel, setSkillLevel] = useState('');
  const [utrRating, setUtrRating] = useState('');
  const [homeTown, setHomeTown] = useState(DEFAULT_SIGNUP_LOCATION);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [resending, setResending] = useState(false);
  const { signUp, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToastStore();

  // Account creation doesn't navigate to a new route when email
  // confirmation is required (the common case - Supabase's "Confirm
  // email" setting is on for App Store builds) - it swaps this same
  // /auth/signup screen from the long signup form to the "check your
  // email" card in place. The router-level ScrollToTop (src/components/
  // ScrollToTop.tsx) only fires on pathname/hash changes, so it never
  // sees this transition, and a user who scrolled to the bottom of the
  // form to hit "Create Account" was left staring at whatever was at that
  // same scroll position - often blank space below the confirmation
  // card - instead of the card itself. Scroll explicitly whenever this
  // screen switches into the confirmation view, on both web and
  // Capacitor iOS (same window.scrollTo the router-level version uses).
  useEffect(() => {
    if (confirmationPending) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [confirmationPending]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!dateOfBirth) {
      setFormError('Please enter your date of birth.');
      return;
    }

    const age = calculateAge(dateOfBirth);
    if (age < MIN_SIGNUP_AGE) {
      setFormError('You must be at least 13 to use CourtConnect.');
      return;
    }

    if (!skillLevel) {
      setFormError('Please choose a skill level.');
      return;
    }

    let utrValue: number | null = null;
    if (utrRating.trim()) {
      utrValue = parseFloat(utrRating);
      if (Number.isNaN(utrValue) || !isValidUtr(utrValue)) {
        setFormError(`Self-reported UTR rating must be a number between ${UTR_MIN} and ${UTR_MAX}.`);
        return;
      }
    }

    if (!agreedToTerms) {
      setFormError('Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    try {
      const { confirmationRequired } = await signUp(email, password, name, {
        date_of_birth: dateOfBirth,
        age_band: ageBandForAge(age),
        skill_level: skillLevel,
        utr_rating: utrValue,
        home_town: homeTown.trim() || DEFAULT_SIGNUP_LOCATION,
      });

      if (confirmationRequired) {
        setConfirmationPending(true);
      } else {
        addToast({ type: 'success', message: 'Account created! You can now log in.' });
        navigate('/auth/login');
      }
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to create account' });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerificationEmail(email);
      addToast({ type: 'success', message: 'Verification email sent - check your inbox.' });
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to resend verification email' });
    } finally {
      setResending(false);
    }
  };

  if (confirmationPending) {
    return (
      <AuthLayout backTo="/" backLabel="Back to home" tagline="Almost there - check your inbox.">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="font-display text-2xl font-bold text-secondary-900 mb-2">Check your email to verify your account</h1>
          <p className="text-secondary-600 mb-8">
            We've sent a verification link to <strong>{email}</strong>. You'll need to verify your email before using
            player matching or chat - the rest of CourtConnect is available once you sign in.
          </p>
          <button type="button" onClick={handleResend} className="btn-outline w-full mb-3" disabled={resending}>
            {resending ? 'Sending...' : 'Resend Verification Email'}
          </button>
          <Link to="/auth/login" className="btn-primary w-full">
            Back to Sign In
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout backTo="/" backLabel="Back to home" tagline="Find hitting partners, events, and gear in Livingston, NJ.">
      <h1 className="font-display text-2xl font-bold text-secondary-900 mb-2">Create your account</h1>
      <p className="text-secondary-600 mb-8">Join the CourtConnect community</p>

      <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input pl-10"
                  placeholder="Your name"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10 pr-10"
                  placeholder="Create a password (min 8 characters)"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Date of Birth</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="input pl-10"
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <p className="text-xs text-secondary-500 mt-1.5">
                We ask for your date of birth for age safety: it keeps CourtConnect's minimum age enforced, and
                members under 18 need a parent or guardian's approval before using player matching or chat.
              </p>
            </div>

            <div>
              <label className="label">Skill Level</label>
              <div className="relative">
                <Trophy className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <select
                  value={skillLevel}
                  onChange={(e) => setSkillLevel(e.target.value)}
                  className="input pl-10 appearance-none"
                  required
                >
                  <option value="" disabled>Choose your skill level</option>
                  {SKILL_LEVELS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Home Town</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input
                  type="text"
                  value={homeTown}
                  onChange={(e) => setHomeTown(e.target.value)}
                  className="input pl-10"
                  placeholder={DEFAULT_SIGNUP_LOCATION}
                />
              </div>
              <p className="text-xs text-secondary-500 mt-1.5">
                CourtConnect is currently a {DEFAULT_SIGNUP_LOCATION} tennis community pilot.
              </p>
            </div>

            <div>
              <label className="label">Self-Reported UTR Rating (Optional)</label>
              <div className="relative">
                <Trophy className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input
                  type="number"
                  step="0.1"
                  min={UTR_MIN}
                  max={UTR_MAX}
                  value={utrRating}
                  onChange={(e) => setUtrRating(e.target.value)}
                  className="input pl-10"
                  placeholder="e.g. 5.5 - leave blank if you don't have one"
                />
              </div>
              <p className="text-xs text-secondary-500 mt-1.5">
                This is what you tell us, not a verified rating - CourtConnect does not verify UTR.
              </p>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 rounded border-secondary-300"
                required
              />
              <span className="text-sm text-secondary-600">
                I agree to the{' '}
                <Link to="/terms" target={inAppLinkTarget} className="text-primary-600 hover:underline">Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" target={inAppLinkTarget} className="text-primary-600 hover:underline">Privacy Policy</Link>.
              </span>
            </label>

            <p className="text-xs text-secondary-500">
              CourtConnect is for community coordination only: it does not officially reserve courts or process
              gear payments. Minors should use CourtConnect with a parent or guardian's knowledge. See our{' '}
              <Link to="/safety" target={inAppLinkTarget} className="text-primary-600 hover:underline">Safety page</Link>.
            </p>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

      <p className="text-center text-secondary-600 mt-8">
        Already have an account?{' '}
        <Link to="/auth/login" className="text-primary-600 font-semibold hover:text-primary-700">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();
  const { addToast } = useToastStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
      addToast({ type: 'success', message: 'Password reset email sent!' });
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to send reset email' });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout backTo="/auth/login" backLabel="Back to sign in" tagline="Almost there - check your inbox.">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="font-display text-2xl font-bold text-secondary-900 mb-2">Check your email</h1>
          <p className="text-secondary-600 mb-8">
            We've sent password reset instructions to <strong>{email}</strong>
          </p>
          <Link to="/auth/login" className="btn-primary w-full">
            Back to Sign In
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout backTo="/auth/login" backLabel="Back to sign in" tagline="Forgot your password? No problem.">
      <h1 className="font-display text-2xl font-bold text-secondary-900 mb-2">Reset your password</h1>
      <p className="text-secondary-600 mb-8">Enter your email and we'll send you a reset link</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input pl-10"
              placeholder="you@example.com"
              required
            />
          </div>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
    </AuthLayout>
  );
}
