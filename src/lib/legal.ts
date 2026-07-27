import { Profile } from './supabase';

export const CURRENT_TOS_VERSION = 'v1';
export const CURRENT_PRIVACY_VERSION = 'v1';
export const CONTACT_EMAIL = 'courtconnect.contact@gmail.com';
export const MIN_SIGNUP_AGE = 13;

export function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function ageBandForAge(age: number): 'minor' | 'adult' {
  return age < 18 ? 'minor' : 'adult';
}

export function hasAcceptedCurrentTerms(profile: Pick<Profile, 'tos_accepted_at' | 'tos_version' | 'privacy_accepted_at' | 'privacy_version'> | null): boolean {
  if (!profile) return false;
  return (
    !!profile.tos_accepted_at &&
    profile.tos_version === CURRENT_TOS_VERSION &&
    !!profile.privacy_accepted_at &&
    profile.privacy_version === CURRENT_PRIVACY_VERSION
  );
}
