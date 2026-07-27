import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, Calendar } from 'lucide-react';
import { calculateAge, ageBandForAge, MIN_SIGNUP_AGE } from '../lib/legal';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();
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

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to sign in with Google' });
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-secondary-600 hover:text-secondary-900 mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div className="card p-8">
          <h1 className="text-2xl font-bold text-secondary-900 mb-2">Welcome back</h1>
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

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-secondary-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-sm text-secondary-500">Or continue with</span>
            </div>
          </div>

          <button onClick={handleGoogleSignIn} className="btn-outline w-full">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.28v2.69h3.57c2.08-1.92 3.28-4.74 3.28-7.98z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.69c-1.01.68-2.3 1.08-3.71 1.08-2.86 0-5.3-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.68-.34-1.4-.34-2.13s.12-1.45.34-2.09V7.03H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.97l2.95-2.35 1.71-2.53z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.03l3.66 2.84c.86-2.6 3.3-4.49 6.16-4.49z" />
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-secondary-600 mt-8">
            Don't have an account?{' '}
            <Link to="/auth/signup" className="text-primary-600 font-semibold hover:text-primary-700">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToastStore();

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

    if (!agreedToTerms) {
      setFormError('Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, name, {
        date_of_birth: dateOfBirth,
        age_band: ageBandForAge(age),
      });
      addToast({ type: 'success', message: 'Account created! You can now log in.' });
      navigate('/auth/login');
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to create account' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to sign in with Google' });
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-secondary-600 hover:text-secondary-900 mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div className="card p-8">
          <h1 className="text-2xl font-bold text-secondary-900 mb-2">Create your account</h1>
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
              <p className="text-xs text-secondary-500 mt-1.5">You must be at least 13 to use CourtConnect.</p>
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
                <Link to="/terms" target="_blank" className="text-primary-600 hover:underline">Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" target="_blank" className="text-primary-600 hover:underline">Privacy Policy</Link>.
              </span>
            </label>

            <p className="text-xs text-secondary-500">
              CourtConnect is for community coordination only &mdash; it does not officially reserve courts or process
              gear payments. Minors should use CourtConnect with a parent or guardian's knowledge. See our{' '}
              <Link to="/safety" target="_blank" className="text-primary-600 hover:underline">Safety page</Link>.
            </p>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-secondary-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-sm text-secondary-500">Or continue with</span>
            </div>
          </div>

          <button onClick={handleGoogleSignIn} className="btn-outline w-full">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.28v2.69h3.57c2.08-1.92 3.28-4.74 3.28-7.98z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.69c-1.01.68-2.3 1.08-3.71 1.08-2.86 0-5.3-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.68-.34-1.4-.34-2.13s.12-1.45.34-2.09V7.03H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.97l2.95-2.35 1.71-2.53z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.03l3.66 2.84c.86-2.6 3.3-4.49 6.16-4.49z" />
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-secondary-600 mt-8">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-primary-600 font-semibold hover:text-primary-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
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
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="card p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold text-secondary-900 mb-2">Check your email</h1>
            <p className="text-secondary-600 mb-8">
              We've sent password reset instructions to <strong>{email}</strong>
            </p>
            <Link to="/auth/login" className="btn-primary w-full">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <Link to="/auth/login" className="inline-flex items-center gap-2 text-secondary-600 hover:text-secondary-900 mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>

        <div className="card p-8">
          <h1 className="text-2xl font-bold text-secondary-900 mb-2">Reset your password</h1>
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
        </div>
      </div>
    </div>
  );
}
