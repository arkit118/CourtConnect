/*
# Phase 3 - matching/chat RPC functions

All functions are SECURITY DEFINER with an explicit SET search_path =
public (required so a SECURITY DEFINER function can't be tricked by a
caller-controlled search_path into resolving an object from a different
schema). Each function validates exactly what it needs before touching
any data, and returns only the minimal safe fields described inline -
never a full profile row, never a raw token to anyone but the person who
just generated it for themselves, never date_of_birth/parent_email/
ban_reason to a caller who shouldn't see them.

Functions:
- set_social_age_band(date) - self-service age determination for users
  missing date_of_birth/age_band (the "social onboarding gate" fallback
  for accounts that predate Phase 1's signup DOB collection). Recomputes
  age server-side from the database clock; never trusts a client-passed
  age. Blocks under-13. Auto-activates eligible adults.
- request_parent_consent(text) - a minor-band profile requests parent/
  guardian consent. Writes to parent_consent_requests (not profiles) and
  returns the new token so the client can pass it to the
  send-parent-consent-email Edge Function immediately.
- get_consent_request_info(uuid) - public (anon-callable) read-only
  lookup used by the /parental-consent page before a decision is made.
  Returns only the child's display name and current decision state.
- resolve_parent_consent(uuid, text) - public (anon-callable) - the
  actual approve/decline action taken by a parent from the emailed link.
  Idempotent: a second call after a decision has already been made
  returns the existing decision without changing anything.
- get_match_candidates() - safe candidate discovery for the signed-in
  user. Explicit column allowlist; never returns date_of_birth,
  parent_email, ban_reason, or any other sensitive field.
*/

CREATE OR REPLACE FUNCTION public.set_social_age_band(p_date_of_birth DATE)
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
    RETURN jsonb_build_object('ok', false, 'reason', 'under_13');
  END IF;

  v_age_band := CASE WHEN v_age < 18 THEN 'minor' ELSE 'adult' END;

  PERFORM set_config('app.bypass_profile_protection', 'true', true);

  UPDATE public.profiles
  SET date_of_birth = p_date_of_birth,
      age_band = v_age_band
  WHERE id = v_uid
  RETURNING * INTO v_profile;

  IF v_age_band = 'adult'
     AND COALESCE(v_profile.is_banned, false) = false
     AND v_profile.tos_version = 'v1'
     AND v_profile.privacy_version = 'v1' THEN
    UPDATE public.profiles
    SET parent_consent_status = 'not_required',
        social_features_enabled = true
    WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object('ok', true, 'age_band', v_age_band);
END;
$$;

REVOKE ALL ON FUNCTION public.set_social_age_band(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_social_age_band(DATE) TO authenticated;


CREATE OR REPLACE FUNCTION public.request_parent_consent(p_parent_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_age_band TEXT;
  v_token UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_parent_email IS NULL OR trim(p_parent_email) = '' OR p_parent_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'A valid parent/guardian email is required';
  END IF;

  SELECT age_band INTO v_age_band FROM public.profiles WHERE id = v_uid;

  IF v_age_band IS DISTINCT FROM 'minor' THEN
    RAISE EXCEPTION 'Parent/guardian consent only applies to minor accounts';
  END IF;

  v_token := gen_random_uuid();

  INSERT INTO public.parent_consent_requests (profile_id, parent_email, token, requested_at, decided_at, decision)
  VALUES (v_uid, trim(p_parent_email), v_token, now(), NULL, 'pending')
  ON CONFLICT (profile_id) DO UPDATE
    SET parent_email = EXCLUDED.parent_email,
        token = EXCLUDED.token,
        requested_at = now(),
        decided_at = NULL,
        decision = 'pending';

  PERFORM set_config('app.bypass_profile_protection', 'true', true);

  UPDATE public.profiles
  SET parent_consent_status = 'pending',
      parent_consent_requested_at = now(),
      parent_consent_decided_at = NULL,
      parent_consent_decision = NULL,
      social_features_enabled = false
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'token', v_token);
END;
$$;

REVOKE ALL ON FUNCTION public.request_parent_consent(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_parent_consent(TEXT) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_consent_request_info(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_name TEXT;
  v_decision TEXT;
BEGIN
  IF p_token IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT p.name, r.decision
  INTO v_child_name, v_decision
  FROM public.parent_consent_requests r
  JOIN public.profiles p ON p.id = r.profile_id
  WHERE r.token = p_token;

  IF v_child_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'child_name', v_child_name, 'decision', v_decision);
END;
$$;

REVOKE ALL ON FUNCTION public.get_consent_request_info(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_consent_request_info(UUID) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.resolve_parent_consent(p_token UUID, p_decision TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_current_decision TEXT;
  v_child_name TEXT;
BEGIN
  IF p_decision NOT IN ('approved', 'declined') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  SELECT r.profile_id, r.decision, p.name
  INTO v_profile_id, v_current_decision, v_child_name
  FROM public.parent_consent_requests r
  JOIN public.profiles p ON p.id = r.profile_id
  WHERE r.token = p_token
  FOR UPDATE OF r;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_current_decision IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', true, 'already_decided', true, 'decision', v_current_decision, 'child_name', v_child_name);
  END IF;

  UPDATE public.parent_consent_requests
  SET decision = p_decision, decided_at = now()
  WHERE token = p_token;

  PERFORM set_config('app.bypass_profile_protection', 'true', true);

  UPDATE public.profiles
  SET parent_consent_status = p_decision,
      parent_consent_decided_at = now(),
      parent_consent_decision = p_decision,
      social_features_enabled = (p_decision = 'approved')
  WHERE id = v_profile_id;

  RETURN jsonb_build_object('ok', true, 'already_decided', false, 'decision', p_decision, 'child_name', v_child_name);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_parent_consent(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_parent_consent(UUID, TEXT) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.get_match_candidates()
RETURNS TABLE (
  id UUID,
  name TEXT,
  home_town TEXT,
  skill_level TEXT,
  utr_rating DECIMAL,
  preferred_play_style TEXT,
  availability TEXT[],
  bio TEXT,
  age_band TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_age_band TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.age_band INTO v_age_band
  FROM public.profiles p
  WHERE p.id = v_uid
    AND COALESCE(p.is_banned, false) = false
    AND p.tos_version = 'v1'
    AND p.privacy_version = 'v1'
    AND p.social_features_enabled = true
    AND p.matching_enabled = true;

  IF v_age_band IS NULL THEN
    -- Not eligible yet (missing age_band, banned, outstanding Terms/
    -- Privacy, or social features not enabled/pending consent) - return
    -- no candidates rather than raising, so the frontend can show its
    -- own eligibility-specific messaging instead of a generic error.
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.name, p.home_town, p.skill_level, p.utr_rating,
    p.preferred_play_style, p.availability, p.bio, p.age_band,
    p.avatar_url, p.created_at
  FROM public.profiles p
  WHERE p.id <> v_uid
    AND p.age_band = v_age_band
    AND COALESCE(p.is_banned, false) = false
    AND p.tos_version = 'v1'
    AND p.privacy_version = 'v1'
    AND p.social_features_enabled = true
    AND p.matching_enabled = true
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = v_uid AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = v_uid)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.status IN ('pending', 'active')
        AND ((m.user_a = v_uid AND m.user_b = p.id)
          OR (m.user_a = p.id AND m.user_b = v_uid))
    )
  ORDER BY p.created_at DESC
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.get_match_candidates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_match_candidates() TO authenticated;
