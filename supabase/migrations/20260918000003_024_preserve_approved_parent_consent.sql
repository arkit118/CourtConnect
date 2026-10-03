/*
# Fix: re-requesting parent consent must not revoke an already-approved minor

## The regression
request_parent_consent() (introduced in 20260728000008_015_social_rpcs.sql,
then re-declared with one added column in
20260802000001_017_parent_consent_email_tracking.sql) has always
unconditionally run this on every call, regardless of the profile's
current state:

  UPDATE public.profiles
  SET parent_consent_status = 'pending',
      ...
      social_features_enabled = false
  WHERE id = v_uid;

That's correct the FIRST time a minor requests consent, and correct for
a retry while still pending/declined. But if a minor who has already
been approved (parent_consent_status = 'approved', social_features_enabled
= true, via resolve_parent_consent()) ever calls this RPC again - e.g.
resending the email, or picking "Send to a different email" in
ParentConsentFlow (src/components/SocialOnboardingGate.tsx) - this
silently revoked their existing approval and disabled matching/chat for
them, with no actual new parent decision having been made. Discovered
while investigating a Players-page eligibility report (confirmed to be
working-as-designed for the original report; this is a separate, real
bug found along the way).

## The fix
Read the profile's current parent_consent_status first. If it is already
'approved', record the new request (new token/parent_email) in
parent_consent_requests for reference, marked as already decided
'approved' (so a stale lookup by the old token correctly reports "not
found" rather than "pending", and nothing is left in a state implying a
fresh decision is awaited) - and do NOT touch the profile's
parent_consent_status / social_features_enabled / decided_at / decision /
email_sent_at at all. Approval, once granted, is only ever revoked by an
intentional admin/moderation action (e.g. banning, or a manual edit per
docs/moderation-runbook.md), never as a side effect of the minor
resending an email.

For every other current status (not_required, pending, declined) -
i.e. a minor who has never been approved yet - behavior is completely
unchanged: parent_consent_status resets to 'pending', social_features_
enabled resets to false, and matching/chat stay unavailable until a real
parent decision comes back via resolve_parent_consent(). Nothing about
the minor-approval safety gate itself is weakened.
*/

CREATE OR REPLACE FUNCTION public.request_parent_consent(p_parent_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_age_band TEXT;
  v_current_status TEXT;
  v_token UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_parent_email IS NULL OR trim(p_parent_email) = '' OR p_parent_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'A valid parent/guardian email is required';
  END IF;

  SELECT age_band, parent_consent_status INTO v_age_band, v_current_status
  FROM public.profiles WHERE id = v_uid;

  IF v_age_band IS DISTINCT FROM 'minor' THEN
    RAISE EXCEPTION 'Parent/guardian consent only applies to minor accounts';
  END IF;

  v_token := gen_random_uuid();

  IF v_current_status = 'approved' THEN
    -- Already approved - keep a record of the new request for reference,
    -- but do not touch the profile's live approval/social-features state.
    INSERT INTO public.parent_consent_requests (profile_id, parent_email, token, requested_at, decided_at, decision)
    VALUES (v_uid, trim(p_parent_email), v_token, now(), now(), 'approved')
    ON CONFLICT (profile_id) DO UPDATE
      SET parent_email = EXCLUDED.parent_email,
          token = EXCLUDED.token,
          requested_at = now(),
          decided_at = now(),
          decision = 'approved';

    RETURN jsonb_build_object('ok', true, 'token', v_token, 'already_approved', true);
  END IF;

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

  RETURN jsonb_build_object('ok', true, 'token', v_token, 'already_approved', false);
END;
$$;

REVOKE ALL ON FUNCTION public.request_parent_consent(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_parent_consent(TEXT) TO authenticated;
