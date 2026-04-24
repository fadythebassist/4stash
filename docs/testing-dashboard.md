# Testing Dashboard

Last updated: 2026-04-19
Active branch: `agentTest`
Primary target: `https://4stash.com`

| Task | Scope | Status | Notes |
| --- | --- | --- | --- |
| Repo branching | Local repo | Done | `agentTest` created from `main`. |
| Codebase review | Web + Android | Done | React/Vite web app, Capacitor Android app, Playwright suite, and Android scaffold tests mapped. |
| Production reachability check | Web | Done | `https://4stash.com` loads and redirects to `/login`. |
| Production auth setup | Web | Done | Reusable production session captured in Chrome with the clean Google account. |
| Production web test plan | Web UX + content flows | Done | Expanded for Facebook, Instagram, Threads, and UX behavior. |
| Production test execution | Web | In progress | Authenticated smoke pass completed for GitHub, YouTube, Facebook, Instagram, and Threads public content. |
| Android production test execution | Android | In progress | Connected-phone install, launch, screenshots, search check, and instrumentation run completed on SM-S928W (Android 16). |
| Results log | Web + Android | In progress | Updated with production smoke results, issue links, and branch-local fixes. |
| GitHub issue filing | Repo issues | Done | Confirmed issues filed as `#1`, `#2`, and `#3`. |
| P0/P1 fixes | Branch `agentTest` | In progress | Android package drift fixed, Android Kotlin test-classpath fix applied, and Playwright suite repair started. |

## Current blockers

- Full Android first-run auth testing still needs a controlled sign-out/new-login pass on the phone.
- Private or account-specific social cases such as Instagram saved posts still need representative URLs or separate platform access.

## Next actions

1. Continue updating the Playwright social suite to current card markup and behavior.
2. Run a controlled Android sign-out/new-login pass on the connected phone if you want first-run auth verified there.
3. Extend production coverage for saved/private social cases if representative URLs are provided.
