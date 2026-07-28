/*
# Phase 3 - parent_consent_requests table (deliberately not on profiles)

## Why this is a separate table, not columns on profiles
The task's Part 1.A lists parent_email and parent_consent_token as
columns to add directly to profiles. This migration deviates from that
specifically for those two fields, for a concrete reason worth spelling
out clearly:

public.profiles has a SELECT policy from migration 001
("profiles_select_public", TO authenticated USING (true)) that lets any
signed-in user read every column of every profile row. That is a
pre-existing condition this project already relies on in several places
(Players/Partners directories, gear seller info, event organizer info),
so narrowing it now would be a much larger, higher-risk change than this
feature warrants on its own - it's flagged as a separate remaining risk
in the implementation summary rather than silently fixed here.

Given that policy, storing parent_consent_token directly on profiles
would mean literally any authenticated user could read any minor's raw
consent token with a plain `select * from profiles`, and use it to
approve or decline that minor's own parent-consent request via the
public /parental-consent page - completely defeating the purpose of
parental consent. A token is a bearer credential; it does not belong in
a broadly-readable row. parent_email is bundled into the same table for
the same reason (no need for it to be broadly readable either).

This table has RLS enabled with NO policies granted to anyone - not even
SELECT for the row's own profile owner. It is only ever read or written
through the SECURITY DEFINER RPC functions in 015_social_rpcs.sql, each
of which validates exactly what it's allowed to touch before doing so.
This is the strictest possible posture and is intentional.

The outcome fields that are safe to read broadly (status/decision
timestamps, not the token or the parent's email) still live on profiles
as the task specified: parent_consent_status, parent_consent_requested_at,
parent_consent_decided_at, parent_consent_decision (added in
008_matching_social_fields.sql).

## Columns
- profile_id uuid primary key references profiles(id) - one open request
  per profile; a new request overwrites the previous one (ON CONFLICT
  DO UPDATE in the RPC), so an old token is invalidated the moment a new
  one is requested.
- parent_email text
- token uuid not null default gen_random_uuid()
- requested_at, decided_at timestamptz
- decision text - 'pending' | 'approved' | 'declined'
- created_at, updated_at timestamptz
*/

CREATE TABLE IF NOT EXISTS public.parent_consent_requests (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_email TEXT,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  requested_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  decision TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.parent_consent_requests DROP CONSTRAINT IF EXISTS parent_consent_requests_decision_check;
ALTER TABLE public.parent_consent_requests ADD CONSTRAINT parent_consent_requests_decision_check
  CHECK (decision IN ('pending', 'approved', 'declined'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_consent_requests_token ON public.parent_consent_requests(token);

ALTER TABLE public.parent_consent_requests ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies: RLS enabled with zero grants means every
-- direct table access via the authenticated/anon API roles is denied.
-- Only SECURITY DEFINER functions (which run as the function owner, not
-- the caller) can read or write this table.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'parent_consent_requests_updated_at') THEN
    CREATE TRIGGER parent_consent_requests_updated_at BEFORE UPDATE ON public.parent_consent_requests
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END
$$;
