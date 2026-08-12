import { useEffect, useRef, useState } from 'react';
import { ShieldAlert, Clock, XCircle, Mail, AlertTriangle, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { useLegalGateStore } from '../hooks/useLegalGate';
import { SocialEligibilityStatus } from '../hooks/useSocialEligibility';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import { CONTACT_EMAIL, MIN_SIGNUP_AGE } from '../lib/legal';
import { SKILL_LEVELS, UTR_MIN, UTR_MAX, isValidUtr } from '../lib/skillLevel';

interface Props {
  status: SocialEligibilityStatus;
}

// Renders in place of matching/chat content whenever the signed-in user
// isn't yet eligible. Handles the DOB collection step, the adult
// auto-activation retry, the parent/guardian email step for minors, and
// the pending/declined messages. Never touches public pages - only ever
// rendered by the matching/chat UI itself.
export function SocialOnboardingGate({ status }: Props) {
  if (status === 'loading') {
    return (
      <div className="card p-12 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto" />
      </div>
    );
  }

  if (status === 'signed_out') {
    return (
      <SafetyCard icon={ShieldAlert} tone="neutral" title="Sign in to use player matching">
        Player matching and chat are available to signed-in members. Please sign in or create an account first.
      </SafetyCard>
    );
  }

  if (status === 'banned') {
    return (
      <SafetyCard icon={XCircle} tone="danger" title="Your account is restricted">
        Your account is restricted and cannot use player matching or chat. Contact{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline font-medium">{CONTACT_EMAIL}</a> if you think this
        is a mistake.
      </SafetyCard>
    );
  }

  if (status === 'needs_email_verification') {
    return <EmailVerificationStep />;
  }

  if (status === 'needs_legal') {
    return <NeedsLegalStep />;
  }

  if (status === 'needs_age_info') {
    return <DateOfBirthStep />;
  }

  if (status === 'needs_adult_activation') {
    return <AdultActivationStep />;
  }

  // Both statuses render the same ParentConsentFlow component instance
  // (see its header comment for why this matters): request_parent_consent
  // flips profile.parent_consent_status to 'pending' server-side as soon
  // as the request is saved, *before* the app knows whether the consent
  // email itself sent - so a profile refresh can flip status from
  // needs_parent_email to pending_consent while a send is still in
  // flight or just failed. If these were two different component types,
  // React would unmount/remount across that transition and silently
  // discard any in-progress failure/retry state.
  if (status === 'needs_parent_email' || status === 'pending_consent') {
    return <ParentConsentFlow />;
  }

  if (status === 'consent_declined') {
    return (
      <SafetyCard icon={XCircle} tone="danger" title="Parent/guardian approval was declined">
        Your parent or guardian declined the request to use player matching and chat. If you think this was a
        mistake, talk to them directly, or contact{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline font-medium">{CONTACT_EMAIL}</a> with questions.
      </SafetyCard>
    );
  }

  if (status === 'needs_skill_level') {
    return <SkillLevelStep />;
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

// Direct action, not a hint to "go trigger some other flow" - a signed-in
// user landing here has no other obvious way to find the Terms/Privacy
// re-acceptance prompt, so this button opens LegalGateModal immediately via
// the same shared store useActionGate uses.
function NeedsLegalStep() {
  const requestLegalAcceptance = useLegalGateStore((s) => s.request);
  const [submitting, setSubmitting] = useState(false);

  const handleReview = async () => {
    setSubmitting(true);
    try {
      await requestLegalAcceptance();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card p-8 text-center max-w-lg mx-auto border bg-primary-50 border-primary-200">
      <ShieldAlert className="w-10 h-10 mx-auto mb-4 text-primary-800" />
      <h3 className="text-lg font-bold text-secondary-900 mb-2">Please accept our Terms and Privacy Policy</h3>
      <p className="text-sm text-primary-800 mb-6">
        You need to accept our current Terms of Service and Privacy Policy before using player matching or chat.
      </p>
      <button type="button" className="btn-primary" onClick={handleReview} disabled={submitting}>
        {submitting ? 'Opening...' : 'Review and Accept Terms'}
      </button>
    </div>
  );
}

// Defense-in-depth (see useSocialEligibility.ts's comment on this status) -
// normal password sign-in already refuses an unconfirmed account before a
// session ever exists, so this mostly covers edge cases: a stale session
// from before "Confirm email" was turned on, or a future auth flow.
function EmailVerificationStep() {
  const { user, resendVerificationEmail } = useAuth();
  const { addToast } = useToastStore();
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!user?.email) return;
    setResending(true);
    try {
      await resendVerificationEmail(user.email);
      addToast({ type: 'success', message: 'Verification email sent - check your inbox.' });
    } catch (err: any) {
      console.error('Error resending verification email:', err);
      addToast({ type: 'error', message: err.message || 'Failed to resend verification email' });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="card p-8 text-center max-w-lg mx-auto border bg-primary-50 border-primary-200">
      <Mail className="w-10 h-10 mx-auto mb-4 text-primary-800" />
      <h3 className="text-lg font-bold text-secondary-900 mb-2">Please verify your email</h3>
      <p className="text-sm text-primary-800 mb-6">
        Please verify your email before using player matching or chat. Check your inbox for a verification link.
      </p>
      <button type="button" className="btn-primary" onClick={handleResend} disabled={resending}>
        {resending ? 'Sending...' : 'Resend Verification Email'}
      </button>
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
      const { data, error: rpcError } = await withTimeout(
        supabase.rpc('set_social_age_band', { p_date_of_birth: dob }),
        15000,
        'Saving your date of birth timed out. Please try again.'
      );
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
        Player matching and chat, like the rest of CourtConnect, require you to be at least 13 years old.
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

// skill_level/utr_rating aren't protected by protect_sensitive_profile_columns
// (see the 019 migration), so this saves with a plain .update() rather than a
// SECURITY DEFINER RPC - consistent with how ProfilePage's inline edit saves
// the same two fields.
function SkillLevelStep() {
  const { user, refreshProfile } = useAuth();
  const { addToast } = useToastStore();
  const [skillLevel, setSkillLevel] = useState('');
  const [utrRating, setUtrRating] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!skillLevel) {
      setError('Please choose your skill level.');
      return;
    }
    if (utrRating.trim() && !isValidUtr(Number(utrRating))) {
      setError(`UTR rating must be between ${UTR_MIN} and ${UTR_MAX}.`);
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          skill_level: skillLevel,
          utr_rating: utrRating.trim() ? Number(utrRating) : null,
        })
        .eq('id', user.id);
      if (updateError) throw updateError;

      await refreshProfile();
    } catch (err: any) {
      console.error('Error saving skill level:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      addToast({ type: 'error', message: err.message || 'Failed to save skill level' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card p-8 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-3">
        <Trophy className="w-6 h-6 text-primary-600" />
        <h3 className="text-lg font-bold text-secondary-900">One quick step before matching</h3>
      </div>
      <p className="text-sm text-secondary-600 mb-6">
        Your skill level helps us suggest hitting partners at your level. You can change this anytime from your
        profile.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Skill Level</label>
          <select
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value)}
            className="input"
            required
          >
            <option value="" disabled>Choose your skill level</option>
            {SKILL_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Self-Reported UTR Rating (Optional)</label>
          <input
            type="number"
            value={utrRating}
            onChange={(e) => setUtrRating(e.target.value)}
            min={UTR_MIN}
            max={UTR_MAX}
            step="0.1"
            className="input"
            placeholder="e.g. 5.5 - leave blank if you don't have one"
          />
          <p className="text-xs text-secondary-500 mt-1.5">Self-reported, not verified by CourtConnect.</p>
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
        const { data, error: rpcError } = await withTimeout(
          supabase.rpc('set_social_age_band', { p_date_of_birth: profile.date_of_birth }),
          15000,
          'Enabling matching for your account timed out. Please refresh and try again.'
        );
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

// Invokes the Edge Function and normalizes its outcome into a plain
// ok/message result. Never throws. Shared by the initial request and any
// later retry (both handled by ParentConsentFlow below) so both paths log
// and interpret failures identically.
async function invokeSendConsentEmail(
  token: string,
  parentEmail: string,
  childName: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  try {
    const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-parent-consent-email', {
      body: { token, parentEmail, childName },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });

    if (emailError || emailResult?.ok !== true) {
      console.error('send-parent-consent-email failed', { token, parentEmail, emailError, emailResult });
      const notConfigured = emailResult?.configured === false;
      return {
        ok: false,
        message: notConfigured
          ? 'The consent email could not be sent because email sending is not configured yet on our end. Please contact support.'
          : 'We could not send the consent email. Please check the email address and try again.',
      };
    }

    return { ok: true };
  } catch (err: any) {
    console.error('send-parent-consent-email: invoke threw', { token, parentEmail, err });
    return { ok: false, message: 'We could not send the consent email. Please check the email address and try again.' };
  }
}

// Exact copy required for the "we actually confirmed Resend accepted it"
// case - distinct from the generic RPC-failure toast below, which covers
// the (much rarer) case where request_parent_consent itself didn't even
// save.
const CONSENT_EMAIL_SENT_MESSAGE =
  'Parent consent email sent. Ask your parent or guardian to check their inbox and spam folder.';

// Handles the full parent/guardian consent lifecycle - the initial
// request form, a failed-send with retry, and the "waiting for a
// decision" card - as ONE component, rendered for both the
// needs_parent_email and pending_consent eligibility statuses (see
// SocialOnboardingGate's dispatch above). This used to be two separate
// components (ParentEmailStep / PendingConsentStep) swapped based on
// status, but request_parent_consent() sets profile.parent_consent_status
// = 'pending' the moment the *request* is saved - before the app has any
// idea whether the follow-up consent email actually sent. Any profile
// refresh in that window (including the deliberately-non-blocking silent
// background sync below) would flip status from needs_parent_email to
// pending_consent while a send was still in flight or had just failed,
// and with two separate component types React would unmount the one
// showing the failure/retry UI and mount a fresh, blank one in its
// place - silently discarding the exact error the user was looking at.
// One component instance persisting across both statuses (same function
// reference at the same position in SocialOnboardingGate's returned
// tree) means React updates it in place instead, so local state
// (emailFailure, retrying, the typed-in email) survives regardless of
// when the background profile sync lands.
function ParentConsentFlow() {
  const { profile, setProfileFields, refreshProfile } = useAuth();
  const { addToast } = useToastStore();
  const [parentEmail, setParentEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFailure, setEmailFailure] = useState<{ token: string; parentEmail: string; message: string } | null>(null);
  const [retrying, setRetrying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEmailFailure(null);

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

      // The RPC above is SECURITY DEFINER and already committed this
      // server-side (see request_parent_consent in
      // 20260802000001_017_parent_consent_email_tracking.sql) - reflect it
      // in the local cache immediately rather than waiting on a follow-up
      // network fetch just to unblock the UI. This is a local merge only,
      // not a database write.
      setProfileFields({
        parent_consent_status: 'pending',
        parent_consent_requested_at: new Date().toISOString(),
        parent_consent_decided_at: null,
        parent_consent_decision: null,
        parent_consent_email_sent_at: null,
      });

      const childName = profile?.name || 'Your child';
      const result = await invokeSendConsentEmail(data.token, parentEmail.trim(), childName);

      // Only ever tell the user the email was sent when it actually was.
      // The request row itself is always saved by this point regardless
      // (that's the RPC above, already succeeded) - but "we emailed your
      // parent" and "we saved your request" are two different facts, and
      // conflating them (showing a success toast even when the email
      // failed) is exactly the bug this fixes.
      if (result.ok) {
        setProfileFields({ parent_consent_email_sent_at: new Date().toISOString() });
        addToast({ type: 'success', message: CONSENT_EMAIL_SENT_MESSAGE });
      } else {
        setEmailFailure({ token: data.token, parentEmail: parentEmail.trim(), message: result.message });
      }

      // Best-effort background sync with the database, purely to catch up
      // any field this component doesn't already know (or a mark_parent_
      // consent_email_sent write that failed independently of the email
      // send - see the Edge Function's comment on that). silent: true
      // means a slow/failed refetch here is only ever logged, never shown
      // as the app-wide "could not load your profile" banner - the whole
      // point of this fix (see AuthContext.fetchProfile's comment).
      void refreshProfile({ silent: true });
    } catch (err: any) {
      console.error('Error requesting parent consent:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      addToast({ type: 'error', message: err.message || 'Failed to request parent/guardian approval' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async () => {
    if (!emailFailure) return;
    setRetrying(true);
    const childName = profile?.name || 'Your child';
    const result = await invokeSendConsentEmail(emailFailure.token, emailFailure.parentEmail, childName);
    setRetrying(false);

    if (result.ok) {
      setEmailFailure(null);
      setProfileFields({ parent_consent_email_sent_at: new Date().toISOString() });
      addToast({ type: 'success', message: CONSENT_EMAIL_SENT_MESSAGE });
      void refreshProfile({ silent: true });
    } else {
      setEmailFailure({ ...emailFailure, message: result.message });
    }
  };

  if (emailFailure) {
    return (
      <div className="card p-8 max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-bold text-secondary-900">Couldn't send the consent email</h3>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 mb-4">
          {emailFailure.message}
        </div>
        <p className="text-sm text-secondary-600 mb-6">
          Your request was saved, but the email to <strong>{emailFailure.parentEmail}</strong> hasn't gone out yet.
          You can try sending it again.
        </p>
        <button type="button" className="btn-primary w-full" onClick={handleRetry} disabled={retrying}>
          {retrying ? 'Retrying...' : 'Retry Sending Email'}
        </button>
        <button
          type="button"
          className="text-sm text-secondary-500 underline w-full text-center mt-4"
          onClick={() => setEmailFailure(null)}
        >
          Use a different email address instead
        </button>
      </div>
    );
  }

  // profile.parent_consent_email_sent_at (set only by the Edge Function,
  // only after Resend confirms success - see the 017 migration) is the
  // durable signal that the email genuinely went out, distinct from
  // parent_consent_status = 'pending' alone (which only means the
  // *request* was saved - see this component's header comment). Without
  // this check, a failed/never-attempted send would still land here
  // showing "we've sent your parent an email" with no way to retry.
  if (profile?.parent_consent_email_sent_at) {
    return (
      <SafetyCard icon={Clock} tone="warning" title="Waiting for parent/guardian approval">
        We've sent your parent or guardian an email asking them to approve player matching and chat for your
        account. You'll be able to see match candidates and chat once they respond. This doesn't affect the rest of
        CourtConnect - you can still browse courts, events, and the schedule.
      </SafetyCard>
    );
  }

  return (
    <div className="card p-8 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-3">
        <Mail className="w-6 h-6 text-primary-600" />
        <h3 className="text-lg font-bold text-secondary-900">Parent/guardian approval needed</h3>
      </div>
      <p className="text-sm text-secondary-600 mb-6">
        Because you're under 18, a parent or guardian needs to approve player matching and chat. We'll send them an
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
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Sending request...' : 'Request Parent/Guardian Approval'}
        </button>
      </form>
    </div>
  );
}

