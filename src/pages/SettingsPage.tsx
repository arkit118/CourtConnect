import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldAlert, Trash2, User, X, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { CONTACT_EMAIL } from '../lib/legal';
import { validateNewPassword, MIN_PASSWORD_LENGTH } from '../lib/validation';
import { classifyAuthError, NETWORK_ERROR_MESSAGE, RATE_LIMITED_MESSAGE } from '../lib/authErrors';

const DELETE_CONFIRMATION_WORD = 'DELETE';

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { deleteAccount, signOut } = useAuth();
  const { addToast } = useToastStore();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = confirmText === DELETE_CONFIRMATION_WORD;

  const handleConfirm = async () => {
    if (!canConfirm || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      // Account (and every row that referenced it) is already gone
      // server-side at this point - sign out locally so the app doesn't
      // keep holding a session for a user that no longer exists, then
      // send them to the sign-in page, same as the task's "return to
      // auth page on success" requirement.
      try {
        await signOut();
      } catch (signOutErr) {
        // The account is already deleted regardless of whether this
        // particular sign-out call succeeds - never block on it.
        console.error('Error signing out after account deletion:', signOutErr);
      }
      addToast({ type: 'success', message: 'Your account has been deleted.' });
      navigate('/auth/login', { replace: true });
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setError(err.message || 'Could not delete your account. Please try again.');
      addToast({ type: 'error', message: err.message || 'Could not delete your account. Please try again.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !deleting && onClose()} />
      <div className="relative bg-white rounded-2xl shadow-elevated w-full max-w-md p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-secondary-900">Delete your account?</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="p-1.5 rounded-lg hover:bg-secondary-100 disabled:opacity-50"
          >
            <X className="w-5 h-5 text-secondary-500" />
          </button>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">
            This permanently deletes your profile, bookings, event registrations, gear listings, match requests,
            and chat messages. This cannot be undone.
          </p>
        </div>

        <label className="label">
          Type <span className="font-mono font-bold">{DELETE_CONFIRMATION_WORD}</span> to confirm
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="input mb-4"
          placeholder={DELETE_CONFIRMATION_WORD}
          autoFocus
          disabled={deleting}
        />

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 mb-4">{error}</div>}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-ghost flex-1" disabled={deleting}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="btn flex-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            disabled={!canConfirm || deleting}
          >
            {deleting ? 'Deleting...' : 'Permanently Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

const fieldErrorClass = 'border-red-300 focus:border-red-400 focus:ring-red-100';

// Settings > Password. Uses supabase.auth.updateUser via AuthContext. If
// the project's "Secure password change" setting requires a recent sign-in,
// Supabase answers reauthentication_needed; we then email a one-time code
// (supabase.auth.reauthenticate) and finish the change with it, instead of
// failing generically.
function ChangePasswordCard() {
  const { user, updatePassword, requestReauthentication } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [codeNote, setCodeNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setPassword('');
    setConfirm('');
    setCode('');
    setNeedsCode(false);
    setCodeNote(null);
  };

  const sendCode = async () => {
    setCodeError(null);
    setCodeNote(null);
    try {
      await requestReauthentication();
      setCodeNote(`We emailed a verification code to ${user?.email}.`);
    } catch (error) {
      const kind = classifyAuthError(error);
      setCodeError(
        kind === 'rate_limited'
          ? 'Please wait a minute before requesting another code.'
          : kind === 'network'
            ? NETWORK_ERROR_MESSAGE
            : "We couldn't send a verification code. Please try again."
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    setFormError(null);
    setCodeError(null);
    const errors = validateNewPassword(password, confirm);
    setPasswordError(errors.passwordError);
    setConfirmError(errors.confirmError);
    if (errors.passwordError || errors.confirmError) return;
    if (needsCode && !code.trim()) {
      setCodeError('Enter the code from your email.');
      return;
    }

    setSaving(true);
    try {
      await updatePassword(password, needsCode ? code.trim() : undefined);
      reset();
      setSuccess(true);
    } catch (error) {
      switch (classifyAuthError(error)) {
        case 'reauthentication_needed':
          setNeedsCode(true);
          await sendCode();
          break;
        case 'invalid_reauthentication_code':
          setCodeError('That code is invalid or has expired. Send a new one and try again.');
          break;
        case 'weak_password':
          setPasswordError('Choose a stronger password - at least 8 characters, mixing letters and numbers.');
          break;
        case 'same_password':
          setPasswordError('Your new password must be different from your current password.');
          break;
        case 'session_missing':
          setFormError('Your session has expired. Please sign out and sign in again, then try again.');
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
      setSaving(false);
    }
  };

  return (
    <div className="card p-6 md:p-8" id="change-password">
      <h2 className="font-semibold text-secondary-900 mb-2 flex items-center gap-2">
        <Lock className="w-5 h-5 text-primary-500" />
        Change Password
      </h2>
      <p className="text-sm text-secondary-600 mb-5">Choose a new password with at least {MIN_PASSWORD_LENGTH} characters.</p>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md" noValidate>
        <input type="email" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
        <div>
          <label className="label" htmlFor="settings-new-password">New password</label>
          <div className="relative">
            <input
              id="settings-new-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setSuccess(false);
                if (passwordError) setPasswordError(null);
              }}
              className={`input pr-10 ${passwordError ? fieldErrorClass : ''}`}
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
          {passwordError && <p className="text-sm text-red-600 mt-1.5" role="alert">{passwordError}</p>}
        </div>

        <div>
          <label className="label" htmlFor="settings-confirm-password">Confirm new password</label>
          <input
            id="settings-confirm-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setSuccess(false);
              if (confirmError) setConfirmError(null);
            }}
            className={`input ${confirmError ? fieldErrorClass : ''}`}
            aria-invalid={!!confirmError}
          />
          {confirmError && <p className="text-sm text-red-600 mt-1.5" role="alert">{confirmError}</p>}
        </div>

        {needsCode && (
          <div>
            <label className="label" htmlFor="settings-reauth-code">Verification code</label>
            <p className="text-sm text-secondary-600 mb-2">
              For your security, confirm it's you with the code we emailed to {user?.email}.
            </p>
            <input
              id="settings-reauth-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (codeError) setCodeError(null);
              }}
              className={`input ${codeError ? fieldErrorClass : ''}`}
              aria-invalid={!!codeError}
            />
            {codeError && <p className="text-sm text-red-600 mt-1.5" role="alert">{codeError}</p>}
            {codeNote && !codeError && <p className="text-sm text-secondary-500 mt-1.5">{codeNote}</p>}
            <button type="button" onClick={sendCode} className="text-sm font-semibold text-primary-600 mt-2">
              Send a new code
            </button>
          </div>
        )}

        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700" role="alert">{formError}</div>
        )}
        {success && (
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 text-sm text-primary-800 flex items-center gap-2" role="status">
            <CheckCircle className="w-4 h-4 shrink-0" />
            Password updated successfully.
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}

export function SettingsPage() {
  const { user, profile } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-custom max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-secondary-900">Settings</h1>
          <p className="text-secondary-600 mt-1">Manage your account, safety, and legal preferences.</p>
        </div>

        <div className="card p-6 md:p-8">
          <h2 className="font-semibold text-secondary-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-primary-500" />
            Profile
          </h2>
          <p className="text-sm text-secondary-600 mb-4">
            Signed in as <strong>{profile?.name || user?.email}</strong> ({user?.email}).
          </p>
          <Link to="/profile/edit" className="btn-outline">
            Edit Profile
          </Link>
        </div>

        <div className="card p-6 md:p-8">
          <h2 className="font-semibold text-secondary-900 mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary-500" />
            Safety &amp; Legal
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link to="/safety" className="btn-outline">Safety</Link>
            <Link to="/community-guidelines" className="btn-outline">Community Guidelines</Link>
            <Link to="/terms" className="btn-outline">Terms of Service</Link>
            <Link to="/privacy" className="btn-outline">Privacy Policy</Link>
          </div>
          <p className="text-sm text-secondary-500 mt-4">
            Need help, or have a safety concern that isn't tied to a specific person or listing? Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 hover:underline">{CONTACT_EMAIL}</a>.
          </p>
        </div>

        <ChangePasswordCard />

        <div className="card p-6 md:p-8 border-red-200">
          <h2 className="font-semibold text-secondary-900 mb-2 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            Account
          </h2>
          <p className="text-sm text-secondary-600 mb-4">
            Permanently delete your CourtConnect account and all of your data. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="btn bg-red-600 text-white hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4" />
            Delete Account
          </button>
        </div>
      </div>

      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}
    </div>
  );
}
