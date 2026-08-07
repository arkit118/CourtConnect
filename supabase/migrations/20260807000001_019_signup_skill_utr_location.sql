/*
# Professional polish - collect skill level, UTR, and location at signup
  instead of silently defaulting to 'beginner'

## The problem this fixes
upsert_signup_profile() (016) hardcoded skill_level = 'beginner' in its
INSERT VALUES list for every single signup - there was no way for a new
user to choose their real skill level during account creation, and no
column-level DEFAULT on profiles.skill_level either (that column has
always allowed NULL - see 001_full_schema.sql's plain `TEXT CHECK (...)`
declaration, no DEFAULT clause). AuthContext.tsx's fetchOrCreateProfile
fallback insert (the minimal-profile path used for e.g. first Google
sign-in) had the same 'beginner' default. Both are being changed
app-side in this same change (AuthContext.tsx, AuthPage.tsx) to stop
asserting a skill level the user never actually chose.

home_town and utr_rating were likewise never collected at signup (both
columns already existed - see 001/006 - just never written until a user
later visited /profile/edit).

## What this migration does
Re-declares upsert_signup_profile() with three new, backward-compatible
trailing parameters (all DEFAULT-ed, so any existing caller passing only
the original 3 positional/named args still works unchanged):
  - p_skill_level TEXT DEFAULT NULL - validated against the exact same
    enum profiles.skill_level's own CHECK constraint already enforces
    ('beginner'/'intermediate'/'advanced'/'varsity'/'elite'), so a bad
    value is rejected here with a friendly error rather than falling
    through to a raw constraint-violation message. NULL is allowed
    through (rather than defaulting to 'beginner') for any caller that
    genuinely doesn't have a skill level yet - the app's signup FORM
    makes this a required field, so in practice every new email/password
    signup passes a real value, but the RPC itself doesn't assert one.
  - p_utr_rating DECIMAL(3,1) DEFAULT NULL - optional, self-reported;
    validated to the same 1-16.5 range ProfilePage's existing edit form
    already enforces client-side (UTR's real-world scale), so this
    column can't be corrupted by a caller that bypasses the UI.
  - p_home_town TEXT DEFAULT 'Livingston, NJ' - CourtConnect is currently
    a single-town pilot (see PlayersPage/CourtsPage/EventsPage's own
    'Pilot launch - more towns coming soon' comments), so defaulting new
    signups to the one real pilot location is accurate, not a claim
    about other towns.

All three are added to the ON CONFLICT (id) DO UPDATE branch, not just
the INSERT VALUES list - the original 016 migration deliberately left
skill_level/availability/favorite_courts out of the UPDATE branch since
they had no real signup-time value to protect (skill_level always ended
up 'beginner' either way, whichever insert won the fetchOrCreateProfile
race described in 016's own header comment). Now that this RPC carries
the user's actual chosen skill_level/utr_rating/home_town, that race
would silently discard those choices if the minimal fallback insert
happened to land first - exactly the bug 016 fixed for date_of_birth/
tos_*, now extended to these three fields for the same reason.

## Data cleanup
A handful of existing rows may already hold the bare town name
'Livingston' (profiles.home_town from manual profile edits before this
change, the one seeded pilot court's courts.town from
005_extend_surface_type_and_seed_livingston.sql, and any events/gear
listings created with that value) rather than 'Livingston, NJ'.
Normalizing these keeps the Players/Courts/Events/Gear town filters
(which match by exact string equality) working consistently for both
existing and new data - see PlayersPage.tsx/CourtsPage.tsx/
EventsPage.tsx's `towns` arrays, updated to 'Livingston, NJ' in this same
change. Purely a display-string normalization of already-public location
data (a home town a user chose to show on their own directory listing,
and public court/event/gear venue data) - no PII exposure change, no RLS
change.

## What this does NOT change
- No RLS policy is touched.
- No column is added or dropped - skill_level, utr_rating, and home_town
  all already existed (001/006 full schema).
- protect_sensitive_profile_columns() (009/017) is not touched -
  skill_level/utr_rating/home_town were already outside its protected-
  column list (self-service, same as today) and remain so.
- The under-13 block, age_band derivation, and Terms/Privacy acceptance
  writes in upsert_signup_profile() are unchanged from 016.
*/

