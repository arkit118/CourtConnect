# CourtConnect Moderation Runbook (v1)

Internal reference for founders/admins. This is a manual, Supabase-Table-Editor-based
workflow for Phase 1/2 — there is no in-app admin moderation dashboard for reports yet,
and none is planned until it can be built safely.

Supabase project: https://yycbaqkmxljuxwfjtifb.supabase.co
Support/appeals contact: courtconnect.contact@gmail.com

Never use the `service_role` key in the frontend. Everything below is done by a human,
logged into the Supabase dashboard directly (Table Editor / SQL Editor), not via the app.

## 0. Getting access to /admin

The in-app `/admin` page (comment/listing moderation, basic stats) requires
`profiles.role = 'admin'`. This is not set by default — every account starts as
`role = 'player'`. To grant yourself access: Table Editor → `profiles` → find your row →
set `role` to `admin`. Banned accounts (`is_banned = true`) are redirected away from
`/admin` even if `role = 'admin'`, so unban yourself first if that ever applies.

Note that `/admin`'s comment/listing moderation actions only work on content you own —
there is no admin-bypass RLS policy, so approving/deleting another user's comment or
deactivating another user's listing from that page currently has no effect (RLS silently
blocks it). Use the manual Table Editor steps in section 5 below for other users' content
until that's addressed.

---

## 1. Viewing open reports

1. Go to the Supabase dashboard → your project → **Table Editor** → `reports`.
2. Reports are **not visible in the app** — regular users can only see their own
   submitted reports (RLS: `reporter_id = auth.uid()`), and there is no UI that lists
   them even for the person who filed them. The Table Editor is the only place to view
   the full list.
3. To see only open reports, use the Table Editor's filter UI: `status = open`, or run
   in the SQL Editor:
   ```sql
   select id, created_at, report_type, reason, details, reporter_id, reported_user_id, target_id
   from public.reports
   where status = 'open'
   order by created_at desc;
   ```
