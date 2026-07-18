/*
# Create court_bookings table for community court scheduling

## Purpose
CourtConnect does not officially reserve public courts. This table is a
community-coordination tool so players can see when others plan to use a
court and avoid overlapping times. It is NOT a reservation system and
carries no guarantee of court availability.

## New Table: court_bookings
- id (uuid, primary key)
- court_id (uuid, FK -> courts.id ON DELETE CASCADE) — which court
- user_id (uuid, NOT NULL DEFAULT auth.uid(), FK -> auth.users) — who created it
- player_name (text, not null) — display name of the booking player
- opponent_name (text, not null) — display name of the opponent
- match_type (text, not null) — 'Singles' | 'Doubles' | 'Practice' | 'Hitting'
- court_number (text, nullable) — optional specific court number/label
- booking_date (date, not null) — the calendar day
- start_time (time, not null) — start of the slot
- end_time (time, not null) — end of the slot
- notes (text, nullable) — optional notes
- status (text, not null default 'Scheduled') — 'Scheduled' | 'Cancelled'
- created_at (timestamptz default now())
- updated_at (timestamptz default now())

## Security (RLS)
- Enable RLS on court_bookings.
- SELECT: any authenticated user can read (community schedule is shared).
- INSERT: authenticated users can insert only their own rows (auth.uid() = user_id).
- UPDATE: authenticated users can update only their own rows (used to cancel).
- DELETE: authenticated users can delete only their own rows.

## Indexes
- court_bookings_court_date on (court_id, booking_date) for schedule lookups
- court_bookings_user on (user_id) for "my bookings"
- court_bookings_status on (status)

## Notes
1. user_id defaults to auth.uid() so client inserts that omit user_id succeed.
2. Overlap detection is performed client-side before insert (see SchedulingPage).
3. Cancellation is a status update to 'Cancelled', not a row delete, to keep history.
*/

CREATE TABLE IF NOT EXISTS court_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  opponent_name TEXT NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('Singles', 'Doubles', 'Practice', 'Hitting')),
  court_number TEXT,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE court_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "court_bookings_select_all" ON court_bookings;
CREATE POLICY "court_bookings_select_all" ON court_bookings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "court_bookings_insert_own" ON court_bookings;
CREATE POLICY "court_bookings_insert_own" ON court_bookings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "court_bookings_update_own" ON court_bookings;
CREATE POLICY "court_bookings_update_own" ON court_bookings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "court_bookings_delete_own" ON court_bookings;
CREATE POLICY "court_bookings_delete_own" ON court_bookings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_court_bookings_court_date ON court_bookings(court_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_court_bookings_user ON court_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_court_bookings_status ON court_bookings(status);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'court_bookings_updated_at') THEN
    CREATE TRIGGER court_bookings_updated_at BEFORE UPDATE ON court_bookings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END
$$;
