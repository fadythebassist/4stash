# 4Stash Production Testing Plan

Date: 2026-04-19
Branch: `agentTest`
Primary environment: production web app at `https://4stash.com`

## Objectives

- Validate real Firebase authentication and first-run onboarding behavior.
- Exercise production save/render flows using real content and real account data.
- Expand coverage beyond current automated tests with stronger UX checks.
- Identify confirmed defects worth filing as GitHub issues and fixing on the working branch.

## Web test areas

### 1. Authentication and first-run experience

- Load `https://4stash.com` as a new user and verify redirect/login behavior.
- Verify analytics consent banner behavior, dismissal, persistence, focus order, and impact on primary login actions.
- Test Google sign-in from a clean account.
- Verify post-login landing, default lists, and empty-state guidance.
- Test sign-out and re-entry behavior.

### 2. Core save flows

- Save generic links and verify metadata extraction.
- Save YouTube, Vimeo, Reddit, GitHub, Medium, and LinkedIn content.
- Validate add-item modal behavior, loading states, errors, and recovery.
- Verify list assignment, item persistence, and item detail rendering.

### 3. Facebook coverage

- Standard post URLs.
- Video posts.
- Reels or watch/video variants.
- Profile-post URLs.
- Group-post URLs.
- Share URLs and login-wall redirects.
- Fallback rendering when embeds are not available.
- Thumbnail, title, source badge, and playback UX.

### 4. Instagram coverage

- Standard post URLs.
- Reels.
- Carousel or multi-item posts.
- Login-gated or saved-post style URLs if reachable.
- Thumbnail rendering, fallback behavior, and card/detail UX.

### 5. Threads coverage

- Text-only posts.
- Posts with video.
- Thumbnail behavior for video posts.
- Playback and interaction affordances.
- Connection or permission prompts and fallback behavior.

### 6. User experience checks

- Visual first impression on desktop/mobile-sized viewport.
- Readability and contrast on login and dashboard surfaces.
- Responsiveness and overflow handling.
- Modal usability and dismissal paths.
- Empty states, error messaging, and loading feedback.
- Consent banners, prompts, and dialogs blocking key actions.
- Delete/archive safety and confirmation behavior.

## Android test areas

### 1. Build and packaging

- Verify Android project builds cleanly from current source.
- Run available local unit tests.
- Run instrumentation tests if emulator/device is available.

### 2. Production auth and app shell

- Launch the app on device/emulator.
- Verify Google sign-in on Android.
- Confirm post-auth dashboard load and data sync.

### 3. Content flows and UX

- Save and render representative social links.
- Validate native/webview handoff, thumbnails, embeds, and playback.
- Check navigation, back behavior, keyboard handling, and permissions.

## Evidence and outputs

- `docs/testing-results.md` records execution evidence, blockers, and confirmed findings.
- `docs/testing-dashboard.md` tracks current work and status.
- Confirmed defects will be filed as GitHub issues in `fadythebassist/4stash`.

## Exit criteria

- Production-authenticated web smoke pass completed.
- Android execution surface verified and tested as far as available hardware allows.
- Confirmed defects documented in Markdown and filed in GitHub.
- Highest-priority reproducible defects queued for or started in code fixes on `agentTest`.