CREATE OR REPLACE FUNCTION public.upsert_signup_profile(
  p_name TEXT,
  p_avatar_url TEXT,
  p_date_of_birth DATE,
  p_skill_level TEXT DEFAULT NULL,
  p_utr_rating DECIMAL(3,1) DEFAULT NULL,
  p_home_town TEXT DEFAULT 'Livingston, NJ'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_age INT;
  v_age_band TEXT;
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_date_of_birth IS NULL OR p_date_of_birth > CURRENT_DATE THEN
    RAISE EXCEPTION 'Invalid date of birth';
  END IF;

  v_age := DATE_PART('year', AGE(CURRENT_DATE, p_date_of_birth));

  IF v_age < 13 THEN
    RAISE EXCEPTION 'You must be at least 13 to use CourtConnect';
  END IF;

  IF p_skill_level IS NOT NULL AND p_skill_level NOT IN ('beginner', 'intermediate', 'advanced', 'varsity', 'elite') THEN
    RAISE EXCEPTION 'Invalid skill level';
  END IF;

  IF p_utr_rating IS NOT NULL AND (p_utr_rating < 1 OR p_utr_rating > 16.5) THEN
    RAISE EXCEPTION 'UTR rating must be between 1 and 16.5';
  END IF;

  v_age_band := CASE WHEN v_age < 18 THEN 'minor' ELSE 'adult' END;

  PERFORM set_config('app.bypass_profile_protection', 'true', true);

  INSERT INTO public.profiles (
    id, name, avatar_url, role, skill_level, utr_rating, home_town, availability, favorite_courts,
    date_of_birth, age_band,
    tos_accepted_at, tos_version, privacy_accepted_at, privacy_version, safety_acknowledged_at
  )
  VALUES (
    v_uid, p_name, p_avatar_url, 'player', p_skill_level, p_utr_rating, p_home_town, '{}', '{}',
    p_date_of_birth, v_age_band,
    now(), 'v1', now(), 'v1', now()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    skill_level = COALESCE(EXCLUDED.skill_level, public.profiles.skill_level),
    utr_rating = COALESCE(EXCLUDED.utr_rating, public.profiles.utr_rating),
    home_town = COALESCE(EXCLUDED.home_town, public.profiles.home_town),
    date_of_birth = EXCLUDED.date_of_birth,
    age_band = EXCLUDED.age_band,
    tos_accepted_at = EXCLUDED.tos_accepted_at,
    tos_version = EXCLUDED.tos_version,
    privacy_accepted_at = EXCLUDED.privacy_accepted_at,
    privacy_version = EXCLUDED.privacy_version,
    safety_acknowledged_at = EXCLUDED.safety_acknowledged_at
  RETURNING * INTO v_profile;

  IF v_age_band = 'adult' AND COALESCE(v_profile.is_banned, false) = false THEN
    UPDATE public.profiles
    SET parent_consent_status = 'not_required',
        social_features_enabled = true
    WHERE id = v_uid
    RETURNING * INTO v_profile;
  END IF;

  RETURN jsonb_build_object('ok', true, 'profile', to_jsonb(v_profile));
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_signup_profile(TEXT, TEXT, DATE, TEXT, DECIMAL, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_signup_profile(TEXT, TEXT, DATE, TEXT, DECIMAL, TEXT) TO authenticated;

-- CREATE OR REPLACE with an expanded parameter list creates a *new*
-- overload rather than replacing the original - Postgres function
-- identity is the full declared parameter type list, so the old 3-arg
-- (TEXT, TEXT, DATE) version above is otherwise left behind, still
-- reachable, and still hardcodes skill_level = 'beginner'. Drop it
-- explicitly so there is exactly one version of this function, and so a
-- stray/cached caller can never silently fall back to the old behavior.
DROP FUNCTION IF EXISTS public.upsert_signup_profile(TEXT, TEXT, DATE);

-- Normalize existing bare "Livingston" location strings to "Livingston, NJ"
-- so they match the towns filter arrays and the new signup default. See
-- header comment above for why this is safe (public display data the
-- profile/court owner already chose to show, no RLS/PII change).
UPDATE public.profiles SET home_town = 'Livingston, NJ' WHERE home_town = 'Livingston';
UPDATE public.courts SET town = 'Livingston, NJ' WHERE town = 'Livingston';
UPDATE public.events SET town = 'Livingston, NJ' WHERE town = 'Livingston';
UPDATE public.gear_listings SET town = 'Livingston, NJ' WHERE town = 'Livingston';
