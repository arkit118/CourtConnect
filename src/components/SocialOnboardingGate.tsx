import { useEffect, useRef, useState } from 'react';
import { ShieldAlert, Clock, XCircle, Mail, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { SocialEligibilityStatus } from '../hooks/useSocialEligibility';
import { supabase } from '../lib/supabase';
import { CONTACT_EMAIL, MIN_SIGNUP_AGE } from '../lib/legal';

interface Props {
  status: SocialEligibilityStatus;
}

// Renders in place of matching/chat content whenever the signed-in user
// isn't yet eligible. Handles the DOB collection step, the adult
// auto-activation retry, the parent/guardian email step for minors, and
// the pending/declined messages. Never touches public pages - only ever
// rendered by the matching/chat UI itself.
export function SocialOnboardingGate({ status }: Props) {
  const { profile } = useAuth();
  const [retryingParentEmail, setRetryingParentEmail] = useState(false);

  if (status === 'loading') {
    return (
      <div className="card p-12 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto" />
      </div>
    );
  }

  if (status === 'signed_out') {
    return (
      <SafetyCard icon={ShieldAlert} tone="neutral" title="Sign in to use partner matching">
        Partner matching and chat are available to signed-in members. Please sign in or create an account first.
      </SafetyCard>
    );
  }

  if (status === 'banned') {
    return (
      <SafetyCard icon={XCircle} tone="danger" title="Your account is restricted">
        Your account is restricted and cannot use partner matching or chat. Contact{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline font-medium">{CONTACT_EMAIL}</a> if you think this
        is a mistake.
      </SafetyCard>
    );
  }

  if (status === 'needs_legal') {
    return (
      <SafetyCard icon={ShieldAlert} tone="neutral" title="Please accept our Terms and Privacy Policy">
        You need to accept our current Terms of Service and Privacy Policy before using partner matching or chat.
        Try requesting a match or opening a chat and you'll be prompted to review them.
      </SafetyCard>
    );
  }

  if (status === 'needs_age_info') {
    return <DateOfBirthStep />;
  }

  if (status === 'needs_adult_activation') {
    return <AdultActivationStep />;
  }

  if (status === 'needs_parent_email') {
    return <ParentEmailStep />;
  }

  if (status === 'pending_consent') {
    if (retryingParentEmail) {
      return <ParentEmailStep onSubmitted={() => setRetryingParentEmail(false)} />;
    }

    // parent_consent_status flips to 'pending' as soon as the request is
    // recorded, before we know whether the consent email actually sent -
    // sending happens in a separate Edge Function call right after. Only
    // claim the email went out once mark_parent_consent_email_sent() has
    // confirmed that.
    if (profile?.parent_consent_email_sent_at) {
      return (
        <SafetyCard icon={Clock} tone="warning" title="Waiting for parent/guardian approval">
          We've sent your parent or guardian an email asking them to approve partner matching and chat for your
          account. You'll be able to see match candidates and chat once they respond. This does not affect the rest
          of CourtConnect - you can still browse courts, events, and the schedule.
        </SafetyCard>
      );
    }

    return (
      <div className="max-w-lg mx-auto space-y-4">
        <SafetyCard icon={AlertTriangle} tone="warning" title="Parent/guardian approval needed">
          Parent/guardian approval is required before you can use partner matching and chat. We could not send the
          approval email yet. Please try again later or contact CourtConnect support. This does not affect the rest
          of CourtConnect - you can still browse courts, events, and the schedule.
        </SafetyCard>
        <button type="button" onClick={() => setRetryingParentEmail(true)} className="btn-outline w-full">
          Try sending the email again
        </button>
      </div>
    );
  }

  if (status === 'consent_declined') {
    return (
      <SafetyCard icon={XCircle} tone="danger" title="Parent/guardian approval was declined">
        Your parent or guardian declined the request to use partner matching and chat. If you think this was a
        mistake, talk to them directly, or contact{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline font-medium">{CONTACT_EMAIL}</a> with questions.
      </SafetyCard>
    );
  }

  return null;
}

function SafetyCard({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof ShieldAlert;
  tone: 'neutral' | 'warning' | 'danger';
  title: string;
  children: React.ReactNode;
}) {
  const toneClasses = {
    neutral: 'bg-primary-50 border-primary-200 text-primary-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    danger: 'bg-red-50 border-red-200 text-red-800',
  }[tone];

  return (
    <div className={`card p-8 text-center max-w-lg mx-auto border ${toneClasses}`}>
      <Icon className="w-10 h-10 mx-auto mb-4" />
      <h3 className="text-lg font-bold text-secondary-900 mb-2">{title}</h3>
      <p className="text-sm">{children}</p>
    </div>
  );
}

function DateOfBirthStep() {
  const { refreshProfile } = useAuth();
  const { addToast } = useToastStore();
  const [dob, setDob] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!dob) {
      setError('Please enter your date of birth.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('set_social_age_band', { p_date_of_birth: dob });
      if (rpcError) throw rpcError;

      if (data?.ok === false && data?.reason === 'under_13') {
        setBlocked(true);
        return;
      }

      await refreshProfile();
    } catch (err: any) {
      console.error('Error setting date of birth for matching:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      addToast({ type: 'error', message: err.message || 'Failed to save date of birth' });
    } finally {
      setSubmitting(false);
    }
  };

  if (blocked) {
    return (
      <SafetyCard icon={XCircle} tone="danger" title="You must be at least 13 to use CourtConnect">
        Partner matching and chat, like the rest of CourtConnect, require you to be at least 13 years old.
      </SafetyCard>
    );
  }

  return (
    <div className="card p-8 max-w-md mx-auto">
      <h3 className="text-lg font-bold text-secondary-900 mb-2">One quick step before matching</h3>
      <p className="text-sm text-secondary-600 mb-6">
        To keep matching and chat safe, we need your date of birth. Minors are only ever matched with other minors.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Date of Birth</label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="input"
            required
          />
          <p className="text-xs text-secondary-500 mt-1.5">You must be at least {MIN_SIGNUP_AGE} to use CourtConnect.</p>
        </div>
        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}

function AdultActivationStep() {
  const { profile, refreshProfile } = useAuth();
  const { addToast } = useToastStore();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current || !profile?.date_of_birth) return;
    attempted.current = true;

    (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('set_social_age_band', {
          p_date_of_birth: profile.date_of_birth,
        });
        if (rpcError) throw rpcError;
        if (data?.ok) {
          await refreshProfile();
        }
      } catch (err: any) {
        console.error('Error activating adult social access:', err);
        setError(err.message || 'Something went wrong enabling matching for your account.');
        addToast({ type: 'error', message: err.message || 'Failed to enable matching' });
      }
    })();
  }, [profile?.date_of_birth, refreshProfile, addToast]);

  if (error) {
    return (
      <SafetyCard icon={AlertTriangle} tone="danger" title="Couldn't enable matching">
        {error} Please refresh the page to try again, or contact{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline font-medium">{CONTACT_EMAIL}</a>.
      </SafetyCard>
    );
  }

  return (
    <div className="card p-12 text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto mb-4" />
      <p className="text-secondary-600">Setting up matching for your account...</p>
    </div>
  );
}

