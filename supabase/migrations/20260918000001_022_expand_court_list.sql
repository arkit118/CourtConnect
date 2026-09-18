/*
# Expand public court list to the service area beyond Livingston

## Purpose
CourtConnect's town coverage (see src/lib/towns.ts) has expanded beyond
Livingston to nearby North Jersey towns, but the `courts` table only ever
had one seeded row (Livingston High School Courts). This migration adds
public/municipal/county/school courts across that expanded area so the
Courts page and Schedule dropdown have real options in those towns.

## Sourcing and what was deliberately left out
Every row below is a public municipal, county, or school-adjacent facility
- no private clubs (Orange Lawn, Centercourt, Bradford, etc.) and no paid
indoor facilities. Court counts, addresses, and lighting were checked
against official municipal/county recreation pages and cross-referenced
against independent court-listing sites where a town's own site wasn't
directly reachable; num_courts and has_lights were corrected from initial
estimates in a few cases (e.g. Maplewood's Memorial Park has 5 courts, not
3; Roseland's Harrison Ave complex has 2 tennis courts, not 4, but they
are in fact lighted). `has_lights` is left false wherever lighting
couldn't be confirmed from an official source, per the "don't claim it
unless verified" rule - this is a real undercount in a few cases (e.g.
Brookdale Park has some lit courts) but never an overclaim.

Two originally-considered candidates are NOT included here:
- DeHart Park (Maplewood) - sources conflicted on both court count and
  lighting with no authoritative page resolving it; skipped rather than
  guessing.
- "Cedar Grove Community Park" - every court-listing result for this name
  places it in Little Falls, NJ, not Cedar Grove, NJ; skipped as a likely
  name collision rather than risk an incorrect town/address pairing.
  ('Cedar Grove' was still added to src/lib/towns.ts separately, since a
  resident can select it as a home town regardless of court data.)

`booking_url` is only set where an official municipal/county reservation
or rules page was found (e.g. Livingston's and Maplewood's own
tennis/pickleball rules pages, Millburn's published court rules PDF,
Essex County's own park pages for the county-owned parks) - never a
third-party court-directory site.

## Idempotency
Each row is upserted by a fixed id via ON CONFLICT, same pattern as
20260718000002_005_extend_surface_type_and_seed_livingston.sql, so
re-running this migration is a no-op rather than a duplicate insert.
*/

