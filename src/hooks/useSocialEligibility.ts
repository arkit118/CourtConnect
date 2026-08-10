import { useAuth } from '../contexts/AuthContext';
import { hasAcceptedCurrentTerms } from '../lib/legal';

export type SocialEligibilityStatus =
  | 'loading'
  | 'signed_out'
  | 'banned'
  | 'needs_email_verification'
  | 'needs_legal'
  | 'needs_age_info'
  | 'needs_adult_activation'
  | 'needs_parent_email'
  | 'pending_consent'
  | 'consent_declined'
  | 'needs_skill_level'
  | 'eligible';

// Central eligibility check for player matching / chat, used by /players'
// matching branch, /matches, and the chat page so all three agree on what
// state a user is in. This never blocks public browsing - it is only ever
// consulted by matching/chat UI, not by courts/schedule/events.
export function useSocialEligibility(): SocialEligibilityStatus {
  const { user, profile, loading } = useAuth();

  if (loading) return 'loading';
  if (!user) return 'signed_out';
  if (!profile) return 'loading';
  if (profile.is_banned) return 'banned';
  // Standard Supabase sign-in already refuses an unconfirmed account
  // outright (see AuthContext.signIn's email_not_confirmed handling), so
  // this mostly won't be reached through normal password sign-in - it's
  // defense-in-depth for a stale session or a future auth flow, not the
  // primary UX moment. email_confirmed_at is set automatically for OAuth
  // sign-ins too, so Google sign-in is never gated by this.
  if (!user.email_confirmed_at) return 'needs_email_verification';
  if (!hasAcceptedCurrentTerms(profile)) return 'needs_legal';

  if (!profile.social_features_enabled) {
    if (!profile.date_of_birth || !profile.age_band) return 'needs_age_info';

    if (profile.age_band === 'adult') {
      return 'needs_adult_activation';
    }

    // age_band === 'minor'
    if (profile.parent_consent_status === 'pending') return 'pending_consent';
    if (profile.parent_consent_status === 'declined') return 'consent_declined';
    return 'needs_parent_email';
  }

  // Safety/legal/age gates all cleared - one more profile-completeness
  // nudge before matching, for accounts that skipped the signup form's
  // skill-level field entirely (pre-signup-form-update accounts, or
  // Google sign-in, which never collects it - see AuthContext.tsx's
  // fetchOrCreateProfile). Not a safety gate, so it's deliberately last
  // and never blocks anything the checks above already covered.
  if (!profile.skill_level) return 'needs_skill_level';

  return 'eligible';
}
