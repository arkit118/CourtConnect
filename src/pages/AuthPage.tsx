import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, EMAIL_NOT_CONFIRMED_MESSAGE } from '../contexts/AuthContext';
import { initialAuthRedirect } from '../lib/supabase';
import { classifyAuthError, NETWORK_ERROR_MESSAGE, RATE_LIMITED_MESSAGE } from '../lib/authErrors';
import { useToastStore } from '../hooks/useToast';
import { Mail, Lock, User, Eye, EyeOff, Calendar, Trophy, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { calculateAge, ageBandForAge, MIN_SIGNUP_AGE } from '../lib/legal';
import { SKILL_LEVELS, UTR_MIN, UTR_MAX, isValidUtr } from '../lib/skillLevel';
import { isValidEmail, validateNewPassword, MIN_PASSWORD_LENGTH } from '../lib/validation';
import { AuthLayout } from '../components/brand/AuthLayout';
import { inAppLinkTarget } from '../lib/openExternal';

const DEFAULT_SIGNUP_LOCATION = 'Livingston, NJ';

// iOS's keyboard capitalizes the first letter and may autocorrect an
// email address unless told not to - harmless for Supabase (it compares
// case-insensitively) but confusing to look at, and autocorrect can
// genuinely change the address.
const EMAIL_INPUT_PROPS = {
  type: 'email',
  inputMode: 'email',
  autoComplete: 'email',
  autoCapitalize: 'none',
  autoCorrect: 'off',
  spellCheck: false,
} as const;

const fieldErrorClass = 'border-red-300 focus:border-red-400 focus:ring-red-100';

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-red-600 mt-1.5" role="alert">{children}</p>;
}

function FormError({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700" role="alert">
      {children}
    </div>
  );
}

// Email handed between auth screens (e.g. signup's "Sign in" / "Reset
// password" actions) so the user doesn't retype it.
function useHandoffEmail(): string {
  const location = useLocation();
  return ((location.state as { email?: string } | null)?.email ?? '').trim();
}

