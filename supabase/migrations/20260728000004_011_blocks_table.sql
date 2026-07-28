/*
# Phase 3 - blocks table

## Purpose
Lets a user block another user, which the matches/messages triggers
already check (see 010_matches_table.sql / 012_messages_table.sql). This
migration also adds a small AFTER INSERT trigger that automatically
transitions any existing pending/active match between the two users to
status = 'blocked', so blocking someone always locks any open match/chat
in one action rather than requiring the app to remember to do both.

## Columns
blocker_id, blocked_id, created_at - composite primary key
(blocker_id, blocked_id) so a given pair can only be blocked once (an
upsert-friendly natural key, and re-blocking is a harmless no-op).

## RLS
- INSERT: only where blocker_id = auth.uid().
- SELECT: only rows where you are the blocker or the blocked party -
  needed so a blocked user's candidate discovery/match triggers can
  correctly exclude the person who blocked them, without exposing the
  full blocks table to everyone.
- DELETE: only your own outgoing block (unblock).
- No UPDATE policy - blocks are create/delete only.
*/

CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT blocks_distinct_users CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id ON public.blocks(blocked_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocks_insert_own" ON public.blocks;
CREATE POLICY "blocks_insert_own" ON public.blocks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocks_select_own" ON public.blocks;
CREATE POLICY "blocks_select_own" ON public.blocks FOR SELECT
  TO authenticated USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

DROP POLICY IF EXISTS "blocks_delete_own" ON public.blocks;
CREATE POLICY "blocks_delete_own" ON public.blocks FOR DELETE
  TO authenticated USING (auth.uid() = blocker_id);

CREATE OR REPLACE FUNCTION public.lock_matches_on_block()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.matches
  SET status = 'blocked', blocked_at = NOW()
  WHERE status IN ('pending', 'active')
    AND ((user_a = NEW.blocker_id AND user_b = NEW.blocked_id)
      OR (user_a = NEW.blocked_id AND user_b = NEW.blocker_id));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_matches_on_block_trigger ON public.blocks;
CREATE TRIGGER lock_matches_on_block_trigger
  AFTER INSERT ON public.blocks
  FOR EACH ROW EXECUTE FUNCTION public.lock_matches_on_block();
