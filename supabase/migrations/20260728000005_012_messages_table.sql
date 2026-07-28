/*
# Phase 3 - messages table with a database-enforced safety trigger

## Purpose
Chat messages within an active match. The BEFORE INSERT trigger is the
hard safety boundary for who can send a message and when - not the
frontend chat UI.

## Columns
id, match_id, sender_id, body, created_at, deleted_at, reported - as
specified. body is NOT NULL at the column level; the trigger additionally
rejects an empty-after-trim body and an overlong one (2000 chars), since
a NOT NULL constraint alone would still accept ''.

## Trigger behavior (enforce_message_safety)
Rejects the insert if any of:
1. body is empty after trim, or over 2000 characters
2. the referenced match does not exist
3. match.status is not 'active'
4. sender_id is not one of the match's two participants
5. sender is banned
6. sender has not accepted Terms v1 / Privacy v1
7. sender.social_features_enabled is false
8. either participant has blocked the other
9. the match's recorded age_band no longer matches both current
   participant profiles' age_band (defense in depth against a profile's
   age_band drifting after the match was created)

## RLS
- SELECT: only for matches you participate in (via a subquery against
  matches, which itself is already scoped to participants by its own
  RLS - so this is consistent, not an additional trust boundary).
- INSERT: only where sender_id = auth.uid() and you are a participant of
  that match.
- UPDATE: only your own messages, and only for a soft-delete (setting
  deleted_at) - body/sender_id/match_id are not meant to change after
  the fact.
- No DELETE policy (soft-delete via UPDATE deleted_at instead, so a
  report always has something to point at).
- No public/anon access at all.
*/

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  reported BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_messages_match_id ON public.messages(match_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

CREATE OR REPLACE FUNCTION public.enforce_message_safety()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  m public.matches%ROWTYPE;
  sender public.profiles%ROWTYPE;
  other_id UUID;
BEGIN
  IF trim(NEW.body) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  IF length(NEW.body) > 2000 THEN
    RAISE EXCEPTION 'Message is too long (max 2000 characters)';
  END IF;

  SELECT * INTO m FROM public.matches WHERE id = NEW.match_id;
  IF m.id IS NULL THEN
    RAISE EXCEPTION 'Match does not exist';
  END IF;

  IF m.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'This match is not active';
  END IF;

  IF NEW.sender_id IS DISTINCT FROM m.user_a AND NEW.sender_id IS DISTINCT FROM m.user_b THEN
    RAISE EXCEPTION 'Sender is not part of this match';
  END IF;

  SELECT * INTO sender FROM public.profiles WHERE id = NEW.sender_id;
  IF sender.id IS NULL THEN
    RAISE EXCEPTION 'Sender profile not found';
  END IF;

  IF COALESCE(sender.is_banned, false) THEN
    RAISE EXCEPTION 'Banned users cannot send messages';
  END IF;

  IF sender.tos_version IS DISTINCT FROM 'v1' OR sender.privacy_version IS DISTINCT FROM 'v1' THEN
    RAISE EXCEPTION 'Sender must accept the current Terms and Privacy Policy';
  END IF;

  IF NOT sender.social_features_enabled THEN
    RAISE EXCEPTION 'Sender does not have social features enabled';
  END IF;

  other_id := CASE WHEN NEW.sender_id = m.user_a THEN m.user_b ELSE m.user_a END;

  IF EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = NEW.sender_id AND blocked_id = other_id)
       OR (blocker_id = other_id AND blocked_id = NEW.sender_id)
  ) THEN
    RAISE EXCEPTION 'Cannot message a blocked user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pa, public.profiles pb
    WHERE pa.id = m.user_a AND pb.id = m.user_b
      AND pa.age_band = m.age_band AND pb.age_band = m.age_band
  ) THEN
    RAISE EXCEPTION 'Match age band no longer matches participant profiles';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_message_safety_trigger ON public.messages;
CREATE TRIGGER enforce_message_safety_trigger
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_safety();

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant" ON public.messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = messages.match_id
        AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_insert_sender" ON public.messages;
CREATE POLICY "messages_insert_sender" ON public.messages FOR INSERT
  TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = messages.match_id
        AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_update_own_soft_delete" ON public.messages;
CREATE POLICY "messages_update_own_soft_delete" ON public.messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- RLS is row-scoped, not column-scoped, so the policy above alone would
-- let a sender rewrite body/reported/created_at on their own row (e.g.
-- clearing `reported = true` on a message someone already flagged, to
-- hide evidence). Pin every column except deleted_at back to its
-- previous value on any update coming through the normal authenticated
-- API, mirroring the same pattern used for profiles.
CREATE OR REPLACE FUNCTION public.protect_message_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> OLD.sender_id THEN
    RETURN NEW;
  END IF;

  NEW.match_id := OLD.match_id;
  NEW.sender_id := OLD.sender_id;
  NEW.body := OLD.body;
  NEW.created_at := OLD.created_at;
  NEW.reported := OLD.reported;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_message_columns_trigger ON public.messages;
CREATE TRIGGER protect_message_columns_trigger
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.protect_message_columns();
