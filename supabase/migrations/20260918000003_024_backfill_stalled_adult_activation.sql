/*
# Re-run the adult social-features backfill for profiles that never completed it

## Diagnosis this migration addresses
Investigated: arkit118@gmail.com sees far fewer candidates on /players than
the number of real profiles in the database. get_match_candidates() (see
20260728000008_015_social_rpcs.sql) is working exactly as designed - it
requires every candidate to have age_band set, social_features_enabled =
true, tos_version/privacy_version = 'v1', and not be banned/blocked/
already matched. None of those checks are the bug; the gap is that a
profile only ever gets social_features_enabled flipped to true through
one of three paths:
  1. upsert_signup_profile() at signup time (20260729000001_016) - only
     exists for signups after that migration shipped.
  2. set_social_age_band(), called lazily the first time a user's own
     session visits a social-gated page (Players/Matches/Chat) - see
     SocialOnboardingGate.tsx's AdultActivationStep/DateOfBirthStep.
  3. The one-time backfill in 20260728000001_008 ("Part B"), which only
     moved forward rows that ALREADY had age_band = 'adult' at the moment
     that migration ran.
A real profile that (a) signed up before upsert_signup_profile existed,
and (b) has never personally opened Players/Matches/Chat since, is
correctly excluded today - not because of a bug, but because the
database genuinely doesn't know their age yet, or knows it but never got
the one-time activation flip. This migration safely closes the second
case (age is already known) without ever guessing at the first.

## What this does - and does NOT do
Two passes, both exact re-applications of logic the codebase already
trusts elsewhere (set_social_age_band / upsert_signup_profile / the
008 Part B backfill) - nothing new is invented:

1. For any row with date_of_birth already set but age_band still NULL
   (a pure data-derivation gap - the age is objectively computable from
   data already on the row, no assumption involved), compute age_band
   using the identical under-13/minor/adult thresholds used everywhere
   else in this schema. Under-13 rows are explicitly left untouched -
   this migration never assigns an age_band to someone who shouldn't
   have an account at all; that is a separate, existing moderation
   concern (see docs/moderation-runbook.md), not something to paper over
   here.
2. Re-run the exact 008 "Part B" condition (documented there as safe to
   re-run) for every row now showing age_band = 'adult': if not banned
   and already on Terms v1 / Privacy v1, set social_features_enabled =
   true and parent_consent_status = 'not_required'.

Minors are NEVER auto-enabled by this migration, in either pass - they
still require an approved parent_consent_requests decision, exactly as
today. Nothing here touches tos_version/privacy_version/is_banned/
matching_enabled, or any row where date_of_birth is still NULL (an
account whose age is genuinely unknown stays exactly as unknown as it
was - the only way to resolve that is the real person providing their
date of birth, which this migration cannot and must not fabricate).

## Idempotency
Both passes are plain conditional UPDATEs scoped to rows not already in
the target state - re-running this migration is a no-op the second time.
*/

-- Pass 1: derive age_band from an already-known date_of_birth, wherever
-- it was never computed. Mirrors set_social_age_band's thresholds
-- exactly (20260728000008_015_social_rpcs.sql).
UPDATE public.profiles
SET age_band = CASE
  WHEN DATE_PART('year', AGE(CURRENT_DATE, date_of_birth)) < 18 THEN 'minor'
  ELSE 'adult'
END
WHERE date_of_birth IS NOT NULL
  AND age_band IS NULL
  AND DATE_PART('year', AGE(CURRENT_DATE, date_of_birth)) >= 13;

-- Pass 2: identical condition to 20260728000001_008's "Part B", re-run
-- to catch any row Pass 1 just moved to age_band = 'adult' (or any adult
-- row that otherwise slipped through without ever being activated).
UPDATE public.profiles
SET parent_consent_status = 'not_required',
    social_features_enabled = true
WHERE age_band = 'adult'
  AND COALESCE(is_banned, false) = false
  AND tos_version = 'v1'
  AND privacy_version = 'v1'
  AND social_features_enabled IS NOT true;
