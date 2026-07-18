/*
# Allow anonymous (logged-out) read access to courts and court_bookings

## Purpose
The Courts page and the Schedule page must be viewable without logging in.
The existing SELECT policies on `courts` and `court_bookings` are scoped
`TO authenticated` only, which means anonymous visitors get zero rows back
(RLS silently filters everything out) even when data exists in the table.
This migration replaces those SELECT policies with ones that also cover
the `anon` role, so browsing is public while writes remain gated on
`auth.uid()` exactly as before. No existing INSERT/UPDATE/DELETE policies
are changed.

## Changes
- courts: replace "courts_select_all" with a SELECT policy for anon + authenticated
- court_bookings: replace "court_bookings_select_all" with a SELECT policy for anon + authenticated
*/

DROP POLICY IF EXISTS "courts_select_all" ON courts;
CREATE POLICY "courts_select_public" ON courts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "court_bookings_select_all" ON court_bookings;
CREATE POLICY "court_bookings_select_public" ON court_bookings FOR SELECT
  TO anon, authenticated USING (true);