export function LoginPage() {
  const handoffEmail = useHandoffEmail();
  const [email, setEmail] = useState(handoffEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const { signIn, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToastStore();

  const from = (location.state as any)?.from?.pathname || '/dashboard';
  // An expired/used email link (e.g. signup verification) redirects back
  // with #error_code=... - the app then routes here, so explain it here.
  const linkExpired = !!initialAuthRedirect.linkError && !initialAuthRedirect.isPasswordRecovery;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    setFormError(null);
    setNeedsVerification(false);

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
      await signIn(email, password);
      addToast({ type: 'success', message: 'Welcome back!' });
      navigate(from, { replace: true });
    } catch (error) {
      switch (classifyAuthError(error)) {
        case 'invalid_credentials':
          // Never says which of the two was wrong - that would let this
          // form be used to check whether an email is registered.
          setPasswordError('Email or password is incorrect.');
          break;
        case 'email_not_confirmed':
          setNeedsVerification(true);
          setResendState('idle');
          break;
        case 'rate_limited':
          setFormError(RATE_LIMITED_MESSAGE);
          break;
        case 'network':
          setFormError(NETWORK_ERROR_MESSAGE);
          break;
        default:
          setFormError("We couldn't sign you in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendState('sending');
    try {
      await resendVerificationEmail(email);
      setResendState('sent');
    } catch {
      setResendState('failed');
    }
  };

  return (
    <AuthLayout backTo="/" backLabel="Back to home" tagline="Your local court for Livingston & nearby NJ tennis.">
      <h1 className="font-display text-2xl font-bold text-secondary-900 mb-2">Welcome back</h1>
      <p className="text-secondary-600 mb-8">Sign in to your CourtConnect account</p>

      {linkExpired && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 mb-6" role="status">
          That email link is invalid or has expired. Sign in below, or{' '}
          <Link to="/auth/forgot-password" className="font-semibold underline">reset your password</Link>.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label className="label" htmlFor="login-email">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
            <input
              id="login-email"
              {...EMAIL_INPUT_PROPS}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              className={`input pl-10 ${emailError ? fieldErrorClass : ''}`}
              placeholder="you@example.com"
              aria-invalid={!!emailError}
            />
          </div>
          {emailError && <FieldError>{emailError}</FieldError>}
        </div>

        <div>
          <label className="label" htmlFor="login-password">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              className={`input pl-10 pr-10 ${passwordError ? fieldErrorClass : ''}`}
              placeholder="Enter your password"
              aria-invalid={!!passwordError}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {passwordError && (
            <FieldError>
              {passwordError}{' '}
              <Link to="/auth/forgot-password" state={{ email }} className="font-semibold underline">
                Reset your password
              </Link>
            </FieldError>
          )}
        </div>

        <div className="flex items-center justify-end">
          <Link to="/auth/forgot-password" state={{ email }} className="text-sm text-primary-600 hover:text-primary-700">
            Forgot password?
          </Link>
        </div>

        {needsVerification && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800" role="alert">
            <p className="mb-2">{EMAIL_NOT_CONFIRMED_MESSAGE}</p>
            {resendState === 'sent' ? (
              <p className="font-semibold">Verification email sent.</p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendState === 'sending'}
                className="font-semibold underline disabled:opacity-60"
              >
                {resendState === 'sending' ? 'Sending...' : 'Resend verification email'}
              </button>
            )}
            {resendState === 'failed' && (
              <p className="mt-1">We couldn't resend it just now. Please try again in a minute.</p>
            )}
          </div>
        )}

        {formError && <FormError>{formError}</FormError>}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="text-center text-secondary-600 mt-8">
        Don't have an account?{' '}
        <Link to="/auth/signup" className="text-primary-600 font-semibold hover:text-primary-700">
          Create an account
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
  const [accountExists, setAccountExists] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
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
    setAccountExists(false);
    setFormError(null);
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
    } catch (error) {
      switch (classifyAuthError(error)) {
        case 'account_exists':
          setAccountExists(true);
          break;
        case 'weak_password':
          setPasswordError('Choose a stronger password - at least 8 characters, mixing letters and numbers.');
          break;
        case 'rate_limited':
          setFormError(RATE_LIMITED_MESSAGE);
          break;
        case 'network':
          setFormError(NETWORK_ERROR_MESSAGE);
          break;
        default:
          setFormError("We couldn't create your account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendState('sending');
    try {
      await resendVerificationEmail(email);
      setResendState('sent');
    } catch {
      setResendState('failed');
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
            We sent a verification link to <strong>{email.trim()}</strong>. Open it to verify your account, then sign
            in. Don't see it? Check your spam folder.
          </p>
          {resendState === 'sent' ? (
            <p className="text-sm font-semibold text-primary-700 mb-3" role="status">Verification email sent again.</p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="btn-outline w-full mb-3"
              disabled={resendState === 'sending'}
            >
              {resendState === 'sending' ? 'Sending...' : 'Resend Verification Email'}
            </button>
          )}
          {resendState === 'failed' && (
            <p className="text-sm text-red-600 mb-3" role="alert">
              We couldn't resend it just now. Please wait a minute and try again.
            </p>
          )}
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
                  {...EMAIL_INPUT_PROPS}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                    if (accountExists) setAccountExists(false);
                  }}
                  className={`input pl-10 ${emailError || accountExists ? fieldErrorClass : ''}`}
                  placeholder="you@example.com"
                  aria-invalid={!!emailError || accountExists}
                />
              </div>
              {emailError && <FieldError>{emailError}</FieldError>}
              {accountExists && (
                <div className="mt-1.5 text-sm text-red-600" role="alert">
                  <p>An account already exists with this email. Sign in or reset your password.</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Link to="/auth/login" state={{ email }} className="btn-primary btn-sm">Sign in</Link>
                    <Link to="/auth/forgot-password" state={{ email }} className="btn-outline btn-sm">Reset password</Link>
                  </div>
                </div>
              )}
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
                  autoComplete="new-password"
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

            {formError && <FormError>{formError}</FormError>}

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
  const handoffEmail = useHandoffEmail();
  const [email, setEmail] = useState(handoffEmail);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const { resetPassword } = useAuth();

  const send = async (address: string) => {
    setLoading(true);
    setFormError(null);
    setResendNote(null);
    try {
      await resetPassword(address);
      if (sentTo) setResendNote('Sent again. It can take a minute or two to arrive.');
      setSentTo(address);
    } catch (error) {
      const kind = classifyAuthError(error);
      const message =
        kind === 'rate_limited'
          ? 'Please wait a minute before requesting another link.'
          : kind === 'network'
            ? NETWORK_ERROR_MESSAGE
            : "We couldn't send the reset email. Please try again.";
      if (sentTo) setResendNote(message);
      else setFormError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    if (!email.trim()) {
      setEmailError('Please enter your email address.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      setEmailError('Enter a valid email address.');
      return;
    }
    await send(email.trim());
  };

  if (sentTo) {
    return (
      <AuthLayout backTo="/auth/login" backLabel="Back to sign in" tagline="Almost there - check your inbox.">
        <div className="text-center" role="status">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="font-display text-2xl font-bold text-secondary-900 mb-2">Check your email</h1>
          {/* Worded so it never confirms whether an account exists. */}
          <p className="text-secondary-600 mb-4">
            If an account exists for <strong>{sentTo}</strong>, we sent a password reset link. Open it to choose a new
            password.
          </p>
          {Capacitor.isNativePlatform() && (
            <p className="text-sm text-secondary-500 mb-4">
              The link opens in your browser. After you set a new password there, come back to the app and sign in.
            </p>
          )}
          <p className="text-sm text-secondary-500 mb-6">Don't see it? Check your spam folder.</p>
          <button type="button" onClick={() => send(sentTo)} className="btn-outline w-full mb-3" disabled={loading}>
            {loading ? 'Sending...' : 'Send the link again'}
          </button>
          {resendNote && <p className="text-sm text-secondary-600 mb-3">{resendNote}</p>}
          <Link to="/auth/login" state={{ email: sentTo }} className="btn-primary w-full">
            Back to Sign In
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout backTo="/auth/login" backLabel="Back to sign in" tagline="Forgot your password? No problem.">
      <h1 className="font-display text-2xl font-bold text-secondary-900 mb-2">Reset your password</h1>
      <p className="text-secondary-600 mb-8">Enter your account email and we'll send you a reset link.</p>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label className="label" htmlFor="forgot-email">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
            <input
              id="forgot-email"
              {...EMAIL_INPUT_PROPS}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              className={`input pl-10 ${emailError ? fieldErrorClass : ''}`}
              placeholder="you@example.com"
              aria-invalid={!!emailError}
            />
          </div>
          {emailError && <FieldError>{emailError}</FieldError>}
        </div>

        {formError && <FormError>{formError}</FormError>}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
    </AuthLayout>
  );
}

// Landing page for the password-reset email link. Never renders blank:
// every state (checking the link, invalid/expired link, form, success) has
// its own screen.
export function ResetPasswordPage() {
  const { user, loading, updatePassword, clearPasswordRecovery, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(!!initialAuthRedirect.linkError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errors = validateNewPassword(password, confirm);
    setPasswordError(errors.passwordError);
    setConfirmError(errors.confirmError);
    if (errors.passwordError || errors.confirmError) return;

    setSubmitting(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (error) {
      switch (classifyAuthError(error)) {
        case 'weak_password':
          setPasswordError('Choose a stronger password - at least 8 characters, mixing letters and numbers.');
          break;
        case 'same_password':
          setPasswordError('Your new password must be different from your current password.');
          break;
        case 'session_missing':
          setLinkInvalid(true);
          break;
        case 'rate_limited':
          setFormError(RATE_LIMITED_MESSAGE);
          break;
        case 'network':
          setFormError(NETWORK_ERROR_MESSAGE);
          break;
        default:
          setFormError("We couldn't update your password. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    clearPasswordRecovery();
    try {
      await signOut();
    } catch {
      // Local session is cleared regardless (see AuthContext.signOut).
    }
    navigate('/auth/login', { replace: true });
  };

  if (loading) {
    return (
      <AuthLayout backTo="/auth/login" backLabel="Back to sign in" tagline="Choose a new password.">
        <div className="text-center py-8" role="status">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto mb-4" />
          <p className="text-secondary-600">Checking your reset link...</p>
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout backTo="/" backLabel="Back to home" tagline="You're all set.">
        <div className="text-center" role="status">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="font-display text-2xl font-bold text-secondary-900 mb-2">Password updated</h1>
          <p className="text-secondary-600 mb-4">Your new password is saved and you're signed in.</p>
          <p className="text-sm text-secondary-500 mb-8">
            Using the CourtConnect iPhone app? Open it and sign in with your new password.
          </p>
          <Link to="/dashboard" replace className="btn-primary w-full">
            Continue to CourtConnect
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (linkInvalid || !user) {
    return (
      <AuthLayout backTo="/auth/login" backLabel="Back to sign in" tagline="Let's get you a fresh link.">
        <div className="text-center" role="alert">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="font-display text-2xl font-bold text-secondary-900 mb-2">Link expired</h1>
          <p className="text-secondary-600 mb-8">
            This password reset link is invalid or has expired. Request a new one.
          </p>
          <Link to="/auth/forgot-password" onClick={clearPasswordRecovery} className="btn-primary w-full mb-3">
            Request another link
          </Link>
          <Link to="/auth/login" onClick={clearPasswordRecovery} className="btn-ghost w-full">
            Back to Sign In
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout backTo="/auth/login" backLabel="Back to sign in" tagline="Choose a new password.">
      <h1 className="font-display text-2xl font-bold text-secondary-900 mb-2">Choose a new password</h1>
      <p className="text-secondary-600 mb-8">
        For <strong>{user.email}</strong>. Use at least {MIN_PASSWORD_LENGTH} characters.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Lets password managers associate the new password with the account. */}
        <input type="email" autoComplete="username" value={user.email ?? ''} readOnly hidden />
        <div>
          <label className="label" htmlFor="reset-password">New password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
            <input
              id="reset-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              className={`input pl-10 pr-10 ${passwordError ? fieldErrorClass : ''}`}
              placeholder="New password"
              aria-invalid={!!passwordError}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {passwordError && <FieldError>{passwordError}</FieldError>}
        </div>

        <div>
          <label className="label" htmlFor="reset-confirm">Confirm new password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
            <input
              id="reset-confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (confirmError) setConfirmError(null);
              }}
              className={`input pl-10 ${confirmError ? fieldErrorClass : ''}`}
              placeholder="Re-enter new password"
              aria-invalid={!!confirmError}
            />
          </div>
          {confirmError && <FieldError>{confirmError}</FieldError>}
        </div>

        {formError && <FormError>{formError}</FormError>}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Saving...' : 'Update Password'}
        </button>
        <button type="button" onClick={handleCancel} className="btn-ghost w-full" disabled={submitting}>
          Cancel
        </button>
      </form>
    </AuthLayout>
  );
}
