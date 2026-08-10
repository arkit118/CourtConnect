# CourtConnect — iOS App Store Guide

CourtConnect ships to iOS as a [Capacitor](https://capacitorjs.com/) native shell around the
same React/Vite web app deployed to the web (no Expo, no React Native, no app-specific
product logic). Capacitor loads the built `dist/` bundle into a native `WKWebView` inside a
real Xcode project (`ios/App`), which is what gets archived and submitted.

For the native project's build mechanics (what's committed vs. generated, SPM vs.
CocoaPods), see `docs/ios-app-store-build.md`. This doc covers the App Store submission
process end to end: prerequisites, build/sign/archive, TestFlight, and the App Store
Connect listing itself.

## App identity

| | |
|---|---|
| App name | CourtConnect |
| Bundle ID | `com.courtconnect.app` |
| Version (marketing) | 1.0.0 |
| Build number | 1 |
| Platform | iOS first (Android not set up) |

**Do not change the Bundle ID after the first App Store Connect upload.** Once a bundle ID
has an app record in App Store Connect, it's permanent for that app — changing it means
creating an entirely new app listing from scratch (losing reviews, TestFlight testers,
ratings history, everything). `com.courtconnect.app` is set in both `capacitor.config.ts`
(`appId`) and the Xcode project (`PRODUCT_BUNDLE_IDENTIFIER`, both Debug and Release
configs in `ios/App/App.xcodeproj/project.pbxproj`) — they must always match.

## Prerequisites

- **A Mac.** Xcode only runs on macOS; there is no way to build, sign, or archive the iOS
  app from Windows/Linux. Everything in this doc from "Build steps" onward runs on a Mac.
- **Xcode** (latest stable from the Mac App Store), with Command Line Tools installed.
- **Node.js + npm**, same versions used for local web dev.
- **An Apple Developer Program account** ($99/year), enrolled and in good standing. Needed
  to sign the app, use automatic provisioning, and submit to App Store Connect / TestFlight.
- This project's Capacitor iOS platform uses **Swift Package Manager**, not CocoaPods —
  there is no `Podfile`. You do not need CocoaPods installed; Xcode resolves the Capacitor
  Swift packages automatically the first time you open the project.

## Build commands (run from the repo root, on the Mac)

```bash
npm install
npm run build          # vite build -> dist/
npx cap sync ios       # copies dist/ into ios/, updates native config from capacitor.config.ts
npx cap open ios       # opens ios/App/App.xcodeproj in Xcode
```

Or, using the package.json shortcuts added for this:

```bash
npm install
npm run ios:build      # = npm run build && npx cap sync ios
npm run ios:open       # = npx cap open ios
```

Run `npm run ios:sync` (`npx cap sync ios`) any time `capacitor.config.ts` or a Capacitor
plugin changes without a web rebuild being needed, and always after `git pull` if native
config changed upstream.

`npm run ios:assets` regenerates the app icon and splash screen PNGs from the CourtConnect
brand marks in `src/assets/brand/` (see `scripts/generate-ios-assets.mjs`) — only needed if
the logo changes; the generated files are already committed under `ios/App/App/Assets.xcassets/`.

## Opening and running in Xcode

1. `npm run ios:open` (or manually open `ios/App/App.xcodeproj`).
2. Select the **App** target in the project navigator.
3. **Signing & Capabilities** tab → select your Team → leave "Automatically manage
   signing" checked (simplest option for a solo/small team; switch to manual signing only
   if you already manage provisioning profiles elsewhere).
4. Select a Simulator (or a connected iPhone, for on-device testing) from the scheme
   selector at the top, then press **Run** (⌘R) to sanity-check the build before archiving.
5. On first run, if prompted to trust your Apple Developer certificate on a physical
   device: Settings → General → VPN & Device Management on the iPhone.

## Archive and upload to App Store Connect

1. In Xcode, select **Any iOS Device (arm64)** as the run destination (not a simulator —
   Archive is disabled for simulator destinations).
2. **Product → Archive.** Wait for the build; the Organizer window opens automatically
   when it finishes.
3. In the Organizer, select the new archive → **Distribute App** → **App Store Connect** →
   **Upload**. Use automatic signing unless you have a specific reason not to.
4. Xcode validates the archive (icon sizes, Info.plist keys, entitlements) before upload —
   fix anything it flags and re-archive rather than trying to work around it.
5. Upload takes a few minutes. Once it finishes, the build appears in App Store Connect
   under the app's **TestFlight** tab shortly after (processing can take 15–60 minutes).

## TestFlight

