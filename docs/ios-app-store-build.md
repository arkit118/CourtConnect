# CourtConnect iOS App Store Build (Capacitor)

> For the full submission process (signing, archiving, TestFlight, the App Store Connect
> listing copy, privacy label, review notes) see `docs/ios-app-store.md`. This file covers
> just the native project's build mechanics.

CourtConnect is wrapped as a native iOS shell using [Capacitor](https://capacitorjs.com/).
Capacitor does not change the web app itself — it loads the built `dist/` bundle inside a
native `WKWebView` and gives it an Xcode project you can archive and submit to the App
Store. All product logic (auth, matching, chat, scheduling, reports, parent consent) still
runs as the same React/Vite web app; nothing about that logic was touched for this.

- App name: `CourtConnect`
- Bundle ID: `com.courtconnect.app`
- Web dir: `dist`
- Native project: `ios/App/App.xcodeproj` (open the **App.xcworkspace** if one exists after
  `pod install`, otherwise the `.xcodeproj` — see step 3 below)

## Prerequisites (on the Mac)

- Xcode (latest stable), with Command Line Tools installed
- Node.js + npm (same versions used for local web dev)
- An Apple Developer account enrolled in the Apple Developer Program, to sign and submit

This project's Capacitor iOS platform uses **Swift Package Manager**, not CocoaPods —
there is no `Podfile`, so you do **not** need CocoaPods installed. Xcode resolves the
Capacitor Swift packages automatically the first time you open the project.

## Build steps

Run these from the repo root:

```bash
npm install
npm run build
npx cap sync ios
npx cap open ios
```

What each step does:

1. `npm install` — installs JS dependencies, including the Capacitor packages
   (`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`).
2. `npm run build` — builds the web app with Vite into `dist/`.
3. `npx cap sync ios` — copies `dist/` into `ios/App/App/public` and updates the native
   Capacitor config/plugins to match `capacitor.config.ts`. Run this after every web build
   you want reflected in the native app, and after `git pull` if `capacitor.config.ts` or
   the Capacitor packages changed.
4. `npx cap open ios` — opens the project in Xcode (`ios/App/App.xcodeproj`).

From Xcode:

1. Select the `App` target → **Signing & Capabilities** → choose your Team, let Xcode
   manage signing (or configure manually if you use a provisioning profile).
2. Select a Simulator or a connected device and press Run to sanity-check it.
3. For App Store submission: **Product → Archive**, then use the Organizer window to
   validate and upload to App Store Connect.

## What's checked into the repo vs. generated locally

`ios/.gitignore` (added by Capacitor) already excludes build artifacts, so these are
**not** committed and will regenerate locally on `cap sync` / when you build in Xcode:

- `ios/App/App/public` — the copied web bundle
- `ios/App/App/capacitor.config.json` — generated from `capacitor.config.ts`
- `ios/App/Pods`, `ios/App/build`, `ios/App/output`, `DerivedData`, `xcuserdata`

What **is** committed is the native Xcode project itself (`App.xcodeproj`, `AppDelegate.swift`,
`SceneDelegate.swift`, `Info.plist`, storyboards, asset catalog) plus the Swift Package
Manager manifest under `ios/App/CapApp-SPM`.

No secrets, API keys, or signing credentials are checked in anywhere in `ios/`. Supabase
config continues to come from the same env vars the web app already uses — nothing
iOS-specific was added.

## App Store risks / things to resolve before submitting

> **Update:** the app icon/splash screen and status bar/safe-area items below were
> resolved on the `ios-capacitor-app` branch after this doc was originally written — see
> `docs/ios-app-store.md`'s "Safe areas, status bar, splash screen, app icon" section for
> what's actually in place now. Left the original notes below for history.

- ~~**Placeholder app icon and launch screen.**~~ Resolved — see `docs/ios-app-store.md`.
- **App Store review — WebView-wrapped apps.** Apple's guidelines (4.2) require that
  web-wrapped apps offer enough native-feeling value and aren't "just a website in a
  wrapper." Status bar styling, safe-area handling, and a branded icon/splash are now in
  place; offline/error states inside the WebView and push notifications are still not set
  up (not required for a v1 pilot submission, see `docs/ios-app-store.md`).
- **Minor/parent-consent flows in review.** Apple reviewers will interact with the app as
  an anonymous tester. Confirm the sign-up and parent-consent screens behave sanely for a
  reviewer who isn't a real Livingston tennis player (this app was already built with that
  in mind on the web side; calling it out because App Store review is a new audience for
  it).
- **Privacy manifest / data collection disclosures.** Apple requires an App Privacy
  "nutrition label" in App Store Connect and, depending on which Capacitor plugins get
  added later, may require a `PrivacyInfo.xcprivacy` manifest. Only `@capacitor/core` and
  `@capacitor/ios` are installed right now (no camera/location/contacts plugins), so this
  is low-risk today, but revisit if more native plugins are added.
- **Underlying network calls still go to Supabase over HTTPS** from the WebView, same as
  the web app. `server.cleartext` is explicitly set to `false` in `capacitor.config.ts`, so
  plain-HTTP requests are disallowed at the native layer too.

Nothing above required changing app logic, and none of it was done — this section is a
list of what's still outstanding before an actual App Store submission.
