/*
# App Review hardening - basic objectionable-content filter (server-side)

## Why
Apple's Guideline 2.1 review of the TestFlight build flagged that
user-generated text (chat messages, profile bios, gear listings, schedule
notes, event descriptions) needs at least a basic objectionable-content
filter, on top of the existing report/block tools and manual moderation
(docs/moderation-runbook.md). src/lib/contentFilter.ts already does this
client-side for immediate feedback; this migration adds the same check as
a database trigger so it's enforced even if a client bypasses the app's
own JS (a direct API call, a modified build, etc.) - the actual security
boundary always has to be server-side.

## Scope and design
Deliberately narrow and severity-focused (slurs, explicit sexual
solicitation, hard profanity) rather than a broad topic blocklist, so
normal tennis/community language is never affected - see the term list
below and src/lib/contentFilter.ts's header comment for the same
reasoning. Whole-word matching only (word boundaries via \m/\M), case
insensitive, so it can never fire on a substring inside an unrelated word.

Applied to exactly the free-text fields a user directly authors and other
members can see: messages.body, profiles.bio, gear_listings.title/
description, court_bookings.notes, events.description/rules/faq. Not
applied to reports.details (an author's own report to CourtConnect staff,
not shown to other users, and blocking it would make it impossible to
accurately describe the abusive content being reported).

One explicit trigger function per table (rather than a single generic
reflective one) - simpler to read and verify correctly than dynamic
column lookups, at the cost of a little repetition across five small
functions.

A blocked write raises a clear Postgres exception, which the frontend
already surfaces via its normal error-toast handling on every one of
these insert/update calls - no frontend change required for the
server-side layer to be effective, though src/lib/contentFilter.ts's
client-side check (same category of terms) is what most users will
actually see, since it runs before the request is even sent.
*/

CREATE OR REPLACE FUNCTION public.contains_blocked_content(p_text TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_text IS NOT NULL AND p_text ~* (
    '\m(fuck|shit|bitch|asshole|cunt|dick|pussy|bastard|nigger|nigga|' ||
    'faggot|retard|whore|slut|kill yourself|kys)\M'
  );
$$;

CREATE OR REPLACE FUNCTION public.reject_blocked_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.contains_blocked_content(NEW.body) THEN
    RAISE EXCEPTION 'This text contains content that is not allowed on CourtConnect. Please revise and try again.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_content_filter ON public.messages;
CREATE TRIGGER messages_content_filter
  BEFORE INSERT OR UPDATE OF body ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_message();

CREATE OR REPLACE FUNCTION public.reject_blocked_profile_bio()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.contains_blocked_content(NEW.bio) THEN
    RAISE EXCEPTION 'This text contains content that is not allowed on CourtConnect. Please revise and try again.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_content_filter ON public.profiles;
CREATE TRIGGER profiles_content_filter
  BEFORE INSERT OR UPDATE OF bio ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_profile_bio();

CREATE OR REPLACE FUNCTION public.reject_blocked_gear_listing()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.contains_blocked_content(NEW.title) OR public.contains_blocked_content(NEW.description) THEN
    RAISE EXCEPTION 'This text contains content that is not allowed on CourtConnect. Please revise and try again.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gear_listings_content_filter ON public.gear_listings;
CREATE TRIGGER gear_listings_content_filter
  BEFORE INSERT OR UPDATE OF title, description ON public.gear_listings
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_gear_listing();

CREATE OR REPLACE FUNCTION public.reject_blocked_court_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.contains_blocked_content(NEW.notes) THEN
    RAISE EXCEPTION 'This text contains content that is not allowed on CourtConnect. Please revise and try again.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS court_bookings_content_filter ON public.court_bookings;
CREATE TRIGGER court_bookings_content_filter
  BEFORE INSERT OR UPDATE OF notes ON public.court_bookings
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_court_booking();

CREATE OR REPLACE FUNCTION public.reject_blocked_event_content()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.contains_blocked_content(NEW.description)
     OR public.contains_blocked_content(NEW.rules)
     OR public.contains_blocked_content(NEW.faq) THEN
    RAISE EXCEPTION 'This text contains content that is not allowed on CourtConnect. Please revise and try again.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_content_filter ON public.events;
CREATE TRIGGER events_content_filter
  BEFORE INSERT OR UPDATE OF description, rules, faq ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_event_content();
