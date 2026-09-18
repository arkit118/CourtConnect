// Shared town list for the pilot's service area. Deliberately explicit
// real towns (not a vague "Essex County" or "NJ-wide" claim) - CourtConnect
// began in Livingston, NJ and has since expanded to the surrounding towns
// listed here.
//
// Bare town names (no ", NJ" suffix) to match what's actually stored in
// courts.town and events.town (see e.g.
// supabase/migrations/20260718000002_005_extend_surface_type_and_seed_livingston.sql,
// which seeds 'Livingston', not 'Livingston, NJ'). CourtsPage/EventsPage's
// town filters used to hardcode ['Livingston, NJ'] while comparing
// directly against court.town/event.town with ===, which never matched
// the actual stored 'Livingston' - the filter silently returned nothing
// for any town. Standardizing on the bare format here fixes that as a
// side effect of adding more towns.
export const NJ_TOWNS = [
  'Livingston',
  'West Orange',
  'Millburn',
  'Short Hills',
  'Maplewood',
  'South Orange',
  'Caldwell',
  'West Caldwell',
  'North Caldwell',
  'Roseland',
  'Fairfield',
  'Verona',
  'Montclair',
  'Bloomfield',
  'Nutley',
  'Newark',
  'Summit',
  'Chatham',
  'Florham Park',
  'East Hanover',
  'Parsippany',
  'Madison',
] as const;
