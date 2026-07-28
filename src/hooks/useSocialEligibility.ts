import { useAuth } from '../contexts/AuthContext';
import { hasAcceptedCurrentTerms } from '../lib/legal';

export type SocialEligibilityStatus =
  | 'loading'
  | 'signed_out'
  | 'banned'
  | 'needs_legal'
  | 'needs_age_info'
  | 'needs_adult_activation'
  | 'needs_parent_email'
  | 'pending_consent'
  | 'consent_declined'
  | 'eligible';

// Central eligibility check for partner matching / chat, used by the
// Partners "Matching" tab, /matches, and the chat page so all three agree
// on what state a user is in. This never blocks public browsing - it is
// only ever consulted by matching/chat UI, not by courts/schedule/events.
export function useSocialEligibility(): SocialEligibilityStatus {
  const { user, profile, loading } = useAuth();

  if (loading) return 'loading';
  if (!user) return 'signed_out';
  if (!profile) return 'loading';
  if (profile.is_banned) return 'banned';
  if (!hasAcceptedCurrentTerms(profile)) return 'needs_legal';
  if (profile.social_features_enabled) return 'eligible';
  if (!profile.date_of_birth || !profile.age_band) return 'needs_age_info';

  if (profile.age_band === 'adult') {
    return 'needs_adult_activation';
  }

  // age_band === 'minor'
  if (profile.parent_consent_status === 'pending') return 'pending_consent';
  if (profile.parent_consent_status === 'declined') return 'consent_declined';
  return 'needs_parent_email';
}
