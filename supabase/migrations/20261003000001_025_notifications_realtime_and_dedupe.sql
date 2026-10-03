/*
# Notifications: enable realtime delivery, collapse chat notifications

Follow-up to 20260918000002_023_notifications.sql. Requires 023.

## 1. Realtime was never enabled for public.notifications
Supabase Realtime only streams postgres_changes for tables that are members
of the `supabase_realtime` publication. 023 never added
public.notifications to it (no migration in this repo adds any table to
it), so the bell's realtime subscription (src/hooks/useNotifications.ts)
connected but never received an event. Combined with the hook only
fetching once on mount, a new notification didn't appear until the app
was fully reloaded - on iOS, where the app stays resident, effectively
never. This adds the table to the publication (idempotently, and only if
the publication exists). The frontend now also refetches on foreground/
reconnect and on a slow poll, so delivery doesn't depend on realtime alone.

public.messages gets the same treatment: ChatPage.tsx subscribes to
message INSERTs for live chat, but no migration ever added messages to
the publication either (unless it was toggled on by hand in the
dashboard - the guard below makes this a no-op in that case). Realtime
enforces each table's RLS SELECT policy per subscriber, so this only ever
delivers messages to that match's two participants.

## 2. One unread chat notification per conversation
023 inserted a new notification for every single chat message, so an
active conversation flooded the list and inflated the unread badge. Now
each recipient has at most ONE unread chat_message notification per match:
a new message updates that row (latest preview, bumped timestamp) instead
of adding another. Enforced atomically by a partial unique index +
ON CONFLICT, so concurrent messages can't race into duplicates. Existing
duplicate unread rows are collapsed to the newest first so the index can
be created. Once the user reads it, the next message starts a fresh one.

## 3. Request notifications go stale once acted on
When a pending match is accepted/declined/ended, the recipient's
"New play request" notification for it is marked read, so the badge
doesn't keep counting a request that's already been handled.

All statements are idempotent (IF EXISTS / IF NOT EXISTS / CREATE OR
REPLACE / conditional DO blocks); re-running is a no-op.
*/

-- 1. Realtime publication membership
DO $$
DECLARE
  t TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RETURN;
  END IF;
  FOREACH t IN ARRAY ARRAY['notifications', 'messages'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$$;

-- 2a. Collapse any existing duplicate unread chat notifications (keep newest)
DELETE FROM public.notifications n
USING public.notifications newer
WHERE n.type = 'chat_message'
  AND newer.type = 'chat_message'
  AND n.read_at IS NULL
  AND newer.read_at IS NULL
  AND n.user_id = newer.user_id
  AND n.source_id = newer.source_id
  AND (n.created_at, n.id) < (newer.created_at, newer.id);

-- 2b. At most one unread chat notification per recipient per match
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_one_unread_chat_per_match
  ON public.notifications (user_id, source_id)
  WHERE type = 'chat_message' AND read_at IS NULL;

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
    COALESCE(sender_name, 'Someone') || ' sent you a message',
    left(NEW.body, 140),
    'match',
    NEW.match_id
  )
  ON CONFLICT (user_id, source_id) WHERE type = 'chat_message' AND read_at IS NULL
  DO UPDATE SET
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    created_at = now();

  RETURN NEW;
END;
$$;

-- 3. Same as 023's notify_match_event, plus: when a pending request is
--    resolved, mark the recipient's request notification for it as read.
CREATE OR REPLACE FUNCTION public.notify_match_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  other_name TEXT;
  recipient_id UUID;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    recipient_id := CASE WHEN NEW.requested_by = NEW.user_a THEN NEW.user_b ELSE NEW.user_a END;
    IF recipient_id IS NULL OR recipient_id = NEW.requested_by THEN
      RETURN NEW;
    END IF;
    SELECT name INTO other_name FROM public.profiles WHERE id = NEW.requested_by;
    INSERT INTO public.notifications (user_id, type, title, body, source_type, source_id)
    VALUES (
      recipient_id,
      'match_request',
      'New play request',
      COALESCE(other_name, 'A CourtConnect member') || ' wants to be matched with you.',
      'match',
      NEW.id
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status IS DISTINCT FROM 'pending' THEN
    UPDATE public.notifications
    SET read_at = now()
    WHERE type = 'match_request' AND source_id = NEW.id AND read_at IS NULL;

    IF NEW.status = 'active' AND NEW.requested_by IS NOT NULL THEN
      SELECT name INTO other_name FROM public.profiles
      WHERE id = (CASE WHEN NEW.requested_by = NEW.user_a THEN NEW.user_b ELSE NEW.user_a END);
      INSERT INTO public.notifications (user_id, type, title, body, source_type, source_id)
      VALUES (
        NEW.requested_by,
        'match_accepted',
        'Play request accepted',
        COALESCE(other_name, 'They') || ' accepted your play request. You can chat now.',
        'match',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
