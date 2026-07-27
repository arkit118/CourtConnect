/*
# Phase 1 Legal MVP - profile legal/safety fields

## Purpose
Adds the columns CourtConnect needs to (a) block under-13 signups,
(b) record Terms of Service / Privacy Policy acceptance, and
(c) support basic account banning for moderation. This does NOT add
parental consent flows, chat, or matching - those are future Phase 3
work. Profile creation continues to happen app-side after signup
(see AuthContext.tsx); this migration does not add or touch any
auth.users trigger or public.handle_new_user() function.

## New columns on public.profiles
- date_of_birth date - used to compute age_band at signup
- age_band text - 'minor' (13-17) or 'adult' (18+), nullable for
  existing rows created before this field existed
- tos_accepted_at timestamptz - when the user accepted the Terms
- tos_version text - which Terms version was accepted (e.g. 'v1')
- privacy_accepted_at timestamptz - when the user accepted the Privacy Policy
- privacy_version text - which Privacy Policy version was accepted
- safety_acknowledged_at timestamptz - when the user acknowledged the Safety page
- is_banned boolean not null default false - moderation flag
- banned_at timestamptz - when a ban was applied
- ban_reason text - why the account was banned

## Notes on constraints
age_band gets a CHECK constraint scoped to allow NULL (for legacy rows)
or one of 'minor'/'adult', so it never breaks existing data. No NOT NULL
constraints are added to any of the new nullable columns, so existing
rows remain valid without backfill. is_banned is safe to make NOT NULL
DEFAULT false since Postgres backfills the default for existing rows
when a column is added this way.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_band TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tos_version TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_version TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS safety_acknowledged_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- Normalize any unexpected existing values before adding the check
-- constraint, so this migration can never fail on data it didn't create.
UPDATE public.profiles
SET age_band = NULL
WHERE age_band IS NOT NULL AND age_band NOT IN ('minor', 'adult');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_age_band_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_age_band_check
  CHECK (age_band IS NULL OR age_band IN ('minor', 'adult'));

CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);
