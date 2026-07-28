/*
# Phase 3 - matches table with a database-enforced age-band safety trigger

## Purpose
A match is a mutual pairing between two profiles, used to unlock chat.
This migration creates public.matches and a BEFORE INSERT OR UPDATE
trigger that is the actual hard safety boundary for cross-age-band
matching - not the frontend. Per the task's explicit requirement: "The
database must make cross-age-band matching impossible even if the
frontend has a bug."

## Columns
id, user_a, user_b, requested_by, age_band, status, created_at,
updated_at, accepted_at, ended_at, blocked_at - as specified.

## Trigger behavior (enforce_match_safety)
Two branches:
- When NEW.status is being set to 'declined' | 'ended' | 'blocked' (a
  shutdown transition), only the basic structural checks run (distinct
  users, both profiles exist) - safety eligibility is deliberately NOT
  re-checked here, because we always want to be able to end/decline/
  block a match even if one participant's status changed since it was
  created (e.g. they got banned after the match went active - we still
  want "block" and "end" to work, not get rejected by the same checks
  that ban is trying to shut down access via).
- Otherwise (status is 'pending' or 'active' - i.e. establishing or
  keeping the relationship open), the full safety gate runs: both users
  exist, neither is banned, both accepted Terms v1 and Privacy v1, both
  have a determined age_band, both age_bands match each other, both have
  social_features_enabled and matching_enabled, and neither has blocked
  the other. NEW.age_band is then always set from the (matching)
  participant age_band, ignoring whatever the client sent.
- An additional rule: only the non-requester participant may transition
  a match from 'pending' to 'active' (i.e. you cannot accept your own
  outgoing request).

## Duplicate-pair prevention
A partial unique index on (LEAST(user_a,user_b), GREATEST(user_a,user_b))
WHERE status IN ('pending','active') makes "no duplicate active/pending
pair regardless of order" an atomic, race-condition-safe database
constraint rather than an application-level check-then-insert.

## RLS
- SELECT: only participants (auth.uid() = user_a OR user_b).
- INSERT: only as a participant, and only as requested_by.
- UPDATE: only participants.
- No public/anon access at all.
*/

CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  age_band TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  blocked_at TIMESTAMPTZ,
  CONSTRAINT matches_distinct_users CHECK (user_a <> user_b)
);

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_status_check
  CHECK (status IN ('pending', 'active', 'declined', 'ended', 'blocked'));

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_age_band_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_age_band_check
  CHECK (age_band IS NULL OR age_band IN ('minor', 'adult'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_unique_active_pair
  ON public.matches (LEAST(user_a, user_b), GREATEST(user_a, user_b))
  WHERE status IN ('pending', 'active');

CREATE INDEX IF NOT EXISTS idx_matches_user_a ON public.matches(user_a);
CREATE INDEX IF NOT EXISTS idx_matches_user_b ON public.matches(user_b);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);

CREATE OR REPLACE FUNCTION public.enforce_match_safety()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  profile_a public.profiles%ROWTYPE;
  profile_b public.profiles%ROWTYPE;
BEGIN
  IF NEW.user_a = NEW.user_b THEN
    RAISE EXCEPTION 'A match cannot be between the same user';
  END IF;

  SELECT * INTO profile_a FROM public.profiles WHERE id = NEW.user_a;
  SELECT * INTO profile_b FROM public.profiles WHERE id = NEW.user_b;

  IF profile_a.id IS NULL OR profile_b.id IS NULL THEN
    RAISE EXCEPTION 'Match participants must be existing profiles';
  END IF;

  -- Shutdown transitions are always allowed through basic checks only,
  -- so a match can always be ended/declined/blocked regardless of
  -- whether a participant's eligibility has since changed.
  IF NEW.status IN ('declined', 'ended', 'blocked') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(profile_a.is_banned, false) OR COALESCE(profile_b.is_banned, false) THEN
    RAISE EXCEPTION 'Banned users cannot be matched';
  END IF;

  IF profile_a.tos_version IS DISTINCT FROM 'v1' OR profile_b.tos_version IS DISTINCT FROM 'v1' THEN
    RAISE EXCEPTION 'Both users must accept the current Terms of Service';
  END IF;

  IF profile_a.privacy_version IS DISTINCT FROM 'v1' OR profile_b.privacy_version IS DISTINCT FROM 'v1' THEN
    RAISE EXCEPTION 'Both users must accept the current Privacy Policy';
  END IF;

  IF profile_a.age_band IS NULL OR profile_b.age_band IS NULL THEN
    RAISE EXCEPTION 'Both users must have a determined age band';
  END IF;

  IF profile_a.age_band IS DISTINCT FROM profile_b.age_band THEN
    RAISE EXCEPTION 'Users can only be matched within the same age band';
  END IF;

  IF NOT profile_a.social_features_enabled OR NOT profile_b.social_features_enabled THEN
    RAISE EXCEPTION 'Both users must have social features enabled';
  END IF;

  IF NOT profile_a.matching_enabled OR NOT profile_b.matching_enabled THEN
    RAISE EXCEPTION 'Matching is disabled for one of these users';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = NEW.user_a AND blocked_id = NEW.user_b)
       OR (blocker_id = NEW.user_b AND blocked_id = NEW.user_a)
  ) THEN
    RAISE EXCEPTION 'These users cannot be matched';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'active' THEN
    IF auth.uid() IS NOT NULL AND auth.uid() = OLD.requested_by THEN
      RAISE EXCEPTION 'Only the recipient can accept a match request';
    END IF;
  END IF;

  NEW.age_band := profile_a.age_band;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_match_safety_trigger ON public.matches;
CREATE TRIGGER enforce_match_safety_trigger
  BEFORE INSERT OR UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_match_safety();

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches_select_participant" ON public.matches;
CREATE POLICY "matches_select_participant" ON public.matches FOR SELECT
  TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "matches_insert_participant" ON public.matches;
CREATE POLICY "matches_insert_participant" ON public.matches FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = requested_by AND (auth.uid() = user_a OR auth.uid() = user_b)
  );

DROP POLICY IF EXISTS "matches_update_participant" ON public.matches;
CREATE POLICY "matches_update_participant" ON public.matches FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b)
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'matches_updated_at') THEN
    CREATE TRIGGER matches_updated_at BEFORE UPDATE ON public.matches
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END
$$;
