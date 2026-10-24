# Squad Number on phones

The game is a web app that installs like an app. The same code later goes into the App Store and Google Play through a wrapper.

## The fast loop: PWA, not Xcode

Xcode is the slow path (a build and a cable for every change). The web app is the fast one. Two loops:

**1. Instant, on your own Wi-Fi (no deploy, no install).**

```bash
npm run dev:phone
```

Open the `Network` address it prints (for example `http://192.168.4.140:5173`) in Safari on the phone. Every save in the code refreshes the phone within a second. This is the loop for screens, layout and balance. It is plain `http`, so it cannot be installed or run offline, and careers saved here are separate from the installed app's.

**2. The installed app, from an https address.**

The built app is a folder of static files (`dist/`). Put it on any static host and open that address on the phone. One-time set up with Netlify:

```bash
npx netlify-cli login        # opens a browser once
npx netlify-cli init         # creates a site, publish directory: dist
```

Then every release is one command, about 20 seconds:

```bash
npm run deploy:netlify
```

Cloudflare Pages works the same way (`npm run deploy:cloudflare` after `npx wrangler login`). `public/_headers` already tells both hosts to re-check the page and the service worker on every visit, so updates arrive.

**How an update reaches the phone.** Each build stamps a new version into the service worker. Next time the installed app is open and online, it downloads the new version in the background and shows a banner: A new version is ready, Reload. Settings, Install on your phone, shows the build time so you can confirm which version you have.

**Two things to know on iPhone.** Safari has no vibration feedback. And the installed Home Screen app keeps its own storage, separate from Safari tabs, so a career started in a Safari tab will not appear in the installed app. Use Export, then Import, to move one across.

The iPhone project in `ios/` stays in the repo for when the App Store matters; it is not needed for day to day work.

## What works today

- **Installable.** `public/manifest.webmanifest` and the icons in `public/` let a phone add it to the home screen and open it full screen, in portrait. Settings has an Install button, with steps for iPhone.
- **Offline.** `public/sw.js` saves the app on the first visit and opens it with no connection. It is only registered in a built app (`npm run build`), never in the dev server.
- **Saves.** Careers live in IndexedDB on the device, in three slots, and the app asks the browser not to clear them. Export and import move a career as a file.
- **Phone layout.** A bottom tab bar, a slim top bar, cards instead of wide tables, and the match decision as a sheet from the bottom. Safe areas (notches, home bar) are handled in the CSS.

Re-draw the icons with `python3 scripts/make-icons.py` (it also writes the iPhone app icon).

## To try it on a phone now

```bash
npm run build
npm run preview -- --host
```

Open the address it prints from the phone on the same network. Installing from a plain `http` address works on Android over localhost only; for a real phone you need `https`, so the quickest test is to host `dist/` on any static host (Netlify, Cloudflare Pages, GitHub Pages) and open that link.

## Running it on your iPhone from Xcode (no hosting needed)

The native iPhone project is already set up in `ios/` (Capacitor 8, Swift Package Manager, so no CocoaPods).

```bash
npm run ios          # builds the game, copies it into the iPhone project, opens Xcode
```

In the iPhone simulator: pick a simulator in the Xcode toolbar and press Run. Or from the terminal, with a simulator already booted:

```bash
npm run ios:sync
cd ios/App
xcodebuild -project App.xcodeproj -scheme App -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted com.squadnumber.game
```

On your own iPhone (a free Apple ID is enough):
1. In Xcode, Settings, Accounts: sign in with your Apple ID.
2. Click the App project, the App target, Signing & Capabilities. Tick Automatically manage signing and choose your Personal Team. Change the Bundle Identifier to something unique to you, for example `com.yourname.squadnumber`.
3. Plug the iPhone in with a cable and unlock it. Tap Trust. Turn on Developer Mode (Settings, Privacy and Security, Developer Mode) and restart if it asks.
4. Choose your iPhone in the Xcode toolbar and press Run.
5. First time only: on the iPhone, Settings, General, VPN and Device Management, trust your developer profile.

With a paid developer account you pick your real team instead of a Personal Team, and the app does not expire. (With only a free Apple ID it stops opening after 7 days.) Press Run again to refresh it; your saved careers stay on the phone. A paid developer account removes that limit and enables TestFlight.

The app icon is drawn by `scripts/make-icons.py` and the bundle id and name are in `capacitor.config.ts`.

## TestFlight and the App Store (paid developer account)

The project is already set to portrait only and declares that it uses no special encryption (`ITSAppUsesNonExemptEncryption` is false in `ios/App/App/Info.plist`), which saves a prompt on every upload.

1. In App Store Connect, My Apps, add an app with the same bundle identifier you chose in Xcode.
2. In Xcode choose Any iOS Device as the destination, then Product, Archive.
3. In the Organizer, Distribute App, App Store Connect, Upload.
4. The build appears in TestFlight after processing. Add yourself as an internal tester and install it from the TestFlight app on your phone. Internal testing does not need Apple review.
5. For the public store: add screenshots, a description, an age rating, a privacy policy link and the privacy answers (nothing is collected), then submit for review.

## Wrapping it for the stores (Capacitor)

Capacitor puts the built web app inside a native shell. Nothing in the game has to change, apart from the extras below.

```bash
npm i @capacitor/core @capacitor/cli
npx cap init "Squad Number" com.yourname.squadnumber --web-dir dist
npm i @capacitor/ios @capacitor/android
npm run build
npx cap add ios && npx cap add android
npx cap sync
npx cap open ios        # Xcode, needs a Mac
npx cap open android    # Android Studio
```

Each time the game changes: `npm run build && npx cap sync`.

### Worth adding before a store release

- **Haptics** (`@capacitor/haptics`): a tap on a decision, a buzz on a goal.
- **Status bar and splash** (`@capacitor/status-bar`, `@capacitor/splash-screen`), with a 1024 pixel icon and a splash image.
- **Android back button:** call the game's own `back()` (the history in the top bar) and exit only from Home.
- **Keep the screen awake** during a live match (`@capacitor-community/keep-awake`).
- **Save safety:** IndexedDB works inside the wrapper, but a cloud save or a regular automatic export would protect long careers from a lost phone.

### Store requirements (check the current rules and fees before you start)

- An Apple Developer account (yearly fee) and a Google Play developer account (one-time fee).
- A privacy policy page, even if the game collects nothing. The game stores everything on the device and has no accounts, ads or network calls, which keeps the privacy answers simple.
- Age rating questionnaires, screenshots for each device size, and a short and long description.
- The game uses invented clubs and names, so there is no licensing to clear. Keep it that way.

## Not done yet

Vibration feedback, the native wrapper itself, testing on a real device, and the phone polish for Career, Club, Schedule, Cup and the Training detail.
