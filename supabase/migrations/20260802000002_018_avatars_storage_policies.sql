/*
# Post-launch fix - avatars storage bucket + RLS policies

## The bug
Profile photo upload fails with "new row violates row level security
policy" (src/pages/ProfilePage.tsx handleImageUpload / ProfileEditPage's
equivalent, both calling uploadImage('avatars', file, user.id) from
src/lib/storage.ts, which does
supabase.storage.from('avatars').upload(...)).

## Root cause
No migration in this repo has ever created the `avatars` bucket or any
policy on storage.objects for it - grepping every file in
supabase/migrations/ for "avatars", "storage.objects", or
"storage.buckets" returns zero matches. Supabase enables RLS on
storage.objects by default with no policies granted to anyone, on every
project. Whatever `avatars` bucket exists in the deployed project today
was created out-of-band (dashboard), and without an explicit INSERT
policy, RLS denies every write - including the file's own owner trying to
upload their own avatar for the first time. This is exactly the "new row
violates row level security policy" error being reported: it is Postgres
correctly enforcing "no policy = no access," not a transient failure.

## The fix
- Ensure the `avatars` bucket exists and is public (avatars are displayed
  without authentication - Player Directory (/players), individual player
  profiles (/players/:id), and the header avatar are all rendered from
  storage.avatars-not(getPublicUrl()) results, so a private bucket would
  make every avatar a broken image regardless of RLS on the row).
- Add four scoped policies on storage.objects, restricted to
  bucket_id = 'avatars' only (so nothing here touches event-images or
  gear-images' existing access, if any):
  - Public SELECT (anyone can view any avatar image - this is the public
    read the app already relies on via getPublicUrl()).
  - INSERT/UPDATE/DELETE restricted to `authenticated`, and only within
    the caller's own folder. uploadImage() in src/lib/storage.ts already
    writes to `${userId}/${filename}`, i.e. every object's storage path
    is prefixed with the uploader's own auth.uid() - so
    (storage.foldername(name))[1] = auth.uid()::text is both necessary
    and sufficient to guarantee a user can only write/replace/delete
    their own avatar(s), never anyone else's, without needing
    service_role anywhere in the frontend.

## What this does NOT do
Does not touch event-images or gear-images buckets/policies (out of
scope for this reported bug - if they exhibit the same symptom, the
identical pattern below applies, swapping the bucket_id literal). Does
not change profiles.avatar_url itself, which was already safely
self-writable (see 009_protect_sensitive_profile_columns.sql's own list
of unprotected, self-service columns) - the failure was always at the
storage layer, before the profile row update is ever reached.
*/

-- Idempotent: creates the bucket if it doesn't exist yet, or ensures an
-- existing one is public if it was created private by mistake.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_own_folder_insert" ON storage.objects;
CREATE POLICY "avatars_own_folder_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_own_folder_update" ON storage.objects;
CREATE POLICY "avatars_own_folder_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_own_folder_delete" ON storage.objects;
CREATE POLICY "avatars_own_folder_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
