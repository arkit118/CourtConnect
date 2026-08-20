// Supabase Edge Function: delete-account
//
// Permanently deletes the calling user's own account. This is the only
// place in the entire app that ever touches the service_role key - it
// never leaves this server-side function, and the frontend
// (src/contexts/AuthContext.tsx's deleteAccount()) only ever calls this
// Edge Function over HTTPS with the user's own access token, the same
// way send-parent-consent-email is invoked.
//
// What actually deletes the user's data: calling
// supabase.auth.admin.deleteUser(uid) removes the auth.users row, and
// every table that stores user-owned data references profiles(id) (or
// auth.users(id) directly, for court_bookings) with ON DELETE CASCADE -
// see supabase/migrations/20260612230033_001_full_schema.sql and the
// later per-feature migrations (010_matches_table.sql,
// 011_blocks_table.sql, 012_messages_table.sql,
// 014_parent_consent_requests.sql). So deleting the auth user cascades
// through profiles -> registrations, partner_requests, gear_listings,
// gear_interests, comments, matches (and matches -> messages), blocks,
// and parent_consent_requests automatically; no manual per-table
// DELETE statements are needed or done here. Content the user didn't
// solely own is preserved and anonymized instead, per the schema's own
// ON DELETE SET NULL columns - events.organizer_id, reports.reporter_id/
// reported_user_id, matches.requested_by, admin_flags.reporter_id - so
// an event the user created or a report involving them isn't deleted
// out from under other members or the moderation record, only
// de-identified.
//
// The one thing DB cascades cannot reach is Supabase Storage (avatars,
// gear-images, event-images are files, not rows) - this function also
// best-effort removes everything under the user's own `${uid}/` folder
// in each of those buckets (see src/lib/storage.ts's uploadImage(), which
// always writes to that path) before deleting the auth user. A storage
// cleanup failure is logged but never blocks the actual account
// deletion - an orphaned file is a much smaller problem than a user who
// asked to delete their account and couldn't.
//
// Required environment variables - all provided automatically by the
// Supabase Edge Functions runtime, nothing to configure:
//   SUPABASE_URL
//   SUPABASE_ANON_KEY          - used only to verify the caller's JWT
//   SUPABASE_SERVICE_ROLE_KEY  - used only for the admin delete + storage
//                                cleanup, both server-side only

import { createClient } from 'npm:@supabase/supabase-js@2';

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const STORAGE_BUCKETS = ['avatars', 'gear-images', 'event-images'] as const;

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error('delete-account: missing SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ ok: false, error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Identify the caller using the anon key + their own JWT - never
    // service_role for this step, so this function can only ever delete
    // the account of whoever is actually signed in and calling it.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ ok: false, error: 'Not authenticated' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    const uid = userData.user.id;

    // service_role client - only ever constructed here, only ever used
    // inside this function, never returned or logged.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    for (const bucket of STORAGE_BUCKETS) {
      try {
        const { data: files, error: listError } = await adminClient.storage.from(bucket).list(uid);
        if (listError) {
          console.error(`delete-account: listing ${bucket}/${uid} failed`, listError);
          continue;
        }
        if (files && files.length > 0) {
          const paths = files.map((f) => `${uid}/${f.name}`);
          const { error: removeError } = await adminClient.storage.from(bucket).remove(paths);
          if (removeError) {
            console.error(`delete-account: removing ${bucket}/${uid} files failed`, removeError);
          }
        }
      } catch (storageErr) {
        // Storage cleanup is best-effort only - never block the actual
        // account deletion over an orphaned file.
        console.error(`delete-account: unexpected error cleaning up ${bucket}/${uid}`, storageErr);
      }
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(uid);
    if (deleteError) {
      console.error('delete-account: auth.admin.deleteUser failed', { uid, deleteError });
      return new Response(
        JSON.stringify({ ok: false, error: 'Could not delete your account. Please try again or contact support.' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('delete-account: unexpected error', err);
    return new Response(JSON.stringify({ ok: false, error: 'Unexpected server error' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
