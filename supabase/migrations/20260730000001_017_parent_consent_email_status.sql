/*
# Phase 3 follow-up - track whether the parent/guardian consent email
  actually sent, so the frontend can stop claiming it did when it didn't

## The bug this fixes
request_parent_consent() (015_social_rpcs.sql) only ever creates the
pending consent record - it has no way to know whether the frontend's
subsequent call to the send-parent-consent-email Edge Function actually
succeeded, because that call happens separately, after this RPC returns,
and the Edge Function does not touch the database at all (by design - see
its header comment). Once parent_consent_status = 'pending' is set, every
future page load (including days later, after the tab is closed and
reopened) renders SocialOnboardingGate's "We've sent your parent or
guardian an email..." message unconditionally - even if RESEND_API_KEY /
PARENT_CONSENT_FROM_EMAIL / APP_BASE_URL were never configured and the
Edge Function returned 503 configured:false, or Resend itself rejected
the send. A minor (and their parent, who never receives anything) has no
way to tell "an email is genuinely on its way" from "this is silently
stuck forever" from that copy alone.

## The fix
A new nullable profiles.parent_consent_email_sent_at timestamp, set only
by a new mark_parent_consent_email_sent() RPC that the frontend calls
after (and only after) send-parent-consent-email responds { ok: true }.
SocialOnboardingGate then renders different copy depending on whether
this is set. It is treated exactly like every other consent-adjacent
field on profiles: added to protect_sensitive_profile_columns() so a
normal authenticated self-update can never fake it, and reset to NULL
whenever request_parent_consent() (re)creates a pending request, so a
retry after a prior failure doesn't inherit a stale "sent" flag - or, in
the reverse case, doesn't strand a genuine still-pending original request
showing the retry copy just because a second, redundant request happened
to fail.

This is purely an accuracy/UX fix for the pending_consent message. It
does not touch social_features_enabled, does not grant or gate access,
and does not change who can call resolve_parent_consent or under what
conditions - none of the actual safety boundary moves.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_consent_email_sent_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_bypass BOOLEAN := COALESCE(current_setting('app.bypass_profile_protection', true), 'false') = 'true';
  v_age INT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.date_of_birth IS NOT NULL THEN
      IF NEW.date_of_birth > CURRENT_DATE THEN
        RAISE EXCEPTION 'Invalid date of birth';
      END IF;

      v_age := DATE_PART('year', AGE(CURRENT_DATE, NEW.date_of_birth));

      IF v_age < 13 THEN
        RAISE EXCEPTION 'You must be at least 13 to use CourtConnect';
      END IF;

      NEW.age_band := CASE WHEN v_age < 18 THEN 'minor' ELSE 'adult' END;
    ELSE
      NEW.age_band := NULL;
    END IF;

    NEW.role := 'player';
    NEW.is_banned := false;
    NEW.banned_at := NULL;
    NEW.ban_reason := NULL;
    NEW.social_features_enabled := false;
    NEW.matching_enabled := true;
    NEW.parent_consent_status := 'not_required';
    NEW.parent_consent_requested_at := NULL;
    NEW.parent_consent_decided_at := NULL;
    NEW.parent_consent_decision := NULL;
    NEW.parent_consent_email_sent_at := NULL;

    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE'
  IF v_bypass OR auth.uid() IS NULL OR auth.uid() <> OLD.id THEN
    RETURN NEW;
  END IF;

  NEW.is_banned := OLD.is_banned;
  NEW.banned_at := OLD.banned_at;
  NEW.ban_reason := OLD.ban_reason;
  NEW.role := OLD.role;
  NEW.age_band := OLD.age_band;
  NEW.date_of_birth := OLD.date_of_birth;
  NEW.social_features_enabled := OLD.social_features_enabled;
  NEW.matching_enabled := OLD.matching_enabled;
  NEW.parent_consent_status := OLD.parent_consent_status;
  NEW.parent_consent_requested_at := OLD.parent_consent_requested_at;
  NEW.parent_consent_decided_at := OLD.parent_consent_decided_at;
  NEW.parent_consent_decision := OLD.parent_consent_decision;
  NEW.parent_consent_email_sent_at := OLD.parent_consent_email_sent_at;

  RETURN NEW;
END;
$$;

-- Re-declared from 015_social_rpcs.sql, adding one line: reset
-- parent_consent_email_sent_at to NULL whenever a (re)request is made, so
-- a fresh attempt is never shown stale "sent" copy from a prior request,
-- and a retry after a failed send starts from a clean, correct state.
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
      parent_consent_email_sent_at = NULL,
      social_features_enabled = false
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'token', v_token);
END;
$$;

REVOKE ALL ON FUNCTION public.request_parent_consent(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_parent_consent(TEXT) TO authenticated;


CREATE OR REPLACE FUNCTION public.mark_parent_consent_email_sent()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM set_config('app.bypass_profile_protection', 'true', true);

  -- Scoped to parent_consent_status = 'pending' so this can never mark a
  -- request "sent" outside the one window it's meaningful in - e.g. after
  -- a decision has already been made, or for an account that never
  -- requested consent at all.
  UPDATE public.profiles
  SET parent_consent_email_sent_at = now()
  WHERE id = v_uid
    AND parent_consent_status = 'pending';

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_parent_consent_email_sent() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_parent_consent_email_sent() TO authenticated;
