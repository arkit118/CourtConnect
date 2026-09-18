/*
# In-app notifications (no native push yet)

## Purpose
Give users a way to tell, inside the app, when something they'd want to
know about happens: someone sends them a play request, accepts theirs,
sends them a chat message, comments on their event/listing, or a parent/
guardian decides on their consent request. This is deliberately scoped to
in-app only - no APNs/native push in this pass.

## Table
public.notifications - id, user_id, type, title, body, source_type,
source_id, read_at, created_at, exactly as specified. `source_type` +
`source_id` are a loose polymorphic pointer (e.g. ('match', <matches.id>))
so the frontend can deep-link a notification row without a dedicated FK
per source table; neither is validated at the DB level beyond being
text/uuid; the frontend already treats reads defensively (see
useNotifications.ts).

## Why every insert goes through a trigger, never the client
Every notification a user receives is *about* something someone else did
(another user's match request, message, comment, or a parent's consent
decision) - the recipient is never the one performing the write that
should generate their notification. RLS below grants zero INSERT access
to `authenticated`, so the only way a row is created is through the
SECURITY DEFINER trigger functions in this migration, which run with the
privileges of their owner (bypassing RLS) and only ever insert a
notification for the *other* party in an event, computed server-side from
the row that was actually written - never from a value the client could
supply directly. This mirrors the existing enforce_match_safety /
enforce_message_safety pattern of putting the real boundary in the
database, not the frontend.

## Court-time/schedule notifications - deliberately NOT implemented here
court_bookings.opponent_name is free text (see
20260706204712_003_court_bookings.sql) with no opponent_id/recipient
column - there is no real user to notify. Per the task's own instruction
("do not fake notifications to nonexistent users"), no trigger is added
for court_bookings. If a real opponent_id is ever added to that table,
a notification trigger can be added the same way as the others below.

## RLS
- SELECT/UPDATE/DELETE: only your own rows (auth.uid() = user_id).
- No INSERT policy for authenticated/anon at all - see above.

## Graceful degradation
The frontend (useNotifications.ts) treats a missing table (Postgrest
42P01) the same as "zero notifications" rather than crashing, so shipping
frontend code that reads this table is safe even before this migration is
applied to a given environment.
*/

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  source_type TEXT,
  source_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 1. Match/play request received (INSERT ... status = 'pending') and
--    match accepted (UPDATE pending -> active). One trigger covers both
--    since they're both meaningful transitions on the same table.
CREATE OR REPLACE FUNCTION public.notify_match_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_name TEXT;
  recipient_id UUID;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    recipient_id := CASE WHEN NEW.requested_by = NEW.user_a THEN NEW.user_b ELSE NEW.user_a END;
    IF recipient_id IS NULL OR recipient_id = NEW.requested_by THEN
      RETURN NEW;
    END IF;
    SELECT name INTO requester_name FROM public.profiles WHERE id = NEW.requested_by;
    INSERT INTO public.notifications (user_id, type, title, body, source_type, source_id)
    VALUES (
      recipient_id,
      'match_request',
      'New play request',
      COALESCE(requester_name, 'A CourtConnect member') || ' wants to be matched with you.',
      'match',
      NEW.id
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'active' AND NEW.requested_by IS NOT NULL THEN
    SELECT name INTO requester_name FROM public.profiles WHERE id = (CASE WHEN NEW.requested_by = NEW.user_a THEN NEW.user_b ELSE NEW.user_a END);
    INSERT INTO public.notifications (user_id, type, title, body, source_type, source_id)
    VALUES (
      NEW.requested_by,
      'match_accepted',
      'Play request accepted',
      COALESCE(requester_name, 'They') || ' accepted your play request. You can chat now.',
      'match',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_match_event_trigger ON public.matches;
CREATE TRIGGER notify_match_event_trigger
  AFTER INSERT OR UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.notify_match_event();

-- 2. New chat message - notify the other participant. Fires AFTER INSERT,
--    i.e. only once enforce_message_safety_trigger (BEFORE INSERT) has
--    already accepted the row, so this never fires for a rejected send.
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.matches%ROWTYPE;
  sender_name TEXT;
  recipient_id UUID;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = NEW.match_id;
  IF m.id IS NULL THEN
    RETURN NEW;
  END IF;

  recipient_id := CASE WHEN NEW.sender_id = m.user_a THEN m.user_b ELSE m.user_a END;
  SELECT name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, title, body, source_type, source_id)
  VALUES (
    recipient_id,
    'chat_message',
    COALESCE(sender_name, 'New message') || ' sent you a message',
    left(NEW.body, 140),
    'match',
    NEW.match_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_chat_message_trigger ON public.messages;
CREATE TRIGGER notify_chat_message_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_chat_message();

-- 3. New comment on an event or gear listing - notify the event organizer
--    or listing seller, never the commenter themselves.
CREATE OR REPLACE FUNCTION public.notify_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
  commenter_name TEXT;
  target_title TEXT;
BEGIN
  IF NEW.commentable_type = 'event' THEN
    SELECT organizer_id, title INTO owner_id, target_title FROM public.events WHERE id = NEW.commentable_id;
  ELSIF NEW.commentable_type = 'listing' THEN
    SELECT seller_id, title INTO owner_id, target_title FROM public.gear_listings WHERE id = NEW.commentable_id;
  ELSE
    RETURN NEW;
  END IF;

  IF owner_id IS NULL OR owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT name INTO commenter_name FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, source_type, source_id)
  VALUES (
    owner_id,
    'comment',
    COALESCE(commenter_name, 'Someone') || ' commented on ' || COALESCE(target_title, 'your ' || NEW.commentable_type),
    left(NEW.content, 140),
    NEW.commentable_type,
    NEW.commentable_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_comment_trigger ON public.comments;
CREATE TRIGGER notify_comment_trigger
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment();

-- 4. Parent/guardian consent decision - notify the minor whose request it
--    was. Fires off profiles.parent_consent_decision actually changing to
--    a final value, which is exactly what resolve_parent_consent() sets
--    (see 20260728000008_015_social_rpcs.sql) - independent of whichever
--    code path performs the update.
CREATE OR REPLACE FUNCTION public.notify_parent_consent_decided()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_consent_decision IS DISTINCT FROM OLD.parent_consent_decision
     AND NEW.parent_consent_decision IN ('approved', 'declined') THEN
    INSERT INTO public.notifications (user_id, type, title, body, source_type, source_id)
    VALUES (
      NEW.id,
      'parent_consent_decided',
      CASE WHEN NEW.parent_consent_decision = 'approved'
        THEN 'Your parent/guardian approved matching & chat'
        ELSE 'Your parent/guardian declined the request'
      END,
      CASE WHEN NEW.parent_consent_decision = 'approved'
        THEN 'Player matching and chat are now available on your account.'
        ELSE 'Player matching and chat are not available right now. You can ask again with a different email.'
      END,
      'profile',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_parent_consent_decided_trigger ON public.profiles;
CREATE TRIGGER notify_parent_consent_decided_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_parent_consent_decided();