function ParentEmailStep({ onSubmitted }: { onSubmitted?: () => void } = {}) {
  const { profile, refreshProfile } = useAuth();
  const { addToast } = useToastStore();
  const [parentEmail, setParentEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEmailWarning(null);

    if (!parentEmail.trim()) {
      setError('Please enter a parent or guardian email address.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('request_parent_consent', {
        p_parent_email: parentEmail.trim(),
      });
      if (rpcError) throw rpcError;
      if (!data?.ok || !data?.token) {
        throw new Error('Could not start the parent/guardian approval request.');
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      try {
        const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-parent-consent-email', {
          body: { token: data.token, parentEmail: parentEmail.trim(), childName: profile?.name || 'Your child' },
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });

        if (emailError || emailResult?.ok === false) {
          console.error('Error sending parent consent email:', emailError || emailResult);
          setEmailWarning(
            emailResult?.configured === false
              ? 'Your request was saved, but the consent email could not be sent yet because email sending is not configured. Contact support to complete this step.'
              : 'Your request was saved, but we could not send the consent email. Please contact support.'
          );
        } else {
          // Only record the email as sent once the Edge Function has
          // actually confirmed it - this is what SocialOnboardingGate's
          // pending_consent view checks before it's allowed to tell the
          // user "we've sent your parent an email."
          const { error: markError } = await supabase.rpc('mark_parent_consent_email_sent');
          if (markError) console.error('Error marking parent consent email as sent:', markError);
        }
      } catch (emailErr: any) {
        console.error('Error invoking send-parent-consent-email:', emailErr);
        setEmailWarning('Your request was saved, but we could not send the consent email. Please contact support.');
      }

      await refreshProfile();
      addToast({ type: 'success', message: 'Parent/guardian approval requested.' });
      onSubmitted?.();
    } catch (err: any) {
      console.error('Error requesting parent consent:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      addToast({ type: 'error', message: err.message || 'Failed to request parent/guardian approval' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card p-8 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-3">
        <Mail className="w-6 h-6 text-primary-600" />
        <h3 className="text-lg font-bold text-secondary-900">Parent/guardian approval needed</h3>
      </div>
      <p className="text-sm text-secondary-600 mb-6">
        Because you're under 18, a parent or guardian needs to approve partner matching and chat. We'll send them an
        email explaining what CourtConnect is and what they're approving - they don't need to create an account.
        You'll only ever be matched with other minors, never adults.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Parent/Guardian Email</label>
          <input
            type="email"
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
            className="input"
            placeholder="parent@example.com"
            required
          />
        </div>
        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}
        {emailWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">{emailWarning}</div>
        )}
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Sending request...' : 'Request Parent/Guardian Approval'}
        </button>
      </form>
    </div>
  );
}
