import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLegalGateStore } from '../hooks/useLegalGate';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import { CURRENT_TOS_VERSION, CURRENT_PRIVACY_VERSION } from '../lib/legal';
import { inAppLinkTarget } from '../lib/openExternal';

// Rendered once near the app root. Shown whenever a signed-in user with a
// missing/outdated Terms or Privacy acceptance attempts an authenticated
// action (see useActionGate). Updates their own profile row via the
// app-side upsert pattern already used elsewhere - no auth trigger involved.
export function LegalGateModal() {
  const isOpen = useLegalGateStore((s) => s.isOpen);
  const resolve = useLegalGateStore((s) => s.resolve);
  const { user, refreshProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAccept = async () => {
    if (!user) {
      resolve(false);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const { error: updateError } = await withTimeout(
        supabase
          .from('profiles')
          .update({
            tos_accepted_at: now,
            tos_version: CURRENT_TOS_VERSION,
            privacy_accepted_at: now,
            privacy_version: CURRENT_PRIVACY_VERSION,
            safety_acknowledged_at: now,
          })
          .eq('id', user.id),
        15000,
        'Saving your acceptance timed out. Please try again.'
      );

      if (updateError) throw updateError;
      await refreshProfile();
      resolve(true);
    } catch (err: any) {
      setError(err.message || 'Failed to save your acceptance. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = () => {
    if (submitting) return;
    resolve(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-elevated w-full max-w-md p-6 animate-scale-in">
        <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6 text-primary-600" />
        </div>
        <h3 className="text-xl font-bold text-secondary-900 mb-2">Please review our Terms</h3>
        <p className="text-secondary-600 mb-4">
          Before continuing, please confirm you agree to our{' '}
          <Link to="/terms" target={inAppLinkTarget} className="text-primary-600 hover:underline">Terms of Service</Link>{' '}
          and{' '}
          <Link to="/privacy" target={inAppLinkTarget} className="text-primary-600 hover:underline">Privacy Policy</Link>.
        </p>
        <p className="text-xs text-secondary-500 mb-6">
          Reminder: CourtConnect does not officially reserve courts or process gear payments. See our{' '}
          <Link to="/safety" target={inAppLinkTarget} className="text-primary-600 hover:underline">Safety page</Link> for more.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={handleDecline} className="btn-ghost flex-1" disabled={submitting}>
            Not now
          </button>
          <button type="button" onClick={handleAccept} className="btn-primary flex-1" disabled={submitting}>
            {submitting ? 'Saving...' : 'I Agree, Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