1. In [App Store Connect](https://appstoreconnect.apple.com/) → your app → **TestFlight**,
   wait for the uploaded build to finish processing (status changes from "Processing" to
   ready).
2. Apple may require answering **Export Compliance** questions for the build (CourtConnect
   doesn't use custom encryption beyond standard HTTPS/TLS, so this is normally the
   "does not use encryption beyond what's exempt" answer — confirm against Apple's current
   questionnaire wording at submission time).
3. Add **internal testers** (your own Apple Developer team, no review needed) for a first
   pass, or an **external testing group** (requires a lightweight Beta App Review) once
   you're ready for testers outside the team.
4. Testers install via the **TestFlight** app using an email invite or a public link (if
   you enable one for the external group).
5. Test the full pilot flow on a real device before submitting for App Store review:
   signup → DOB/age-band gate → skill level/UTR/home town → Terms/Privacy acceptance →
   (if under 18) parent/guardian consent → sign-in → players/matches/chat → events →
   gear exchange → courts → schedule → reports/blocking → sign out.

## App Store Connect listing

Create the app record in App Store Connect (**My Apps → +**) if it doesn't exist yet,
using the Bundle ID `com.courtconnect.app` registered in your Apple Developer account.
Then fill in:

**App name:** CourtConnect

**Subtitle:** Livingston tennis, connected

**Category:** Sports (primary); Social Networking is a reasonable secondary if offered.

**Description:**
```
CourtConnect is a local tennis community platform built for Livingston, NJ players.

Use CourtConnect to find local players, send match requests, chat after a match is
accepted, coordinate court time with the community, join local tennis events, and
exchange tennis gear locally.

Features:
- Player discovery and match requests
- In-app chat for accepted matches
- Parent/guardian approval for users under 18
- Reporting and blocking tools
- Local events
- Court-time coordination
- Tennis gear exchange

CourtConnect is currently launching as a Livingston, NJ pilot.

Important: CourtConnect does not officially reserve public courts. Scheduling is for
community coordination only.
```

**Keywords:** `tennis,local tennis,tennis partner,tennis match,courts,sports,Livingston,gear exchange`

**Support URL:** https://court-connect-three.vercel.app/about

**Marketing URL:** https://court-connect-three.vercel.app

**Privacy Policy URL:** https://court-connect-three.vercel.app/privacy

**Screenshots:** required for at least one device size (6.7"/6.9" iPhone at minimum;
App Store Connect will scale down for smaller sizes if others aren't provided). Not
generated as part of this task — capture from the Simulator or a device once the app is
running (Landing page, Players, Matches/Chat, Events, Gear Exchange are the natural set).

**App icon:** the 1024×1024 App Store icon is generated at
`docs/assets/app-store-icon-1024.png` (same image embedded in the app itself) — upload
this directly if App Store Connect asks for it separately from what's in the binary.

### Review notes (paste into the "Notes" field for the reviewer)

```
CourtConnect is a local tennis community platform for Livingston, NJ players.

The app includes user accounts, player discovery, match requests, accepted-match chat,
gear listings, events, court-time coordination, reporting, and blocking.

Safety/moderation:
- Users under 13 are blocked.
- Users ages 13-17 require parent/guardian approval before using player matching or chat.
- Adults can only match/chat with adults.
- Minors can only match/chat with approved minors.
- Users can report profiles, messages, gear listings, events, and schedule posts.
- Users can block other users.
- Banned users are restricted from core social actions.
- CourtConnect does not officially reserve public courts. Scheduling is for community
  coordination only.

No payments, subscriptions, paid hitting, coaching marketplace, shipping, or Stripe
checkout are included.

Email/password sign-in only in this build (no social login). If the reviewer needs a demo
account, provide one via App Store Connect's reviewer-notes attachment rather than in this
public-facing text.
```

Consider providing the reviewer a pre-made demo account (email + password) in App Store
Connect's sign-in-information fields, since the app requires an account for most
functionality and a reviewer won't want to complete a real signup + email verification
loop (see "Email verification and deep linking" below for why that loop is extra friction
on iOS specifically).

### Age rating

Answer Apple's age rating questionnaire honestly based on what's actually in the app:
user-generated content, messaging between users, and location-adjacent features (town
names, court locations) are all relevant questions. Given parent/guardian consent is
required for 13–17 and under-13 is blocked outright, the app is not intended for young
children — do not select a 4+ rating.

### Privacy "nutrition label" (App Privacy tab)

Fill in based on what CourtConnect actually collects via Supabase:

- **Contact Info** (email, name) — used for account creation, linked to identity.
- **User Content** (profile photos, messages, gear listings) — used for app functionality,
  linked to identity.
- **Identifiers** (user ID) — used for app functionality.
- Location: CourtConnect uses **self-reported town names**, not device GPS/location
  services — no `NSLocationWhenInUseUsageDescription` or similar is requested in
  `Info.plist`, and none should be added unless real geolocation is implemented later.

No advertising or third-party data-broker sharing is done. `@vercel/analytics` is used for
basic usage analytics on the web build; disclose it as analytics data if asked, not
advertising data. Re-verify this section against the actual current data model before
submitting — it should reflect what's really is in `supabase/migrations` at submission
time, not just this snapshot.

## Info.plist permissions

`ios/App/App/Info.plist` requests:

- **`NSPhotoLibraryUsageDescription`** — "CourtConnect uses photo access so you can upload
  a profile picture." Required because `ProfilePage.tsx`, `GearPage.tsx`, and
  `EventCreatePage.tsx` all use `<input type="file" accept="image/...">` for photo
  uploads, which triggers the native photo picker on iOS.
- **No camera permission** — the app never uses `capture` on a file input or any native
  camera API, only the photo library picker, so `NSCameraUsageDescription` is intentionally
  not requested. Don't add it unless a real camera-capture feature is built.
- **No location permission** — see Privacy section above.

## Email verification and deep linking (read before assuming signup "just works")

Supabase's signup-confirmation, resend-confirmation, and password-reset emails all embed a
`redirectTo` / `emailRedirectTo` URL that the user lands on after clicking the emailed
link. On web this is `window.location.origin` (the real `https://court-connect-three.vercel.app`
site). Inside the native iOS WebView, `window.location.origin` is Capacitor's internal
WebView origin — not a real, clickable URL from an email client — so as of this branch,
`src/lib/openExternal.ts`'s `authRedirectOrigin()` forces these three flows to always
redirect to the production web origin, even when the signup/reset was initiated from the
native app:

- `AuthContext.signUp` (`emailRedirectTo`)
- `AuthContext.resendVerificationEmail` (`emailRedirectTo`)
- `AuthContext.resetPassword` (`redirectTo`)

**What this means in practice:** a user who signs up in the iOS app gets a verification
email whose link opens in Safari (the website), not back inside the native app. They
complete verification there, then have to return to the CourtConnect app and sign in
normally — the web session doesn't carry over to the native app's separate WebView
storage. This is a real extra step, not a crash or dead link, and it's why review notes
above suggest giving the App Review team a pre-verified demo account.

**Next steps to fix this properly (not done in this task — scope was explicitly to wrap
the existing web app, not add native auth infrastructure):**

1. Register a **universal link** association (`applinks:court-connect-three.vercel.app` or
   a future custom domain) via an `apple-app-site-association` file served from the site's
   `/.well-known/` path, plus the matching Associated Domains entitlement in the Xcode
   project.
2. Point `authRedirectOrigin()` (or a new dedicated deep-link URL) at a path the universal
   link is configured to intercept, so tapping the emailed link opens the native app
   directly instead of Safari.
3. Handle the incoming URL in `AppDelegate.swift` (Capacitor's `application(_:continue:)`)
   and pass the token through to the Supabase JS client the same way `detectSessionInUrl`
   already does on web, so the session actually gets established in the native app's
   storage.
4. Test on a real device — universal links do not reliably trigger from Simulator Mail/Safari.

Until that's built, the current behavior (open the web version to finish the email step)
is the intended, working fallback — not a bug to silently patch around.

## Routing inside the WebView

The app uses React Router's `BrowserRouter` with pure client-side navigation. Capacitor
serves `dist/index.html` once at native app launch and everything after that — `/players`,
`/matches`, `/schedule`, `/courts`, `/gear-exchange`, `/events`, `/about`, etc. — is
client-side `history.pushState` navigation inside that single loaded document, so there's
no server-side rewrite/fallback needed (unlike deploying `dist/` to a plain static host).
Deep-linking directly into `/players` from *outside* the app (e.g. a universal link) is a
separate concern from in-app navigation and isn't set up — see the deep linking section
above.

## External links

`target="_blank"` anchors don't reliably open a new tab inside Capacitor's WKWebView —
without help, they either silently do nothing or navigate the single WebView away from the
app entirely (with no in-app back button). Two different fixes are applied depending on
whether the link is truly external or just an in-app route opened with `target="_blank"`:

- **Same-app routes** opened with `target="_blank"` (Terms/Privacy/Safety links from the
  signup form and the legal-acceptance gate) now use `inAppLinkTarget` from
  `src/lib/openExternal.ts`, which is `'_blank'` on web (unchanged behavior — opens a real
  new tab so the signup form isn't lost) and `undefined` on native (so React Router just
  navigates in-app instead of attempting - and failing - a real new-window open).
- **Truly external links** (the Instagram link in the footer, and each court's external
  `booking_url` on the Courts page, which may point at a town rec site, UTR, or similar)
  now go through `openExternalUrl()` / `handleExternalLinkClick()`, also in
  `src/lib/openExternal.ts`. On native this uses `@capacitor/browser`'s `Browser.open()`,
  which opens an in-app `SFSafariViewController` (with its own back button back to
  CourtConnect) instead of hijacking the app's own WebView. On web it's unchanged
  (`window.open` in a new tab).

If a new external link is added anywhere in the app later, route it through
`handleExternalLinkClick()` the same way rather than a bare `<a target="_blank">`.

## Safe areas, status bar, splash screen, app icon

- **Safe areas:** `index.html`'s viewport meta includes `viewport-fit=cover`, and
  `src/index.css` adds `.safe-top` / `.safe-bottom` / `.safe-x` utilities
  (`env(safe-area-inset-*)`) — `0` on desktop web and non-notch devices, so this adds no
  extra padding outside the native notch/Dynamic Island/home indicator case. Applied to
  the sticky `Header` (top + sides) and the toast container (bottom, layered with its
  existing offset).
- **Status bar:** configured in `capacitor.config.ts` (`plugins.StatusBar`) and applied at
  runtime in `src/lib/nativeInit.ts` — dark text (`Style.Light` in Capacitor's inverted
  naming) on a solid white bar (`overlaysWebView: false`), matching CourtConnect's
  always-white sticky header so contrast is never in question regardless of what's on the
  page below it.
- **Splash screen:** `ios/App/App/Assets.xcassets/Splash.imageset` now holds a
  white-background image of the CourtConnect racket-mark + wordmark lockup (regenerated
  from `src/assets/brand/logo-lockup.png` via `npm run ios:assets`), replacing Capacitor's
  default placeholder. `launchAutoHide: false` in `capacitor.config.ts` plus an explicit
  `SplashScreen.hide()` call in `nativeInit.ts` (after first paint) avoids a flash of blank
  white between the splash and the app becoming interactive.
- **App icon:** `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` is a
  1024×1024 App Store icon (white background, CourtConnect racket mark), regenerated from
  `src/assets/brand/logo-icon.png`. A duplicate copy lives at
  `docs/assets/app-store-icon-1024.png` for convenience when App Store Connect asks for
  the marketing icon separately from the binary. Regenerate both with `npm run ios:assets`
  (requires the `sharp` devDependency, already in `package.json`) if the logo changes.

## Maintenance mode

`src/lib/maintenance.ts`'s `MAINTENANCE_MODE_ENABLED` flag is `false` as of this branch —
the app opens normally, not into the maintenance page. The maintenance system itself
(`MaintenanceGate`, `MaintenancePage`, the `?cc_bypass=` mechanism) is untouched and stays
in the codebase for reuse; flip that one flag and redeploy the *web* app if maintenance
mode is needed again. Note this only affects the web deploy directly — a native app that's
already been reviewed/released reads whatever the flag was at its **last submitted build**,
since the WebView bundle is baked into the binary at archive time, not fetched live. If
CourtConnect ever needs to force existing installed native app users into maintenance mode
without an App Store update, that requires either a remote-config check added later or a
new build submission — not something this flag alone covers for native.

## Remaining risks before submitting

- **Email verification friction on native** — see the deep linking section above. Not a
  bug, but plan for it in reviewer notes and initial user onboarding messaging.
- **No screenshots or App Store Connect listing actually created yet** — this doc has the
  copy ready to paste in, but the app record and screenshots still need to be produced on
  the Mac from a running build.
- **Privacy nutrition label** needs a final pass against whatever's actually in
  `supabase/migrations` at submission time — the summary above is a snapshot from when
  this doc was written, not a live source of truth.
- **Apple's 4.2 "not just a website" guideline** — this app is a Capacitor WebView wrapper.
  Status bar styling, safe areas, a real branded icon/splash, and in-app external-link
  handling are now in place (this branch), which meaningfully helps, but Apple review is
  ultimately a judgment call. If rejected under 4.2, the fix is more native-feeling
  polish, not restructuring the app.
- **No push notifications, no offline state handling.** Not required for a v1 pilot
  submission, but a fully offline device currently just shows whatever the WebView renders
  for failed network requests (the existing web app's own error handling), not a
  dedicated native "you're offline" screen.
- **`@capacitor/cli`** is currently listed in `dependencies` rather than
  `devDependencies` in `package.json` (inherited from the original Capacitor install) —
  harmless (it's a build-time-only tool either way) but worth moving next time
  `package.json` is touched for something else.
