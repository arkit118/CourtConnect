/*
# Phase 2 Safety/Moderation MVP - generic reports table

## Purpose
A single generic reports table that covers users, gear listings, court
bookings, events, courts, and general/safety reports for the features
that exist today. This is NOT the future Phase 3 chat-specific report
table (block/report inside chat) - that is separate future work.

## New table: public.reports
- id uuid primary key
- reporter_id uuid -> profiles(id), the person filing the report
- reported_user_id uuid -> profiles(id), nullable - who/whose content is reported
- report_type text - 'user' | 'gear_listing' | 'court_booking' | 'event' | 'court' | 'general'
- target_id uuid, nullable - id of the reported row (listing id, booking id, etc.)
- reason text - required, short reason category
- details text - optional free text
- status text - 'open' | 'reviewed' | 'actioned' | 'dismissed', default 'open'
- admin_notes text - for manual admin review in the Supabase Table Editor
- created_at / updated_at timestamptz

## Security (RLS)
- RLS is enabled.
- INSERT: authenticated users can insert only rows where
  auth.uid() = reporter_id.
- SELECT: authenticated users can read only their own submitted reports
  (auth.uid() = reporter_id). This is required because the frontend
  report form uses .select() after insert to read back the created row;
  without a SELECT policy that call would fail even though the insert
  succeeded. Reports are never publicly readable.
- No UPDATE/DELETE policies for normal users - only actionable via the
  Supabase Table Editor by the project owner for this v1 (service_role
  bypasses RLS entirely and is never used from the app).
*/

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL DEFAULT 'general',
  target_id UUID,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_report_type_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_report_type_check
  CHECK (report_type IN ('user', 'gear_listing', 'court_booking', 'event', 'court', 'general'));

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_status_check
  CHECK (status IN ('open', 'reviewed', 'actioned', 'dismissed'));

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
CREATE POLICY "reports_insert_own" ON public.reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own" ON public.reports FOR SELECT
  TO authenticated USING (auth.uid() = reporter_id);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_type ON public.reports(report_type);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'reports_updated_at') THEN
    CREATE TRIGGER reports_updated_at BEFORE UPDATE ON public.reports
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END
$$;
