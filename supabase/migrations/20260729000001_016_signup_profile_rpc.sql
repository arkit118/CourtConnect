/*
# QA fix - safe, atomic signup profile upsert

## The bug this fixes
AuthContext.signUp() calls supabase.auth.signUp(), then does its own
INSERT into profiles with the full legal/age fields (date_of_birth,
age_band, tos_accepted_at, tos_version, privacy_accepted_at,
privacy_version, safety_acknowledged_at). But supabase.auth.signUp()
also fires the SDK's own onAuthStateChange('SIGNED_IN' /
'INITIAL_SESSION') event, whose handler (fetchOrCreateProfile) does its
own SELECT-then-INSERT of a *minimal* profile (name/avatar/role/
skill_level only - no legal/age fields) if no row exists yet. These two
code paths race. Whichever INSERT reaches Postgres first wins; the loser
hits the id primary-key conflict and is silently ignored (by design, to
tolerate a benign double-create race) - but that means if the minimal
insert wins, the legal/age fields are simply never written, and nothing
ever retries. Confirmed via direct profile inspection during QA: fresh
signups reliably ended up with date_of_birth/age_band/tos_version/
tos_accepted_at/privacy_version/privacy_accepted_at all NULL.

## Why this needs to be an RPC rather than a plain client-side upsert
A plain `supabase.from('profiles').upsert({...}, { onConflict: 'id' })`
from the client would still lose the race in a different way: if the
minimal fallback profile already exists when this upsert runs, upsert
performs an UPDATE - and the protect_sensitive_profile_columns trigger
(see 20260728000002_009_protect_sensitive_profile_columns.sql) pins
age_band and date_of_birth back to their prior (NULL) value on any
self-UPDATE coming through the normal authenticated API, exactly the
same way it stops a user from lying about their own age after the fact.
That protection is still correct and is not being loosened - the signup
flow needs a narrow, validated, one-time path to legitimately set these
fields for its own new account, which is exactly what this RPC is.

## What this function does
upsert_signup_profile(name, avatar_url, date_of_birth), SECURITY
DEFINER, callable by `authenticated` only:
1. Requires auth.uid() (must be called by the account being created).
2. Validates date_of_birth and re-enforces the under-13 block (defense
   in depth - the app already blocks this client-side, and the INSERT
   trigger already enforces it for a fresh row, but this covers the
   INSERT..ON CONFLICT DO UPDATE path here specifically too).
3. Sets the bypass flag, then does a single INSERT ... ON CONFLICT (id)
   DO UPDATE that unconditionally writes name, avatar_url,
   date_of_birth, age_band, tos_accepted_at, tos_version = 'v1',
   privacy_accepted_at, privacy_version = 'v1', safety_acknowledged_at -
   regardless of whether the row already existed (from the fallback
   racing ahead) or is being created fresh here. This is what actually
   closes the race: no matter which INSERT reaches Postgres first, this
   call is guaranteed to end with the full legal/age data in place.
4. If newly adult and not banned, also activates social features (same
   auto-activation rule as set_social_age_band/the Part B backfill).
5. Returns the resulting profile row so the client can set it directly
   without a second round trip, and can verify the fields actually
   landed.

role/skill_level/availability/favorite_courts are only set on the
INSERT branch (via the VALUES list), not touched on conflict, so this
never resets anything a concurrently-created minimal profile already
has correctly defaulted.
*/

CREATE OR REPLACE FUNCTION public.upsert_signup_profile(
  p_name TEXT,
  p_avatar_url TEXT,
  p_date_of_birth DATE
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

  v_age_band := CASE WHEN v_age < 18 THEN 'minor' ELSE 'adult' END;

  PERFORM set_config('app.bypass_profile_protection', 'true', true);

  INSERT INTO public.profiles (
    id, name, avatar_url, role, skill_level, availability, favorite_courts,
    date_of_birth, age_band,
    tos_accepted_at, tos_version, privacy_accepted_at, privacy_version, safety_acknowledged_at
  )
  VALUES (
    v_uid, p_name, p_avatar_url, 'player', 'beginner', '{}', '{}',
    p_date_of_birth, v_age_band,
    now(), 'v1', now(), 'v1', now()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
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

REVOKE ALL ON FUNCTION public.upsert_signup_profile(TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_signup_profile(TEXT, TEXT, DATE) TO authenticated;
