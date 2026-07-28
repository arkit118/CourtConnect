/*
# Phase 3 - close a real pre-existing privilege-escalation gap on profiles

## The bug
public.profiles has had this policy since migration 001:

  CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
    TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

RLS policies are row-scoped, not column-scoped. This policy correctly
restricts *which row* a user can update (their own), but places no limit
on *which columns*. Any authenticated user can already call, e.g.:

  supabase.from('profiles').update({ is_banned: false }).eq('id', user.id)
  supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id)

...directly from a browser console, and it succeeds today, because the
policy never inspects which columns changed. This has been true since
Phase 1/2 (is_banned, role) but was a lower-severity data-integrity issue
until now.

## Why Phase 3 makes it critical
This migration set adds age_band-gated matching and parent-consent-gated
chat, enforced by triggers on matches/messages that trust
profiles.age_band, profiles.social_features_enabled,
profiles.matching_enabled, profiles.is_banned, and profiles.role. If a
user can self-write any of those columns, they can trivially defeat every
safety rule those triggers are meant to enforce - e.g. a banned user
un-banning themselves, an adult setting age_band = 'minor' to be matched
with children, or a user granting themselves role = 'admin'. A
database-level safety net that trusts data the same database lets anyone
overwrite is not a safety net.

## The fix
A BEFORE INSERT OR UPDATE trigger on profiles that:
- On INSERT: forces safe defaults for every sensitive column regardless
  of what the client sent (role='player', is_banned=false, banned_at/
  ban_reason=null, social_features_enabled=false, matching_enabled=true,
  parent_consent_status='not_required' and its related fields null), and
  derives age_band from date_of_birth server-side (using the database's
  own clock) rather than trusting a client-supplied age_band - including
  re-enforcing the under-13 signup block at the database layer, in case
  a client ever bypasses the app-side check in AuthContext.signUp.
- On UPDATE: pins every sensitive column back to its previous (OLD)
  value, UNLESS either (a) a transaction-local flag
  (app.bypass_profile_protection) has been set - which only the SECURITY
  DEFINER RPC functions added in 014_social_rpcs.sql do, immediately
  before making a deliberate, validated change to one of these fields -
  or (b) the update is not coming through PostgREST's authenticated API
  role at all, i.e. auth.uid() is NULL. That covers the Supabase
  dashboard's Table Editor/SQL Editor (which connect directly as a
  superuser and never set the request.jwt.claims that auth.uid() reads
  from) and service_role access, so the existing Phase 2 moderation
  runbook - ban a user by editing profiles.is_banned directly in the
  Table Editor - keeps working exactly as documented. The bypass flag is
  set with set_config(..., true) (transaction-local), so it can never
  leak into an unrelated statement or a pooled connection's next request.

## What is NOT protected (unchanged, self-service exactly as before)
name, bio, avatar_url, home_town, skill_level, utr_rating,
preferred_play_style, availability, favorite_courts, years_playing,
tos_accepted_at, tos_version, privacy_accepted_at, privacy_version,
safety_acknowledged_at, chat_safety_acknowledged_at. None of these grant
privilege or bypass a safety check, and ProfileEditPage/LegalGateModal
already update several of them directly from the client - this trigger
does not change that behavior at all.

## What IS protected
is_banned, banned_at, ban_reason, role, age_band, date_of_birth,
social_features_enabled, matching_enabled, parent_consent_status,
parent_consent_requested_at, parent_consent_decided_at,
parent_consent_decision.

This is additive and non-destructive: it does not alter any column type,
does not change existing data, and every legitimate existing write path
(profile edits, Terms acceptance, admin banning via the Supabase
dashboard/service_role, which bypasses RLS and triggers-via-RLS-context
concerns entirely) keeps working unchanged.
*/

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

    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE'
  -- Allow through untouched when explicitly bypassed by a trusted RPC, or
  -- when this isn't a normal end-user API update at all (dashboard Table
  -- Editor / SQL Editor / service_role - none of these set auth.uid()).
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_sensitive_profile_columns_trigger ON public.profiles;
CREATE TRIGGER protect_sensitive_profile_columns_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_sensitive_profile_columns();
