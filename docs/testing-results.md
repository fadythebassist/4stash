# 4Stash Testing Results

Date started: 2026-04-19
Branch: `agentTest`

## Execution summary

### Completed so far

- Created working branch `agentTest` from `main`.
- Reviewed web and Android project structure.
- Confirmed production site reachability at `https://4stash.com`.
- Confirmed production entry redirects to `/login`.
- Captured a reusable authenticated production session with the clean Google account.
- Ran an authenticated production smoke pass across GitHub, YouTube, Facebook, Instagram, and Threads content.
- Filed GitHub issues for the confirmed repo-level testing problems.
- Fixed Android test package drift on branch `agentTest`.
- Built and synced the Android app, installed it on the connected SM-S928W phone, and launched it successfully.
- Fixed the Android instrumentation classpath conflict on branch `agentTest`.
- Reran `connectedDebugAndroidTest` successfully on the connected phone.
- Started repairing the Playwright social suite on branch `agentTest`.

### Pending

- Controlled Android sign-out/new-login coverage on the phone.
- Broader Playwright suite maintenance beyond the first selector fixes.
- Additional private or saved-platform social cases that require representative URLs or platform-specific access.

## Findings

### F-001: Analytics consent banner blocked automated login interaction

- Source: existing Playwright suite (`npm test`) against the current local app flow.
- Original result: the suite failed at the login step before any content-specific assertions ran.
- Symptom: the analytics consent banner intercepted pointer events over the Google sign-in button.
- Evidence: failure logs showed the consent dialog subtree intercepting clicks targeted at `button[title="Google"]`.
- Impact: first-run login automation was broken and the suite could not validate any downstream social behavior.
- Branch status: fixed locally in `tests/social.spec.ts` by pre-seeding analytics consent and dismissing the banner if it appears.
- GitHub issue: [#2](https://github.com/fadythebassist/4stash/issues/2).

### F-002: Production site loads the login shell successfully

- Source: live Playwright runtime inspection of `https://4stash.com`.
- Result: page resolved to `https://4stash.com/login`.
- Observed UI: analytics consent banner, login form, Google sign-in option, and privacy link were present in the DOM.
- Console state: no blocking runtime exceptions were captured in the first inspection pass.
- Status: informational baseline, not a defect.

### F-003: Authenticated production smoke pass succeeded for current public social coverage

- Source: `tools/prod-live-smoke.mjs` run against `https://4stash.com` using the authenticated production session.
- Cases executed: GitHub repo card, YouTube watch URL, Facebook public post, Facebook group post, Facebook profile-style post, Instagram reel, Instagram post, Threads text post, Threads video post.
- Result: all scripted cases saved successfully to real Firestore and rendered cards or embeds after hydration.
- UX notes:
  - Threads embeds initially showed `Loading preview...` during the first capture, but hydrated correctly on a delayed recheck.
  - YouTube rendered a valid iframe player after an additional wait.
  - Facebook coverage currently renders as branded fallback cards for the tested public/group/profile post URLs.
- Status: pass for the public cases exercised so far; not evidence of support for private or saved-platform content.

### F-004: Android tests are still mostly default scaffold coverage

- Source: Android source inspection.
- Result: the test tree is still essentially placeholder coverage, even after fixing package drift.
- Impact: Android-specific regression coverage remains shallow.
- GitHub issue: [#1](https://github.com/fadythebassist/4stash/issues/1).
- Status: confirmed test-gap issue.

### F-005: Android instrumented test package assertion was stale

- Source: source inspection plus branch fix verification.
- Result: the instrumentation test asserted `com.getcapacitor.app` while the actual namespace/application ID is `com.fourstash.app`.
- Impact: instrumentation would fail immediately for the wrong reason.
- Branch status: fixed on `agentTest` by moving the scaffold tests under `com.fourstash.app` and updating the assertion.
- Verification: `android\gradlew.bat testDebugUnitTest` completed successfully.
- GitHub issue: [#1](https://github.com/fadythebassist/4stash/issues/1).

### F-006: Playwright social suite remains stale after the first unblock

- Source: rerun of `npm test` after the login-consent fix.
- Result: the suite progressed past login but still failed broadly because several assertions assume removed UI and outdated embed selectors.
- Confirmed examples:
  - stale list selector assumptions against the current checkbox-based list picker
  - stale `.youtube-embed-container` expectation even though the card now exposes a YouTube iframe without that container class
- Verification:
  - targeted rerun `npx playwright test tests/social.spec.ts -g "GH1|YT1|FB1"` produced `2 passed, 1 failed`
  - `FB1` and `GH1` now pass
- `YT1` still fails on an outdated selector
- GitHub issue: [#2](https://github.com/fadythebassist/4stash/issues/2).

### F-007: `connectedDebugAndroidTest` originally failed due to duplicate Kotlin stdlib artifacts

- Source: first real-device run of `android\gradlew.bat connectedDebugAndroidTest`.
- Original failure: `:capacitor-cordova-android-plugins:checkDebugAndroidTestDuplicateClasses`.
- Root cause: transitive `kotlin-stdlib-jdk7:1.6.21` and `kotlin-stdlib-jdk8:1.6.21` were present alongside `kotlin-stdlib:1.8.22`.
- Branch status: fixed on `agentTest` by excluding `kotlin-stdlib-jdk7` and `kotlin-stdlib-jdk8` in [android/build.gradle](C:/Users/Fady/GitHub/4stash/android/build.gradle).
- Verification: rerunning `connectedDebugAndroidTest` succeeded on the connected SM-S928W device.
- GitHub issue: [#3](https://github.com/fadythebassist/4stash/issues/3).

### F-008: Real-device Android app launches and renders a logged-in data set successfully

- Source: install and launch on connected SM-S928W phone running Android 16.
- Result: the app launched into [MainActivity](C:/Users/Fady/GitHub/4stash/android/app/src/main/java/com/fourstash/app/MainActivity.java) and rendered a populated dashboard with live items, sources, and tags.
- Evidence:
  - [android-home-2.png](C:/Users/Fady/GitHub/4stash/test-results/android-home-2.png)
  - [android-search.png](C:/Users/Fady/GitHub/4stash/test-results/android-search.png)
- Interaction notes:
  - Search accepted input and surfaced Threads-related content on-device.
  - The app remained responsive during filter/search interactions.
- Status: pass for startup/render/search sanity on the connected phone.

## Commands run

- `git -C C:\Users\Fady\GitHub\4stash checkout -b agentTest main`
- `npx playwright screenshot --device="Desktop Chrome" https://4stash.com test-results/live-home.png`
- `npm test`
- `node .\tools\prod-auth-capture.mjs`
- `node .\tools\prod-live-smoke.mjs`
- `android\gradlew.bat testDebugUnitTest`
- `npm run build:android`
- `android\gradlew.bat installDebug`
- `android\gradlew.bat connectedDebugAndroidTest`
- `npx playwright test tests/social.spec.ts -g "GH1|YT1|FB1"`

## Blockers

- Full Android first-run auth coverage still needs a controlled sign-out/new-login pass on the connected phone.
- Saved/private social cases need representative URLs or separate platform access to be exercised credibly.

## Next run focus

1. Continue updating the Playwright suite to current social card markup and behavior.
2. Run a controlled Android sign-out/new-login pass on the connected phone if first-run auth verification is required.
3. Extend the production matrix with private or saved-platform cases if representative URLs are provided.
