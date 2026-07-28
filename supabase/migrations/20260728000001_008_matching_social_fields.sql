/*
# Phase 3 - matching/chat social safety fields on profiles

## Purpose
Adds the profile columns needed to gate partner matching and chat behind
age-band separation, Terms/Privacy acceptance, and (for minors) parent/
guardian consent. Matching/chat only - this migration does not touch
courts/schedule/events/gear, and does not add a broad "account disabled"
switch that would block public browsing.

## New columns on public.profiles
- social_features_enabled boolean not null default false - the actual
  gate checked by the matches/messages triggers. Starts false for every
  new row; only ever flipped true by a controlled path (the
  set_social_age_band/resolve_parent_consent RPCs in a later migration,
  or the one-time adult backfill below).
- matching_enabled boolean not null default true - a per-user opt-out/
  moderation switch, independent of age-band eligibility.
- chat_safety_acknowledged_at timestamptz - when the user acknowledged
  the one-time chat safety card. Self-service, like tos_accepted_at.
- parent_consent_status text not null default 'not_required' - one of
  not_required | pending | approved | declined | revoked.
- parent_consent_requested_at / parent_consent_decided_at timestamptz,
  parent_consent_decision text - outcome/timing fields mirrored from the
  parent_consent_requests table (added in a later migration) for cheap
  frontend reads. The parent's email address and the raw approval token
  are intentionally NOT stored here - see 013_parent_consent_requests.sql
  for why.

## Adult backfill (Part B)
Existing/newly-eligible adult profiles (age_band = 'adult', not banned,
current Terms/Privacy accepted) are switched on for social features in
one pass. Minors are never auto-enabled - they always require an
approved parent/guardian consent record.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS social_features_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS matching_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chat_safety_acknowledged_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_consent_status TEXT NOT NULL DEFAULT 'not_required';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_consent_requested_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_consent_decided_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_consent_decision TEXT;

-- Normalize any unexpected existing values before adding check constraints.
UPDATE public.profiles
SET parent_consent_status = 'not_required'
WHERE parent_consent_status IS NULL OR parent_consent_status NOT IN ('not_required', 'pending', 'approved', 'declined', 'revoked');

UPDATE public.profiles
SET parent_consent_decision = NULL
WHERE parent_consent_decision IS NOT NULL AND parent_consent_decision NOT IN ('approved', 'declined');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_parent_consent_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_parent_consent_status_check
  CHECK (parent_consent_status IN ('not_required', 'pending', 'approved', 'declined', 'revoked'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_parent_consent_decision_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_parent_consent_decision_check
  CHECK (parent_consent_decision IS NULL OR parent_consent_decision IN ('approved', 'declined'));

CREATE INDEX IF NOT EXISTS idx_profiles_social_features_enabled ON public.profiles(social_features_enabled);
CREATE INDEX IF NOT EXISTS idx_profiles_age_band ON public.profiles(age_band);

-- Part B: one-time adult backfill. Safe to re-run - only ever moves
-- eligible, not-yet-enabled adults forward; never touches minors.
UPDATE public.profiles
SET parent_consent_status = 'not_required',
    social_features_enabled = true
WHERE age_band = 'adult'
  AND COALESCE(is_banned, false) = false
  AND tos_version = 'v1'
  AND privacy_version = 'v1'
  AND social_features_enabled IS NOT true;
