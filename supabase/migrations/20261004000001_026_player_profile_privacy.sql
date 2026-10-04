/*
# Player profile privacy: no anonymous access, safe single-profile reads

## 1. Anonymous users can never read public.profiles
The only SELECT policy this repo defines on profiles is
"profiles_select_public" TO authenticated (20260612230033_001). This
asserts that invariant in production rather than assuming it: any SELECT
(or ALL) policy on profiles that applies to `anon` or `public` (the
latter covers every role, including anon) is dropped - a no-op if the
database already matches the repo - and the authenticated-only read
policy is (re)created if it's somehow missing. Insert/update policies are
untouched. Table privileges are deliberately NOT revoked from anon: the
public Events/Gear pages embed organizer/seller profiles via PostgREST,
and a privilege error would fail those whole queries, whereas RLS simply
returns no profile rows for anon (embeds come back null).

## 2. get_player_profile(p_profile_id) for /players/:id
The profile page used to `select *` the target row, so any signed-in user
received another member's date_of_birth, parent-consent fields, and ban
details in the response, across age bands. This SECURITY DEFINER function
returns only the public-facing columns (the same kind of allowlist as
get_match_candidates), and only when:
  - the caller is signed in and not banned, and
  - the target is the caller, OR the target is not banned, is in the
    caller's own age band (adult/minor separation), and neither has
    blocked the other.
Otherwise it returns no row and the page shows "not available".

## Known remaining exposure (not changed here)
profiles_select_public still lets any signed-in account read every column
of every profile through a direct API call (documented as a pre-existing
risk since 20260728000007_014). Closing that needs column-level privileges
plus moving the app's own-profile reads to an RPC, and can only ship once
older iOS builds (which `select *` on profiles) are no longer in use -
otherwise those builds would break. Tracked as a follow-up.

All statements are idempotent.
*/

-- 1. No anon/public read access to profiles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND cmd IN ('SELECT', 'ALL')
      AND roles && ARRAY['anon', 'public']::name[]
  LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', pol.policyname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_public'
  ) THEN
    CREATE POLICY "profiles_select_public" ON public.profiles FOR SELECT
      TO authenticated USING (true);
  END IF;
END
$$;

-- 2. Safe single-profile read
CREATE OR REPLACE FUNCTION public.get_player_profile(p_profile_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  avatar_url TEXT,
  home_town TEXT,
  skill_level TEXT,
  utr_rating DECIMAL,
  preferred_play_style TEXT,
  availability TEXT[],
  favorite_courts TEXT[],
  years_playing INTEGER,
  bio TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_caller public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_caller FROM public.profiles p WHERE p.id = v_uid;
  IF v_caller.id IS NULL OR COALESCE(v_caller.is_banned, false) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.name, p.avatar_url, p.home_town, p.skill_level, p.utr_rating,
    p.preferred_play_style, p.availability, p.favorite_courts, p.years_playing,
    p.bio, p.created_at
  FROM public.profiles p
  WHERE p.id = p_profile_id
    AND (
      p.id = v_uid
      OR (
        COALESCE(p.is_banned, false) = false
        AND p.age_band IS NOT NULL
        AND p.age_band = v_caller.age_band
        AND NOT EXISTS (
          SELECT 1 FROM public.blocks b
          WHERE (b.blocker_id = v_uid AND b.blocked_id = p.id)
             OR (b.blocker_id = p.id AND b.blocked_id = v_uid)
        )
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_player_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_profile(UUID) TO authenticated;
