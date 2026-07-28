/*
# Phase 3 - extend reports.report_type for matching/chat

## Purpose
Reuses the existing public.reports table (created in Phase 2) rather
than creating a second reports table. Adds 'match' and 'message' to the
allowed report_type values so ReportButton can report a match or a chat
message the same way it already reports a court booking, gear listing,
event, court, or user. No other changes to reports - RLS (insert/select
own rows only, never public, no service_role) is unchanged and was
already audited as correct in the Phase 2 hardening pass.
*/

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_report_type_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_report_type_check
  CHECK (report_type IN ('user', 'gear_listing', 'court_booking', 'event', 'court', 'general', 'match', 'message'));