INSERT INTO courts (id, name, address, town, surface_type, num_courts, has_lights, booking_url, description) VALUES
  ('d7824ca7-9247-4c6e-b7b2-b246d3566ed2', 'Northland Recreation Center Courts', '3 Madison Court, Livingston, NJ 07039', 'Livingston', 'hard', 4, false, 'https://www.livingstonnj.org/993/Tennis-Pickleball-Courts---Usage-Guideli', 'Livingston Township tennis courts at Northland Recreation Center. Registration may be required; Courts 1-4 are open for Round Robin play 9 a.m. to dusk. No private lessons.'),
  ('974b2ed6-693a-4535-a6eb-48f88e0d4e70', 'Degnan Park', '650 Pleasant Valley Way, West Orange, NJ 07052', 'West Orange', 'hard', 5, true, NULL, 'Public West Orange park with 5 lighted tennis courts, playground, pond, basketball court, and field areas.'),
  ('693366a9-4430-4945-bc98-7794359ccbb0', 'O''Connor Park', '59 Lorelei Rd, West Orange, NJ 07052', 'West Orange', 'hard', 4, true, NULL, 'Public West Orange park with 4 lighted tennis courts, fields, basketball courts, walking path, and playground.'),
  ('d32b292b-f531-4330-aeaf-de71905de7cf', 'Taylor Park Tennis Courts', 'Main St & Taylor St, Millburn, NJ 07041', 'Millburn', 'hard', 4, false, 'https://twp.millburn.nj.us/DocumentCenter/View/6814/Tennis-Pickleball-Rules---2026-PDF', 'Millburn Township tennis courts in Taylor Park. Recreation Department membership/permit rules apply.'),
  ('b4cf41ee-e8a8-430c-bb07-0057adeccd2c', 'Gero Park Tennis Courts', '357 White Oak Ridge Road, Short Hills, NJ 07078', 'Short Hills', 'hard', 4, true, 'https://twp.millburn.nj.us/DocumentCenter/View/6814/Tennis-Pickleball-Rules---2026-PDF', 'Millburn Township lighted tennis courts at Gero Park, alongside the township pool and golf course. Recreation Department membership/permit rules apply.'),
  ('ed759057-14ed-4e0f-8a93-43f8229f949f', 'Slayton Field Tennis Courts', '29 Glen Ave, Millburn, NJ 07041', 'Millburn', 'hard', 2, false, 'https://twp.millburn.nj.us/DocumentCenter/View/6814/Tennis-Pickleball-Rules---2026-PDF', 'Millburn Township tennis courts at Slayton Field, lined for both tennis and pickleball. Recreation Department membership/permit rules apply.'),
  ('1002af57-e56a-4778-b774-66ae95aae330', 'Memorial Park Tennis Courts', '580 Valley St, Maplewood, NJ 07040', 'Maplewood', 'hard', 5, true, 'https://www.maplewoodnj.gov/government/community-services/recreation/court-reserve', 'Public Maplewood park with 5 lighted tennis courts plus ball fields, an amphitheater, and a community pool.'),
  ('f2c9ce44-1a99-4ccf-842b-94a8022a5dd7', 'Maplecrest Park Tennis Courts', '237 Oakland Rd, Maplewood, NJ 07040', 'Maplewood', 'hard', 3, false, 'https://www.maplewoodnj.gov/government/community-services/recreation/court-reserve', 'Public Maplewood park with 3 tennis courts and other recreation facilities.'),
  ('6be35a5c-350f-4dac-918f-c39b87a09a87', 'Meadowland Park Tennis Courts (Kenny Graham Courts)', '5 Mead St, South Orange, NJ 07079', 'South Orange', 'hard', 8, false, NULL, 'Public South Orange tennis courts at Meadowland Park, adjacent to the Baird Community Center. Registration rules may apply.'),
  ('d7243cb3-5a1d-4266-b797-a90e32f71c39', 'West Caldwell Memorial Park', '16 Fairmount Rd, West Caldwell, NJ 07006', 'West Caldwell', 'hard', 4, false, NULL, 'Public West Caldwell park with 4 tennis courts.'),
  ('7011dcc7-592e-450b-87de-a28c7bc27017', 'Grover Cleveland Park', '69 Brookside Ave, Caldwell, NJ 07006', 'Caldwell', 'hard', 4, true, 'https://essexcountyparks.org/parks/grover-cleveland-park', 'Essex County park with 4 lighted tennis and pickleball courts, plus shuffleboard, ball fields, and picnic areas.'),
  ('e5d7153a-b640-41f7-943c-b069dceb9c7a', 'North Caldwell Recreation Tennis Courts', '141 Gould Ave, North Caldwell, NJ 07006', 'North Caldwell', 'hard', 6, true, 'https://www.northcaldwell.org/recreation-department/pages/tennis-courts', 'North Caldwell municipal tennis courts behind Borough Hall on Gould Avenue, with lighting for extended play.'),
  ('68312e61-39ec-45ea-b662-cd0988f8b889', 'Harrison Avenue Pickleball & Tennis Courts', '19 Harrison Ave, Roseland, NJ 07068', 'Roseland', 'hard', 2, true, 'https://www.roselandnj.org/291/Tennis-Pickleball', 'Roseland public recreation complex with 2 lighted tennis courts plus 4 pickleball courts. Permit rules may apply.'),
  ('70704f7e-6a84-4a82-9ef0-cff55ba74a8b', 'Verona Park Tennis Courts', '102 Park Ave, Verona, NJ 07044', 'Verona', 'hard', 3, false, 'https://essexcountyparks.org/parks/verona-park', 'Essex County park with 3 tennis courts, alongside paddle boats, trails, and a lake.'),
  ('376f1d2b-0f1f-4649-8b3b-2f474e1cf3ea', 'Brookdale Park Tennis Center', 'Watchung Ave & Grove St, Montclair, NJ 07043', 'Montclair', 'hard', 11, false, 'https://essexcountyparks.org/parks/brookdale-park/programs', 'Essex County park spanning Montclair and Bloomfield with 11 tennis courts and a staffed tennis center.'),
  ('0d87d31d-bd0f-45a8-944d-edd0ee19a4ba', 'Glenfield Park Tennis Courts', 'Bloomfield Ave & Maple Ave, Montclair, NJ 07042', 'Montclair', 'hard', 3, false, 'https://essexcountyparks.org/parks/glenfield-park', 'Essex County park in Montclair with 3 recently-renovated tennis courts, plus basketball courts and playgrounds.'),
  ('db249e3e-f599-41e2-a0d6-171a039c0801', 'Florham Park Recreation Complex Courts', '1 Longley Ln, Florham Park, NJ 07932', 'Florham Park', 'hard', 4, true, 'https://www.florhamparknj.gov/departments/Recreation', 'Public Florham Park recreation complex with 4 lighted tennis courts.')
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
