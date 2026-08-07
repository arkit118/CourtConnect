-- Follow-up to 019: that migration's exact-string UPDATE missed rows with
-- incidental whitespace (e.g. 'Livingston ' with a trailing space, found on
-- one existing profile), which is invisible in the UI but fails the exact
-- string-equality filtering these town columns are used for (see
-- 019's header comment). This normalizes anything that is "Livingston"
-- once trimmed and case-folded, across all four town-bearing tables.

UPDATE public.profiles SET home_town = 'Livingston, NJ' WHERE lower(trim(home_town)) = 'livingston';
UPDATE public.courts SET town = 'Livingston, NJ' WHERE lower(trim(town)) = 'livingston';
UPDATE public.events SET town = 'Livingston, NJ' WHERE lower(trim(town)) = 'livingston';
UPDATE public.gear_listings SET town = 'Livingston, NJ' WHERE lower(trim(town)) = 'livingston';
