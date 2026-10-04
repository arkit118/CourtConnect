import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Profile } from '../lib/supabase';

// Missing date of birth or skill level is collected by the onboarding
// steps on /players (SocialOnboardingGate - DOB can only be set through
// set_social_age_band, not a plain profile edit); a missing home town is
// a normal profile edit.
function completionRoute(profile: Profile): string | null {
  if (!profile.date_of_birth || !profile.skill_level) return '/players';
  if (!profile.name?.trim() || !profile.home_town?.trim()) return '/profile/edit';
  return null;
}

export function useProfileCta(signedOutLabel: string): { label: string; to: string; signedIn: boolean } {
  const { user, profile } = useAuth();
  if (!user) return { label: signedOutLabel, to: '/auth/signup', signedIn: false };
  // Profile still loading (or failed to load): never send a signed-in user
  // back into signup - their own profile page handles either case.
  if (!profile) return { label: 'View Profile', to: '/profile', signedIn: true };
  const incompleteTo = completionRoute(profile);
  return incompleteTo
    ? { label: 'Complete Profile', to: incompleteTo, signedIn: true }
    : { label: 'View Profile', to: '/profile', signedIn: true };
}

// Signed out: the given label (e.g. "Create Account") -> signup.
// Signed in + complete profile: "View Profile" -> /profile.
// Signed in + incomplete profile: "Complete Profile" -> the step that's missing.
export function ProfileCtaLink({
  signedOutLabel,
  className,
  icon,
}: {
  signedOutLabel: string;
  className?: string;
  icon?: ReactNode;
}) {
  const { label, to } = useProfileCta(signedOutLabel);
  return (
    <Link to={to} className={className}>
      {label}
      {icon}
    </Link>
  );
}
