/*
# Extend courts.surface_type check constraint and seed Livingston High School Courts

## Purpose
The frontend (CourtsPage/SchedulingPage) already renders labels/colors for
'carpet' and 'other' surface types (see surfaceLabels/surfaceColors in
src/pages/CourtsPage.tsx and the Court type in src/lib/supabase.ts), but the
original check constraint from 001_full_schema.sql only allowed
('hard', 'clay', 'grass', 'synthetic'). This migration extends the
constraint to match what the app already supports, and seeds/updates the
Livingston High School Courts row so it appears on both the Courts page and
the Schedule page dropdown.

## Important note on casing
The app's existing surface_type values are lowercase ('hard', 'clay', etc.)
and every label/color lookup in the frontend is keyed on lowercase values.
This migration keeps that convention (surface_type = 'hard') rather than
'Hard', so the court renders with the correct label and badge color. If the
row was previously inserted with a capitalized value, this migration
normalizes it back to lowercase.

## Changes
- Drop and recreate the surface_type check constraint to also allow
  'carpet' and 'other'.
- Upsert the Livingston High School Courts row by its fixed id.
*/

ALTER TABLE courts DROP CONSTRAINT IF EXISTS courts_surface_type_check;
ALTER TABLE courts ADD CONSTRAINT courts_surface_type_check
  CHECK (surface_type IN ('hard', 'clay', 'grass', 'synthetic', 'carpet', 'other'));

INSERT INTO courts (
  id, name, address, town, surface_type, num_courts, has_lights, booking_url, description
) VALUES (
  '06ad835b-b5f4-45a4-9c19-a28fb1261324',
  'Livingston High School Courts',
  '30 Robert H. Harp Drive, Livingston, NJ 07039',
  'Livingston',
  'hard',
  6,
  false,
  NULL,
  'Outdoor hard courts used by Livingston High School and local players.'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  town = EXCLUDED.town,
  surface_type = EXCLUDED.surface_type,
  num_courts = EXCLUDED.num_courts,
  has_lights = EXCLUDED.has_lights,
  booking_url = EXCLUDED.booking_url,
  description = EXCLUDED.description,
  updated_at = NOW();
