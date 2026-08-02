/*
# Post-launch fix - track whether the parent/guardian consent email
  actually sent, not just whether the request was recorded

## The bug this closes
request_parent_consent() (015_social_rpcs.sql) sets
profiles.parent_consent_status = 'pending' as soon as the *request* is
saved - before the frontend has even tried to invoke the
send-parent-consent-email Edge Function. useSocialEligibility.ts then
routes status = 'pending' straight to the "Waiting for parent/guardian
approval - we've sent your parent or guardian an email" message,
regardless of whether that email actually sent.

If the Edge Function call fails (misconfigured Resend secrets, a
transient network error, anything) the minor's account is left showing
"we've sent your parent an email" when no such email exists - the exact
class of bug a real user hit (report: "parent confirmation email did not
send"). There was previously no durable, database-level signal for "was
the email actually sent," only ephemeral component state in
SocialOnboardingGate.tsx that's lost on refresh/remount - so the moment
the user reloads the page, they're back to being told to wait for an
email that was never sent, with no way to retry.

## The fix
- Add profiles.parent_consent_email_sent_at (nullable timestamptz) -
  set ONLY by the Edge Function, ONLY after Resend has confirmed the send
  succeeded (see supabase/functions/send-parent-consent-email/index.ts).
  This is the same "outcome field, safe to read broadly, not the
  token/email itself" pattern as the existing parent_consent_requested_at/
  parent_consent_decided_at columns from 008_matching_social_fields.sql -
  see 014_parent_consent_requests.sql's header comment for why the token
  and parent's raw email specifically do NOT live here.
- Add it to protect_sensitive_profile_columns() (009) alongside the other
  parent_consent_* columns, so a user can't self-write it directly and
  make the UI falsely claim an email was sent.
- request_parent_consent() now also resets it to NULL on every new
  request, so a resend attempt correctly starts from "not yet confirmed
  sent" again until the Edge Function confirms the new attempt.
- New mark_parent_consent_email_sent(token) SECURITY DEFINER RPC, grant
  authenticated only - called by the Edge Function using the same
  user-JWT-authenticated client it already builds to verify the caller
  (never service_role), immediately after Resend confirms success. Scoped
  so it can only ever mark the calling user's own pending request.

This is purely additive (one nullable column, no data migration, no type
changes) and does not alter parent_consent_status/social_features_enabled
semantics at all - a minor's account still only gains matching/chat access
via resolve_parent_consent() when a parent actually approves. This column
is informational only: it lets the frontend tell the difference between
"we're genuinely waiting on your parent" and "we couldn't confirm the
email went out, please try again" instead of always claiming the former.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_consent_email_sent_at TIMESTAMPTZ;

-- Re-declare with parent_consent_email_sent_at added to both branches,
-- otherwise it would fall into the "not protected, self-writable" bucket
-- documented in 009's own comment - which would let a user just mark
-- their own request "sent" and silently defeat this fix's purpose.
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

-- Re-declare with the one added line (parent_consent_email_sent_at = NULL)
-- so a fresh/resend request correctly clears the old "confirmed sent"
-- signal until the new attempt is confirmed.
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


-- Called by the send-parent-consent-email Edge Function, and only by it in
-- practice, immediately after Resend confirms the send succeeded. Scoped to
-- the caller's own pending request (a user can only ever mark their own
-- consent request as emailed, never anyone else's).
CREATE OR REPLACE FUNCTION public.mark_parent_consent_email_sent(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT profile_id INTO v_profile_id
  FROM public.parent_consent_requests
  WHERE token = p_token;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_profile_id <> v_uid THEN
    RAISE EXCEPTION 'Token does not belong to the calling user';
  END IF;

  PERFORM set_config('app.bypass_profile_protection', 'true', true);

  UPDATE public.profiles
  SET parent_consent_email_sent_at = now()
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_parent_consent_email_sent(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_parent_consent_email_sent(UUID) TO authenticated;
