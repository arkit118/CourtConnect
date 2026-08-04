# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Local tennis players in Livingston, NJ (the pilot town) — high-school-age
minors through adults, playing at a range of skill levels. Primary jobs:
find a hitting partner near their level, see what community tennis events
are happening, coordinate informal court time with other members, and buy/
sell/trade used gear locally. Some users are minors (13-17) whose parent or
guardian must approve partner matching/chat before they can use it; adults
and minors are kept separated in matching by design.

*(Sourced from the user's product brief for this redesign task, not a
separate init interview — the brief already answered every question this
step would normally ask. See init.md's inferred-brief fallback.)*

## Product Purpose

CourtConnect is a Livingston tennis community pilot: a free coordination
layer for local players, not a booking platform or a business. It exists
because there was no lightweight way for local tennis players to find each
other, see community events, agree on court times, and pass along gear -
things that currently happen informally or not at all.

## Positioning

Community coordination tool, explicitly not: an official court reservation
system, a payment/coaching marketplace, or a stats/ranking platform.
CourtConnect does not track live court availability and does not process
any payments (gear exchange is a local "interested" contact flow, not a
transaction). The credible claim it can make that a generic sports-SaaS
competitor can't: this is a real, currently-single-town pilot built with
minor-safety enforced at the database level, not a demo or a nationwide
product pretending to be local.

## Operating Context

- One real court location today (Livingston) - the product should not
  over-index on "finding courts" since there is basically nothing to find
  yet; matching, events, coordination, and gear are the actual daily use.
- Users sign up, optionally get matched with partners (gated by legal
  acceptance, DOB/age-band, and - for minors - parent/guardian email
  approval), browse/register for community events, propose or join
  community court-time slots on the Schedule page, and list/browse gear.
- Admin role exists for moderation (ban/report review).
- The product is currently behind a maintenance gate on this branch while
  a redesign + bug-fix pass is being tested (see Part 0 of this task);
  that is a deployment-time concern, not a product fact.

## Capabilities and Constraints

- Partner matching: send/accept/decline match requests; an accepted match
  unlocks 1:1 chat. Minors are only ever matched with other minors, adults
  with other adults - enforced in the database, not just the UI.
  Under-13 signup is blocked outright; 13-17 requires parent/guardian email
  approval (via a Resend-sent email + a public consent-response page)
  before matching/chat unlock for that minor.
  Reporting and blocking exist on matches/chat.
- Events: browse/create community tournaments and clinics, register,
  capacity-limited.
  Entry fees are recorded as data but CourtConnect does not process
  payment itself.
  Homepage should not show fabricated headline numbers for participation.
- Court coordination (Schedule page): community members propose/claim
  informal time blocks at existing courts. Explicitly not an official
  reservation system - copy must say so.
- Courts directory: lists known court locations (currently effectively
  one - Livingston) with static facts (lit/unlit, surface, count). Does
  not track live/real-time court availability - copy must say so.
- Gear Exchange: local listings with an "interested" contact flow only.
  No payments, no shipping, no town-based buy filter clutter.
- Legal/safety: Terms/Privacy acceptance is required and versioned
  (`tos_version`/`privacy_version`); a signed-in user with a stale/missing
  acceptance must get a direct way to accept, not just a hint.
  No fake identity/background verification claims anywhere in copy.
- Constraint: no paid-service dependencies, no coaching/Stripe/payment
  wording anywhere in this pilot.
- Undecided/out of scope for this task: expansion beyond Livingston,
  monetization, official court-booking integration.

## Brand Commitments

- Name: CourtConnect. Approved logo assets exist at `src/assets/brand` /
  `src/components/brand/Logo.tsx` - use them as-is, don't recreate.
- Palette (binding, not open for a palette-selector or replacement):
  deep green `#0B5A2A` (primary/CTA), navy `#0E3567` (secondary/dark
  sections), light green `#2FA84A` (accent), warm off-white background
  `#F6F3EA`/`#FAFAF8`. Clay/terracotta (`#C96C32` family, already in
  tailwind.config.js as `clay`) is an approved sparing accent for
  tennis/clay-court warmth - not a primary color.
  No purple, no purple gradients.
- Voice: local-community, not corporate SaaS. Honest about being an early
  pilot (no fabricated traction/testimonials/stats/activity).
- Fonts already configured: Bricolage Grotesque (display/headings),
  Instrument Sans (body) - see tailwind.config.js.

## Evidence on Hand

- Real, shipped brand system: tailwind.config.js color tokens, index.css
  CSS variables, `src/components/brand/Logo.tsx`, `src/assets/brand/*`.
- Real Supabase schema/migrations under `supabase/migrations/` documenting
  actual enforced constraints (age-band matching separation, parent
  consent, legal acceptance versioning, RLS).
- Tennis UI inspiration screenshots supplied by the user for this task, to
  be used as a moodboard/mood reference only (atmosphere, composition,
  typography confidence) - never copied directly, and never a source of
  new claimed features.
- No real testimonials, player stats, or activity numbers exist or should
  be fabricated; a prior cleanup pass already removed fake metrics from
  the homepage (see git history) and that decision stands.

## Product Principles

1. Say what CourtConnect actually is in the first screen a visitor sees -
   a real user complaint on this project is "I don't understand what this
   is," which any redesign must fix before it fixes anything visual.
2. Never claim more than the product does: no live court availability, no
   official reservations, no payments, no verification, no fabricated
   traction.
3. Minor safety is a hard constraint, not a design detail - every surface
   touching matching/chat must keep age-band separation and parent
   consent legible, not buried.
4. Community-local tone over generic SaaS tone - Livingston-specific,
   small-scale, honest about being a pilot, not "the next big sports app."
5. One town today: don't let "finding courts" dominate the product story
   when there is effectively one court location; matching/events/
   coordination/gear are the real daily value.

## Accessibility & Inclusion

No project-specific standard was established beyond ordinary web
accessibility practice (focus states, contrast, keyboard operability) -
existing code already uses visible focus rings and semantic form labels;
preserve that standard in redesigned surfaces.
