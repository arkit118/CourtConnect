import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldAlert, Trash2, User, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { CONTACT_EMAIL } from '../lib/legal';

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