4. `report_type` tells you what was reported: `user`, `gear_listing`, `court_booking`,
   `event`, `court`, or `general` (a report with no specific target — see the Safety
   page's "Report a Safety Concern" button).
5. `target_id` is the id of the reported row (e.g. a `gear_listings.id` or
   `court_bookings.id`) when `report_type` is not `general`. Look it up in the
   corresponding table to see the actual content.
6. `reported_user_id` is the profile being reported (or the owner of the reported
   content), when known.

## 2. Updating report status

Edit the `status` column directly in the Table Editor (click the cell, pick a value),
or via SQL:

```sql
update public.reports
set status = 'reviewed', admin_notes = 'Looked into it, no action needed'
where id = '<report-id>';
```

Allowed values: `open` → `reviewed` → `actioned` (you did something about it, e.g.
banned a user or removed a listing) or `dismissed` (no action warranted). Use
`admin_notes` to leave yourself a short trail of what you found/did — it's a free-text
column only visible in the Table Editor, never shown to users.

## 3. Banning a user

1. Go to **Table Editor** → `profiles`.
2. Find the user by `id` (from the report's `reporter_id`/`reported_user_id`) or by
   `name`.
3. Set:
   - `is_banned` → `true`
   - `banned_at` → current timestamp (click the cell, use "Now" or paste an ISO
     timestamp)
   - `ban_reason` → a short internal note, e.g. `"Harassment reported by two users,
     confirmed via bookings"`. This is never shown to the banned user or anyone else —
     it's for your own records.
4. That's it — no separate confirmation step. The app checks `profiles.is_banned` on
   every authenticated write action (bookings, gear listings, event registrations,
   profile edits, reports, partner requests) and blocks them immediately with:
   > "Your account is restricted. Contact courtconnect.contact@gmail.com if you think
   > this is a mistake."
5. Banned users are also hidden from the Players and Partners directories, and their
   active gear listings stop showing up for other signed-in users browsing Gear
   Exchange. They can still sign in and browse public pages (courts, schedule, events)
   — the app does not lock them out entirely, only blocks new writes.

## 4. Unbanning a user

Reverse step 3: set `profiles.is_banned` back to `false` for that row. You can leave
`banned_at`/`ban_reason` in place as history, or clear them — neither is required by
the app (only `is_banned` is actually checked).

## 5. Removing unsafe content manually

There's no in-app "delete" button for admins on gear listings, bookings, or events yet.
Do it directly in the Table Editor:

- **Gear listing**: `gear_listings` table → either delete the row, or set
  `is_active = false` (preferred — keeps a record, and it stops appearing in Gear
  Exchange immediately since the app only shows `is_active = true` listings).
- **Court booking**: `court_bookings` table → set `status = 'Cancelled'` (preferred,
  matches how users cancel their own bookings and keeps history) or delete the row.
- **Event**: `events` table → set `status = 'cancelled'`, or delete the row if it was
  never legitimate (e.g. spam/fake event). Deleting cascades to its `registrations`.

Always prefer deactivating/cancelling over hard-deleting when there's any chance you'll
want the history later (e.g. for a repeat-offender pattern).

## 6. Emergency / safety situations

CourtConnect is a coordination tool, not a safety service. If a report describes an
active emergency, immediate danger, or anything requiring law enforcement:

- **Do not treat it as a normal moderation queue item.** Nothing in this app reaches
  emergency services.
- Advise the reporter (if you're in direct contact, e.g. via the appeals email) to
  contact local emergency services (911 in the US) directly.
- Still ban the user / remove the content per the steps above if applicable, but that
  is a secondary step — it does not substitute for emergency contact.

## 7. Appeals and support

All appeals ("I was banned and think it's a mistake") and general support requests go to
**courtconnect.contact@gmail.com** — this is the single contact address used consistently
across the Terms, Privacy, Safety pages, the banned banner, and this runbook. Respond
manually; there is no ticketing system yet.

Account deletion no longer requires emailing support — users can delete their own account
in-app (Settings → Account → Delete Account, type DELETE to confirm). See section 8 below
if a user asks you to do it for them instead (e.g. they can't sign in).

## 8. Account deletion (in-app, and the `delete-account` Edge Function)

Users delete their own account from **Settings → Account → Delete Account**
(`src/pages/SettingsPage.tsx`), which calls the `delete-account` Edge Function
(`supabase/functions/delete-account/index.ts`) with their own access token. That function:

1. Verifies the caller's JWT with the anon key (never service_role for this step).
2. Best-effort removes everything under the user's own `${uid}/` folder in the `avatars`,
   `gear-images`, and `event-images` Storage buckets.
3. Calls `supabase.auth.admin.deleteUser(uid)` using a service_role client that only ever
   exists inside this Edge Function — **the service_role key is never present in the
   frontend build**, only as a Supabase-managed Edge Function secret.

Deleting the `auth.users` row cascades through every table that stores the user's own
data (`profiles`, `registrations`, `partner_requests`, `gear_listings`, `gear_interests`,
`comments`, `matches` and, via `matches`, `messages`, `blocks`,
`parent_consent_requests`) via `ON DELETE CASCADE` foreign keys already in the schema — no
manual per-table cleanup needed. Content the user didn't solely own is preserved and
de-identified instead: `events.organizer_id`, `reports.reporter_id`/`reported_user_id`,
`matches.requested_by`, and `admin_flags.reporter_id` are all `ON DELETE SET NULL`, so an
event they created or a report involving them survives, just anonymized.

**Deploying/updating this function** (only needed after editing
`supabase/functions/delete-account/index.ts`):

```
supabase functions deploy delete-account
```

No new secrets to set — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` are all provided automatically to every Edge Function by the
Supabase runtime.

**If a user can't access Settings themselves** (locked out, banned, etc.) and asks you to
delete their account manually: Table Editor → Authentication → Users → find them by email
→ delete. This performs the same cascade as the Edge Function above, since it's the same
underlying `auth.users` deletion.

## 9. Objectionable-content filter

Chat messages, profile bios, gear listing titles/descriptions, court booking notes, and
event descriptions/rules/FAQ are checked against a basic denylist of severe profanity,
slurs, and explicit sexual solicitation terms before they can be saved — narrow and
severity-focused on purpose, so normal tennis/community language is never affected.

- **Client-side**: `src/lib/contentFilter.ts` — blocks the submission immediately with a
  clear error message, before any network request is made.
- **Server-side**: `supabase/migrations/20260814000001_021_content_filter.sql` — the same
  category of terms, enforced as Postgres triggers on `messages`, `profiles.bio`,
  `gear_listings`, `court_bookings.notes`, and `events`, so the check holds even if the
  client-side one is bypassed (a direct API call, a modified build, etc.).

This supplements, and does not replace, the existing report/block tools and the manual
moderation workflow in sections 1–6 above — it catches obvious cases automatically, humans
still handle everything else.

## 10. Parent consent email only reaching one address (URGENT — do this first)

**Symptom**: the parent/guardian consent email sends successfully to one specific address
(usually whichever email the Resend account itself was signed up with) but fails for every
other recipient, with the app showing a "could not send" error and the parent never
receiving anything.

**Root cause**: this is a Resend account restriction, not a CourtConnect bug. Until a
sending domain is verified in Resend, the account is in **sandbox mode** and Resend will
only actually deliver to the email address that owns the Resend account itself — every
other recipient is rejected outright with a 403 ("You can only send testing emails to your
own email address... to send emails to other recipients, please verify a domain"). This
exactly matches "works for my own email, fails for my friends' emails."

**The fix — verify a sending domain in Resend:**

1. Go to [resend.com/domains](https://resend.com/domains) → **Add Domain**.
2. Enter a domain you control (e.g. `courtconnect.app`, or a domain you already own). You
   do not need a live website on it — it only needs to exist and let you add DNS records.
   If you don't own a domain yet, buy one cheaply (Namecheap, Google Domains, etc.) — this
   is the only real fix; there is no way to lift the sandbox restriction without it.
3. Resend shows 3 DNS records (SPF, DKIM, and usually a DMARC or MX record) — add these
   exactly as shown in your domain registrar's DNS settings.
4. Wait for DNS to propagate (usually minutes, sometimes up to ~1 hour), then click
   **Verify** in Resend. Once verified, sandbox mode is lifted for that domain entirely.
5. Update the `PARENT_CONSENT_FROM_EMAIL` secret to an address on that now-verified domain
   (e.g. `parentconsent@courtconnect.app` — it does not need to be a real inbox, just a
   valid address at the verified domain):
   ```
   supabase secrets set PARENT_CONSENT_FROM_EMAIL=parentconsent@yourdomain.com
   ```
6. No redeploy needed for a secrets change alone, but if
   `supabase/functions/send-parent-consent-email/index.ts` has also changed, redeploy it:
   ```
   supabase functions deploy send-parent-consent-email
   ```
7. Test by requesting parent consent to an email address that isn't your own Resend account
   email — it should now go through.

**Checking what's actually happening right now**, before or instead of the fix above:

- **Edge Function logs**: Supabase Dashboard → your project → Edge Functions →
  `send-parent-consent-email` → Logs. Every failed send logs the exact Resend status code
  and response body (`send-parent-consent-email: Resend error`) — a 403 mentioning "own
  email address" or "verify a domain" confirms this is the sandbox restriction above, not
  something else.
- **Resend delivery logs**: resend.com → Logs/Emails tab — shows every send attempt, its
  status (delivered/bounced/rejected), and the rejection reason if any.
- **Secrets to verify are actually set**: Supabase Dashboard → Edge Functions → Secrets —
  confirm `RESEND_API_KEY`, `PARENT_CONSENT_FROM_EMAIL`, and `APP_BASE_URL` are all present.
  If any are missing, the app already shows "email sending is not configured yet" rather
  than a confusing generic failure - if you're instead seeing a generic failure, the secrets
  exist but the domain verification above is what's actually missing.

As of this fix, the app itself now recognizes this specific Resend sandbox error and shows
the correct "not configured yet, contact support" message instead of incorrectly telling
the parent to double check the email address they typed (which was never the problem).
