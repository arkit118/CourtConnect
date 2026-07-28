# CourtConnect Moderation Runbook (v1)

Internal reference for founders/admins. This is a manual, Supabase-Table-Editor-based
workflow for Phase 1/2 — there is no in-app admin moderation dashboard for reports yet,
and none is planned until it can be built safely.

Supabase project: https://yycbaqkmxljuxwfjtifb.supabase.co
Support/appeals contact: courtconnect.contact@gmail.com

Never use the `service_role` key in the frontend. Everything below is done by a human,
logged into the Supabase dashboard directly (Table Editor / SQL Editor), not via the app.

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

All appeals ("I was banned and think it's a mistake"), account deletion requests, and
general support requests go to **courtconnect.contact@gmail.com** — this is the single
contact address used consistently across the Terms, Privacy, Safety pages, the banned
banner, and this runbook. Respond manually; there is no ticketing system yet.
