import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ShieldCheck, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import { CONTACT_EMAIL } from '../lib/legal';

type ConsentInfo = { childName: string; decision: string | null };

export function ParentalConsentPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<ConsentInfo | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [result, setResult] = useState<'approved' | 'declined' | null>(null);

  useEffect(() => {
    if (!token) {
      setError('This link is missing a required code. Please use the link from the email you received.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data, error: rpcError } = await withTimeout(
          supabase.rpc('get_consent_request_info', { p_token: token }),
          15000,
          'Loading this request timed out. Please try refreshing.'
        );
        if (cancelled) return;
        if (rpcError) throw rpcError;

        if (!data?.ok) {
          setError('This approval link is invalid or has expired. Please ask your child to send a new request.');
          return;
        }

        setInfo({ childName: data.child_name, decision: data.decision });
        if (data.decision === 'approved' || data.decision === 'declined') {
          setResult(data.decision);
        }
      } catch (err: any) {
        console.error('Error loading parental consent request:', err);
        if (!cancelled) setError(err.message || 'Something went wrong loading this request.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleDecision = async (decision: 'approved' | 'declined') => {
    if (!token) return;
    setDeciding(true);
    setError(null);
    try {
      const { data, error: rpcError } = await withTimeout(
        supabase.rpc('resolve_parent_consent', { p_token: token, p_decision: decision }),
        15000,
        'Saving your decision timed out. Please try again.'
      );
      if (rpcError) throw rpcError;
      if (!data?.ok) {
        setError('This approval link is invalid or has expired.');
        return;
      }
      setResult(data.decision);
    } catch (err: any) {
      console.error('Error resolving parental consent:', err);
      setError(err.message || 'Something went wrong saving your decision. Please try again.');
    } finally {
      setDeciding(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
      <div className="w-full max-w-lg">
        <div className="card p-8">
          <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-secondary-900 mb-2">Parent/Guardian Approval</h1>

          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-8 h-8 text-primary-500 animate-spin mx-auto" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : result ? (
            <div
              className={`rounded-xl p-4 text-sm ${
                result === 'approved'
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-secondary-50 border border-secondary-200 text-secondary-700'
              }`}
            >
              {result === 'approved' ? (
                <p>
                  Thank you. You've approved player matching and chat for {info?.childName || 'this account'}. They
                  can now see match candidates and chat, always with other minors only, never adults.
                </p>
              ) : (
                <p>
                  You've declined player matching and chat for {info?.childName || 'this account'}. They will not be
                  able to use these features. The rest of CourtConnect (courts, events, schedule) is unaffected.
                </p>
              )}
              <p className="mt-3 text-xs">
                Questions? Contact{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline font-medium">{CONTACT_EMAIL}</a>.
              </p>
            </div>
          ) : (
            <>
              <p className="text-secondary-600 mb-4">
                <strong>{info?.childName}</strong> has a CourtConnect account and would like to use player matching
                and in-app chat with other members.
              </p>
              <div className="bg-secondary-50 rounded-xl p-4 mb-6 text-sm text-secondary-700 space-y-2">
                <p>Here's what you're approving:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Minors are only ever matched with other minors - never with adults.</li>
                  <li>CourtConnect does not officially reserve courts.</li>
                  <li>CourtConnect does not process any payments.</li>
                  <li>In-person meetups should happen at public courts, ideally with your awareness or supervision.</li>
                  <li>Your child can report or block anyone, and CourtConnect can ban users for unsafe behavior.</li>
                </ul>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleDecision('declined')}
                  className="btn-outline flex-1"
                  disabled={deciding}
                >
                  <X className="w-4 h-4" /> Decline
                </button>
                <button
                  type="button"
                  onClick={() => handleDecision('approved')}
                  className="btn-primary flex-1"
                  disabled={deciding}
                >
                  <Check className="w-4 h-4" /> {deciding ? 'Saving...' : 'Approve'}
                </button>
              </div>
            </>
          )}

          <p className="text-xs text-secondary-400 mt-6 text-center">
            <Link to="/safety" className="hover:underline">CourtConnect Safety</Link>,{' '}
            <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
