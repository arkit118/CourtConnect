# Design

<!-- impeccable:design-schema 1 -->

Written directly from the built courtconnect-redesign-v2 branch (no
subagent documenter available in this environment - see the session's
final report for what that substitution means in practice). Ground truth
over intention: this describes what actually shipped.

## World

**Court blueprint.** Full-bleed, committed navy (`navy-900`) and deep-green
(`primary-500`/`primary-600`) section fields carry whole regions of the
page - not accents scattered on a white background. An authored SVG
tennis-court line diagram (real baseline/singles-doubles sidelines/
service-box/net geometry, `src/components/brand/CourtMotif.tsx`) is the
recurring decorative and structural motif, standing in for the generic
gradient-blur-orb and icon-in-a-rounded-box patterns the previous pass
used. Clay (`clay-400`/`clay-500`, existing token) appears as a single
accent - one underline stroke in the hero, one feature tile - never as a
primary color. Cream/off-white (`bg-cream`, `#F6F3EA`/`#FAFAF8`) is the
breathing-room color between committed blocks, not the default backdrop.

## Type

Bricolage Grotesque (`font-display`, already configured) run large and
confident for every heading - `text-4xl` to `text-6xl` on hero-scale
copy. Instrument Sans (`font-sans`) for body text. No new fonts
introduced; the existing pairing was already a deliberate, non-default
choice (see craft-floor.md's default-face list) and stays.

## Composition

Asymmetric, content-driven blocks instead of uniform grids: the homepage
"what CourtConnect is" section gives Partner Matching a large featured
block and the other three features smaller tiles of varying width,
rather than four equal cards. Section transitions use color-field changes
(navy -> cream -> green -> cream -> navy -> cream) for rhythm instead of
numbered steps or eyebrow labels.

## Shared components

- `CourtMotif.tsx` - `CourtLines` (full court diagram, used as a large
  low-opacity background layer) and `CourtCorner` (a single corner/
  service-box crop, used small as a recurring mark on cards).
- `PageHero.tsx` - the committed-color page header pattern (eyebrow +
  title + description on a navy or green field with a `CourtLines`
  overlay), used on Partners, Matches, Schedule, Courts, Gear, About, and
  Safety so interior pages share the homepage's visual world rather than
  keeping their old plain-white `<h1>` headers.

## What this world refuses

Per craft-floor.md, deliberately absent from every redesigned surface:
same-size icon+heading+text card grids as page structure, the hero-metric
template, eyebrow/kicker labels above headings (the homepage hero's small
caps line is the location/status fact itself, not a decorative label),
01/02/03 section numbers, gradient text, glass/blur decoration, colored
left-borders, purple (removed from `CourtsPage`'s surface-type badges,
the one place it remained).

## Known gaps / not addressed this pass

- Header/Footer/Auth pages/Events/Players/Profile/Admin/Chat were not
  restructured - only the seven pages the task specified (Homepage,
  Partners, Matches, Schedule, Courts, Gear, About/Safety). They still
  use the pre-redesign plain-white-header pattern, so the app is
  currently visually inconsistent between redesigned and un-redesigned
  pages. Extending `PageHero` to the remaining pages is the natural next
  step.
- No production imagery was sourced or authored (no real Livingston
  court photography) - the world leans on typographic/graphic elements
  (court-line SVGs, color fields) rather than photography, which was a
  deliberate choice given no real photo assets were available, not an
  oversight.
- Impeccable's full interactive finish-review (screenshot-based
  `impeccable-finish-reviewer` subagent + `detect.mjs` hook pass) did not
  run in this environment - see the session's final report for what
  verification substituted for it (manual live-app screenshots + a direct
  craft-floor read-through).
