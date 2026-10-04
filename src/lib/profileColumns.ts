// Public-facing profile columns - what one member may see about another.
// Never date_of_birth, age_band, parent_consent_*, ban details, or role.
// Matches the column list returned by get_player_profile() (026).
export const PUBLIC_PROFILE_COLUMNS =
  'id, name, avatar_url, home_town, skill_level, utr_rating, preferred_play_style, availability, favorite_courts, years_playing, bio, created_at';

// For embedding another member as a seller/organizer/attendee/commenter.
// is_banned is included only so listings from banned sellers can be hidden.
export const EMBEDDED_PROFILE_COLUMNS = 'id, name, avatar_url, home_town, skill_level, is_banned';

// PostgREST's "function not found" - an RPC whose migration hasn't been
// applied in this environment yet.
export function isMissingFunctionError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    /could not find the function/i.test(error.message ?? '')
  );
}
