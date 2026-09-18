import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, EMAIL_NOT_CONFIRMED_MESSAGE } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { Mail, Lock, User, Eye, EyeOff, Calendar, Trophy, MapPin } from 'lucide-react';
import { calculateAge, ageBandForAge, MIN_SIGNUP_AGE } from '../lib/legal';
import { SKILL_LEVELS, UTR_MIN, UTR_MAX, isValidUtr } from '../lib/skillLevel';
import { isValidEmail } from '../lib/validation';
import { AuthLayout } from '../components/brand/AuthLayout';
import { inAppLinkTarget } from '../lib/openExternal';

const DEFAULT_SIGNUP_LOCATION = 'Livingston, NJ';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // Reserved for messages that aren't tied to one field - currently only
  // the "verify your email first" case, which needs the resend action
  // right below it rather than living under either input.
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const { signIn, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToastStore();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    setFormNotice(null);

    if (!email.trim()) {
      setEmailError('Please enter your email address.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      setEmailError('Enter a valid email address.');
      return;
    }
    if (!password) {
      setPasswordError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      addToast({ type: 'success', message: 'Welcome back!' });
      navigate(from, { replace: true });
    } catch (error: any) {
      const message: string = error?.message || '';
      if (message === EMAIL_NOT_CONFIRMED_MESSAGE) {
        setFormNotice(message);
      } else {
        // Never confirm which of email/password was wrong - that would
        // let this form be used to check whether an email is registered.
        setPasswordError('Email or password is incorrect.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendVerificationEmail(email.trim());
      addToast({ type: 'success', message: 'Verification email sent - check your inbox.' });
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to resend verification email' });
    }
  };

  return (
    <AuthLayout backTo="/" backLabel="Back to home" tagline="Your local court for Livingston & nearby NJ tennis.">
      <h1 className="font-display text-2xl font-bold text-secondary-900 mb-2">Welcome back</h1>
      <p className="text-secondary-600 mb-8">Sign in to your CourtConnect account</p>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label className="label">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              className={`input pl-10 ${emailError ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
              placeholder="you@example.com"
              aria-invalid={!!emailError}
            />
          </div>
          {emailError && <p className="text-sm text-red-600 mt-1.5">{emailError}</p>}
        </div>

        <div>
          <label className="label">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              className={`input pl-10 pr-10 ${passwordError ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
              placeholder="Enter your password"
              aria-invalid={!!passwordError}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {passwordError && <p className="text-sm text-red-600 mt-1.5">{passwordError}</p>}
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

        {formNotice && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            <p className="mb-2">{formNotice}</p>
            <button type="button" onClick={handleResend} className="font-semibold underline">
              Resend verification email
            </button>
          </div>
        )}

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
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [dobError, setDobError] = useState<string | null>(null);
  const [skillError, setSkillError] = useState<string | null>(null);
  const [utrError, setUtrError] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);
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

  const clearErrors = () => {
    setNameError(null);
    setEmailError(null);
    setPasswordError(null);
    setDobError(null);
    setSkillError(null);
    setUtrError(null);
    setTermsError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (!name.trim()) {
      setNameError('Please enter your full name.');
      return;
    }

    if (!email.trim()) {
      setEmailError('Please enter your email address.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      setEmailError('Enter a valid email address.');
      return;
    }

    if (!password) {
      setPasswordError('Please create a password.');
      return;
    }
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }

    if (!dateOfBirth) {
      setDobError('Please enter your date of birth.');
      return;
    }

    const age = calculateAge(dateOfBirth);
    if (age < MIN_SIGNUP_AGE) {
      setDobError('You must be at least 13 to use CourtConnect.');
      return;
    }

    if (!skillLevel) {
      setSkillError('Please choose a skill level.');
      return;
    }

    let utrValue: number | null = null;
    if (utrRating.trim()) {
      utrValue = parseFloat(utrRating);
      if (Number.isNaN(utrValue) || !isValidUtr(utrValue)) {
        setUtrError(`Self-reported UTR rating must be a number between ${UTR_MIN} and ${UTR_MAX}.`);
        return;
      }
    }

    if (!agreedToTerms) {
      setTermsError('Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    try {
      const { confirmationRequired } = await signUp(email.trim(), password, name.trim(), {
        date_of_birth: dateOfBirth,
        age_band: ageBandForAge(age),
        skill_level: skillLevel,
        utr_rating: utrValue,
        home_town: homeTown.trim() || DEFAULT_SIGNUP_LOCATION,
      });

      if (confirmationRequired) {
        setConfirmationPending(true);
      } else {
        // Navigate straight to /dashboard rather than /auth/login: signUp()
        // already has an active session at this point, but the user/profile
        // state in AuthContext updates from the auth listener's SIGNED_IN
        // event asynchronously, not synchronously here. Routing through
        // /auth/login and relying on PublicOnlyRoute to redirect once that
        // event lands left a brief window where the Login page (and its
        // "Welcome back" heading) rendered for a genuinely brand-new
        // account. Going straight to /dashboard has no such window, and
        // "Welcome back" is reserved for the login form itself.
        addToast({ type: 'success', message: 'Welcome to CourtConnect! Your profile is ready.' });
        navigate('/dashboard', { replace: true });
      }
    } catch (error: any) {
      setEmailError(error.message || 'Failed to create account. Please try again.');
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
    <AuthLayout backTo="/" backLabel="Back to home" tagline="Find hitting partners, events, and gear across Livingston and nearby NJ towns.">
      <h1 className="font-display text-2xl font-bold text-secondary-900 mb-2">Create your account</h1>
      <p className="text-secondary-600 mb-8">Join the CourtConnect community</p>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label className="label">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (nameError) setNameError(null); }}
                  className={`input pl-10 ${nameError ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
                  placeholder="Your name"
                  aria-invalid={!!nameError}
                />
              </div>
              {nameError && <p className="text-sm text-red-600 mt-1.5">{nameError}</p>}
            </div>

            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null); }}
                  className={`input pl-10 ${emailError ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
                  placeholder="you@example.com"
                  aria-invalid={!!emailError}
                />
              </div>
              {emailError && <p className="text-sm text-red-600 mt-1.5">{emailError}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(null); }}
                  className={`input pl-10 pr-10 ${passwordError ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
                  placeholder="Create a password (min 8 characters)"
                  aria-invalid={!!passwordError}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passwordError && <p className="text-sm text-red-600 mt-1.5">{passwordError}</p>}
            </div>

            <div>
              <label className="label">Date of Birth</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => { setDateOfBirth(e.target.value); if (dobError) setDobError(null); }}
                  className={`input pl-10 ${dobError ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
                  max={new Date().toISOString().split('T')[0]}
                  aria-invalid={!!dobError}
                />
              </div>
              {dobError ? (
                <p className="text-sm text-red-600 mt-1.5">{dobError}</p>
              ) : (
                <p className="text-xs text-secondary-500 mt-1.5">
                  We ask for your date of birth for age safety: it keeps CourtConnect's minimum age enforced, and
                  members under 18 need a parent or guardian's approval before using player matching or chat.
                </p>
              )}
            </div>

            <div>
              <label className="label">Skill Level</label>
              <div className="relative">
                <Trophy className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <select
                  value={skillLevel}
                  onChange={(e) => { setSkillLevel(e.target.value); if (skillError) setSkillError(null); }}
                  className={`input pl-10 appearance-none ${skillError ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
                  aria-invalid={!!skillError}
                >
                  <option value="" disabled>Choose your skill level</option>
                  {SKILL_LEVELS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              {skillError && <p className="text-sm text-red-600 mt-1.5">{skillError}</p>}
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
                CourtConnect is live for Livingston and nearby North Jersey towns.
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
                  onChange={(e) => { setUtrRating(e.target.value); if (utrError) setUtrError(null); }}
                  className={`input pl-10 ${utrError ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
                  placeholder="e.g. 5.5 - leave blank if you don't have one"
                  aria-invalid={!!utrError}
                />
              </div>
              {utrError ? (
                <p className="text-sm text-red-600 mt-1.5">{utrError}</p>
              ) : (
                <p className="text-xs text-secondary-500 mt-1.5">
                  This is what you tell us, not a verified rating - CourtConnect does not verify UTR.
                </p>
              )}
            </div>

            <div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => { setAgreedToTerms(e.target.checked); if (termsError) setTermsError(null); }}
                  className="mt-0.5 rounded border-secondary-300"
                />
                <span className="text-sm text-secondary-600">
                  I agree to the{' '}
                  <Link to="/terms" target={inAppLinkTarget} className="text-primary-600 hover:underline">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" target={inAppLinkTarget} className="text-primary-600 hover:underline">Privacy Policy</Link>.
                </span>
              </label>
              {termsError && <p className="text-sm text-red-600 mt-1.5">{termsError}</p>}
            </div>

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
