# Renaming Plan: 4Later → 4Stash

## Overview

This document is the complete, step-by-step plan for renaming the app from **4Later** to **4Stash** and the domain from **4later.xyz** to **4stash.com**.

**Domain status:** `4stash.com` is already registered on Cloudflare. No Firebase changes have been made yet.

### Rename Mapping

| Old | New |
|---|---|
| `4Later` / `4later` (display name) | `4Stash` / `4stash` |
| `4later.xyz` | `4stash.com` |
| `4later.app` (used in User-Agent / OG meta) | `4stash.com` |
| `demo@4later.app` (mock demo user email) | `demo@4stash.com` |
| `4later_mock_data` (localStorage key) | `4stash_mock_data` |
| `4later_cached_user` (localStorage key) | `4stash_cached_user` |
| `4later_analytics_consent` (localStorage key) | `4stash_analytics_consent` |
| `4later_mock_data_backup` (localStorage key) | `4stash_mock_data_backup` |
| `4later-unfurl` (Vite plugin name) | `4stash-unfurl` |

---

## CRITICAL: Data Migration Warning

> **Existing users who installed the PWA or used the app in a browser have data stored under the `4later_mock_data` localStorage key. If the code is updated without a migration step, those users will be logged out and lose all their saved data.**

The migration step (Phase 1, Step 3) must be done **before** deploying any code changes.

---

## Phase 1 — Source Code Changes

These are changes to the codebase that are safe to do locally and commit. Do them all at once, then run lint + build to verify before deploying.

### Step 1 — Package Metadata

**`package.json`**
- Line 2: `"name": "4later"` → `"name": "4stash"`

**`functions/package.json`**
- Line 2: `"name": "4later-functions"` → `"name": "4stash-functions"`
- Line 3: `"description": "Firebase Cloud Functions for 4Later"` → `"...for 4Stash"`

> `package-lock.json` and `functions/package-lock.json` will update automatically on the next `npm install`. Do not edit them manually.

---

### Step 2 — Environment File

**`.env`** (not committed — update locally)
- `VITE_THREADS_REDIRECT_URI=https://4later.xyz/threads-oauth-callback.html`
  → `https://4stash.com/threads-oauth-callback.html`

> Do not commit `.env`. This change must be made manually on every machine that runs the app, and also set in the Firebase Functions environment config (see Phase 3).

---

### Step 3 — localStorage Key Migration (CRITICAL)

**`src/services/MigrationService.ts`**

Add a one-time migration routine at the top of the migration logic that runs before any other data access. It should:

1. Check if `4later_mock_data` exists in localStorage.
2. If yes, copy its value to `4stash_mock_data` (if `4stash_mock_data` does not already exist).
3. Check if `4later_cached_user` exists and copy it to `4stash_cached_user`.
4. Check if `4later_analytics_consent` exists and copy it to `4stash_analytics_consent`.
5. Check if `4later_mock_data_backup` exists and copy it to `4stash_mock_data_backup`.
6. Set a flag (e.g., `4stash_migrated_from_4later = "1"`) to prevent the migration from running again.
7. Do NOT remove the old keys yet — give users at least one release cycle before removing them.

Then update all hardcoded key references throughout the file:
- Line 34: `"4later_mock_data"` → `"4stash_mock_data"`
- Line 139: `"4later_mock_data_backup"` → `"4stash_mock_data_backup"`
- Line 141: log message → update to `"4stash_mock_data_backup"`
- Line 145: commented-out `removeItem('4later_mock_data')` → `'4stash_mock_data'`
- Line 152: log message → update to `"4stash_mock_data"`

---

### Step 4 — Service & Context Files

**`src/services/MockStorageService.ts`**
- Line 146: `"4later_mock_data"` → `"4stash_mock_data"`
- Lines 275, 285, 320, 330, 353, 363: `"demo@4later.app"` → `"demo@4stash.com"`

**`src/contexts/AuthContext.tsx`**
- Line 38: `"4later_cached_user"` → `"4stash_cached_user"`

**`src/services/AnalyticsService.ts`**
- Line 6: `"4later_analytics_consent"` → `"4stash_analytics_consent"`

**`src/pages/Recovery.tsx`**
- Line 23: `localStorage.getItem("4later_mock_data")` → `"4stash_mock_data"`
- Line 49: `localStorage.setItem("4later_mock_data", ...)` → `"4stash_mock_data"`

**`src/components/SettingsModal.tsx`**
- Line 44: `https://4later.xyz/threads-oauth-callback.html` → `https://4stash.com/threads-oauth-callback.html`

---

### Step 5 — UI / Display Text

**`src/pages/Dashboard.tsx`**
- Line 259: `<h1 className="dashboard-logo">4Later</h1>` → `4Stash`

**`src/pages/Login.tsx`**
- Line 93: `<div className="auth-brand-logo">4Later</div>` → `4Stash`
- Line 105: `<h1 className="auth-logo">4Later</h1>` → `4Stash`
- Line 108: `4Later is a multimedia content organizer...` → `4Stash`

**`src/pages/Register.tsx`**
- Line 101: `<div className="auth-brand-logo">4Later</div>` → `4Stash`
- Line 113: `<h1 className="auth-logo">4Later</h1>` → `4Stash`

**`src/pages/Privacy.tsx`**
- Line 9: `<div class="privacy-logo">4Later</div>` → `4Stash`
- Lines 17, 17: `4Later ("we", "our", or "us"). 4Later is...` → `4Stash` (×2)
- Line 145: `4Later is not directed at children under 13.` → `4Stash`
- Line 176: `<a href="/login">Back to 4Later</a>` → `Back to 4Stash`

**`src/components/AnalyticsConsentBanner.tsx`**
- Line 64: `Help improve 4Later with anonymous analytics?` → `4Stash`

---

### Step 6 — HTML & PWA Manifest

**`index.html`**
- Line 21: `og:title` → `"4Stash - Save Content for Later"`
- Line 24: `og:url` → `https://4stash.com`
- Line 31: `twitter:title` → `"4Stash - Save Content for Later"`
- Line 35: `<title>4Stash - Save Content for Later</title>`

**`public/landing.html`**
- Line 6: meta description → `4Stash`
- Line 8: `og:title` → `"4Stash - Save Content for Later"`
- Line 9: `og:description` → `4Stash`
- Line 11: `og:url` → `https://4stash.com`
- Line 12: `<title>4Stash - Save Content for Later</title>`
- Line 91: `<div class="logo">4Stash</div>`
- Lines 94–96: body copy → `4Stash`

**`vite.config.ts`**
- Line 1163: User-Agent header `"4Later/1.0; +https://4later.app"` → `"4Stash/1.0; +https://4stash.com"`
- Line 1368: Plugin name `"4later-unfurl"` → `"4stash-unfurl"`
- Line 1419: `manifest.name: "4Later"` → `"4Stash"`
- Line 1420: `manifest.short_name: "4Later"` → `"4Stash"`

---

### Step 7 — Backend: Firebase Cloud Functions

**`functions/src/index.ts`** (edit this — do NOT edit `functions/lib/index.js` directly)
- Line 922: comment `// CORS — allow 4later.xyz and localhost dev` → `4stash.com`
- Line 924: `"https://4later.xyz"` in `allowedOrigins` array → `"https://4stash.com"`
- Line 928: `res.setHeader("Access-Control-Allow-Origin", "https://4later.xyz")` → `"https://4stash.com"`
- Line 1458: User-Agent `"4Later/1.0; +https://4later.app"` → `"4Stash/1.0; +https://4stash.com"`

After editing the TypeScript source, rebuild the functions:
```bash
cd functions && npm run build
```
This regenerates `functions/lib/index.js` automatically — do not touch it manually.

---

### Step 8 — Dev Tools & Scripts

**`debug-users.html`**
- Line 4: `<title>4Stash User Debug Tool</title>`
- Line 18: `<h1>4Stash User Debug Tool</h1>`
- Line 29: `localStorage.getItem('4stash_mock_data')`
- Line 34: `localStorage.setItem('4stash_mock_data', ...)`
- Line 81: alert text → `4Stash`
- Line 122: `localStorage.removeItem('4stash_mock_data')`
- Line 133: `a.download = '4stash-backup-...'`

**`start.bat`**
- Line 8: `echo Starting 4stash on port 5173...`

---

### Step 9 — Documentation Files

These do not affect runtime behavior but should be updated for consistency.

| File | What to Change |
|---|---|
| `README.md` | App name (lines 1, 34, 35, 81, 119), repo clone path, directory name |
| `AGENTS.md` | Line 32: `4later_` key prefix description → `4stash_` |
| `CLAUDE.md` | Lines 25, 50: `4later_` prefix, "share content to 4Later" |
| `renaming.md` | This file was a previous rename attempt (target was "4Latr"). Archive or delete it. |
| `docs/testing/TESTING.md` | Line 11: `demo@4later.app` → `demo@4stash.com` |
| `docs/getting-started/QUICK_START.md` | Lines 8, 27, 131: `cd` path, `demo@4later.app` |
| `docs/getting-started/PROJECT_SUMMARY.md` | Line 297: `cd` path |
| `docs/firebase/FIREBASE_SWITCH_GUIDE.md` | Lines 132, 187: `'4later_mock_data'` in code examples |
| `docs/firebase/FIREBASE_MIGRATION_SUMMARY.md` | Line 82: `demo@4later.app` |
| `docs/firebase/FIREBASE_SETUP.md` | Line 7: suggested project name `4later` |
| `docs/firebase/FIREBASE_MIGRATION_GUIDE.md` | Lines 23, 197: project name suggestion, `demo@4later.app` |
| `docs/authentication/SOCIAL_LOGIN_SETUP.md` | Line 162: `demo@4later.app` |
| `docs/authentication/THREADS_AUTH_GUIDE.md` | Line 27: app name `4Later` in Meta Developer Portal |

---

### Step 10 — Verify Locally

After all code changes:

```bash
npm run lint    # Must pass with zero warnings
npm run build   # Must pass type-check and bundle
```

Fix any issues before proceeding to the external/platform steps below.

---

## Phase 2 — Cloudflare DNS & Domain Setup

You already own `4stash.com` on Cloudflare. No changes have been made yet.

### Step 1 — Point 4stash.com to Firebase Hosting

Firebase Hosting uses TXT and A records for domain verification and traffic routing.

1. In the **Firebase Console** → Hosting → **Add custom domain** → enter `4stash.com`.
2. Firebase will provide a TXT record for domain verification. Add it in the **Cloudflare DNS** dashboard.
3. Firebase will then provide A records (two IPs). Add them as **A records** in Cloudflare DNS for `@` (root domain).
4. Also add the same A records for `www` (pointing `www.4stash.com` to Firebase Hosting).
5. In Cloudflare, set the proxy status for these records to **DNS only** (grey cloud, not orange) — Firebase Hosting manages its own SSL; Cloudflare proxying can interfere with Firebase SSL provisioning.
6. Wait for Firebase to provision the SSL certificate (can take up to 24 hours).

### Step 2 — Redirect 4later.xyz → 4stash.com (Optional but Recommended)

If you control `4later.xyz` on Cloudflare:

1. Keep the DNS records for `4later.xyz` active.
2. Use a **Cloudflare Page Rule** or **Redirect Rule** on `4later.xyz/*` to perform a **301 Permanent Redirect** to `https://4stash.com/$1`.
3. This preserves SEO equity and avoids breaking bookmarked links for existing users.

> If `4later.xyz` is expiring and you will not renew it, skip this step.

---

## Phase 3 — Firebase Console Changes

### Step 1 — Rename the Firebase Project Display Name (Cosmetic Only)

1. Firebase Console → Project Settings → General.
2. Change **Project name** from `4Later` to `4Stash`.
3. This is a display-name-only change. The **Project ID** (`later-production-9a596`) is permanent and cannot be changed. No code changes are needed as a result.

### Step 2 — Add 4stash.com as a Custom Hosting Domain

Already covered in Phase 2, Step 1. After Firebase validates `4stash.com`, it will appear in Hosting → Custom domains.

### Step 3 — Update Authorized Domains for Firebase Auth

Firebase Auth has a list of authorized domains for OAuth redirects. You must add `4stash.com` to this list.

1. Firebase Console → Authentication → **Settings** → **Authorized domains**.
2. Add `4stash.com`.
3. Add `www.4stash.com` if you plan to support it.
4. Keep `4later.xyz` in the list until all users have migrated and you are certain no one is still using it.

### Step 4 — Update Firebase Functions Environment Variables

If the Threads redirect URI is stored as a Firebase Functions config variable or environment variable, update it:

```bash
firebase functions:config:set app.threads_redirect_uri="https://4stash.com/threads-oauth-callback.html"
```

Or if using `.env` files in the functions directory, update `VITE_THREADS_REDIRECT_URI` there as well.

Then redeploy functions:
```bash
firebase deploy --only functions
```

---

## Phase 4 — Meta Developer Portal (Facebook & Threads Apps)

You have two apps on the Meta Developer Portal that need to be updated.

### App 1 — Threads App (ID: 2007394746472768)

1. Go to [developers.facebook.com](https://developers.facebook.com) → Your Apps → select the Threads app.
2. **App Settings → Basic:**
   - Change **Display Name** from `4Later` to `4Stash`.
   - Update **App Domains**: remove `4later.xyz`, add `4stash.com`.
   - Update **Privacy Policy URL** if it points to `4later.xyz/privacy` → `4stash.com/privacy`.
   - Update **Terms of Service URL** if applicable.
3. **Threads API → Settings:**
   - Update **Redirect Callback URLs**: remove `https://4later.xyz/threads-oauth-callback.html`, add `https://4stash.com/threads-oauth-callback.html`.
4. Save all changes.

> Note: The `threads-oauth-callback.html` file itself does not contain any "4later" references — it does not need code changes.

### App 2 — Facebook App (ID: 1386216603247526)

This app is used for **Facebook Login** via Firebase Auth. The OAuth redirect goes through Firebase's auth handler domain (`https://later-production-9a596.firebaseapp.com/__/auth/handler`), **not** through your custom domain. Therefore most settings here may not need changing, but verify the following:

1. Go to [developers.facebook.com](https://developers.facebook.com) → Your Apps → select the Facebook Login app.
2. **App Settings → Basic:**
   - Change **Display Name** from `4Later` to `4Stash` (if currently set).
   - Update **App Domains**: remove `4later.xyz` (if listed), add `4stash.com`.
   - Update **Privacy Policy URL** if it points to `4later.xyz`.
3. **Facebook Login → Settings:**
   - Verify **Valid OAuth Redirect URIs** — the Firebase auth handler URI (`https://later-production-9a596.firebaseapp.com/__/auth/handler`) does **not** need to change.
   - If `https://4later.xyz` is listed as a redirect URI anywhere, remove it and add `https://4stash.com`.
4. Save all changes.

---

## Phase 5 — Deploy & Verify

### Step 1 — Deploy Frontend

```bash
npm run build
firebase deploy --only hosting
```

Verify the app loads correctly at both the new and old domains (if keeping the redirect).

### Step 2 — Deploy Functions

```bash
cd functions && npm run build
firebase deploy --only functions
```

### Step 3 — Smoke Test Checklist

After deploying, verify the following manually:

- [ ] `https://4stash.com` loads the app with the new name displayed
- [ ] `https://4stash.com/privacy` shows "4Stash" in the privacy policy
- [ ] PWA install prompt shows "4Stash" as the app name
- [ ] Login page shows "4Stash" branding
- [ ] Google Sign-In works
- [ ] Facebook Sign-In works
- [ ] Twitter/X Sign-In works (if enabled)
- [ ] Threads OAuth flow redirects to `https://4stash.com/threads-oauth-callback.html` and succeeds
- [ ] Existing users' data is preserved (localStorage migration worked)
- [ ] New users can sign up and save items
- [ ] The unfurl API (`/api/unfurl`) returns results (CORS headers include `4stash.com`)
- [ ] `https://4later.xyz` redirects to `https://4stash.com` (if redirect rule was set up)

---

## Summary: Files Changed in Codebase (36 Files)

| # | File | Category | Changes |
|---|---|---|---|
| 1 | `package.json` | Package meta | App name |
| 2 | `package-lock.json` | Package meta | Auto-regenerated via `npm install` |
| 3 | `functions/package.json` | Package meta | Name + description |
| 4 | `functions/package-lock.json` | Package meta | Auto-regenerated via `npm install` |
| 5 | `index.html` | HTML/SEO | OG tags, title, domain |
| 6 | `public/landing.html` | HTML/SEO/Display | Title, OG tags, domain, body copy |
| 7 | `vite.config.ts` | Config/PWA | Manifest name, user-agent, plugin name |
| 8 | `.env` | Environment | Threads redirect URI |
| 9 | `src/services/MockStorageService.ts` | Source (functional) | localStorage keys, demo email |
| 10 | `src/services/MigrationService.ts` | Source (functional) | localStorage keys + new migration step |
| 11 | `src/services/AnalyticsService.ts` | Source (functional) | localStorage key |
| 12 | `src/contexts/AuthContext.tsx` | Source (functional) | localStorage key |
| 13 | `src/pages/Recovery.tsx` | Source (functional) | localStorage key |
| 14 | `src/components/SettingsModal.tsx` | Source (functional) | Threads redirect URI |
| 15 | `src/pages/Dashboard.tsx` | Display text | App name |
| 16 | `src/pages/Login.tsx` | Display text | App name (×3) |
| 17 | `src/pages/Register.tsx` | Display text | App name (×2) |
| 18 | `src/pages/Privacy.tsx` | Display text | App name (×5) |
| 19 | `src/components/AnalyticsConsentBanner.tsx` | Display text | App name |
| 20 | `functions/src/index.ts` | Backend source | CORS domain, user-agent (×4) |
| 21 | `functions/lib/index.js` | Compiled output | Auto-regenerated via `npm run build` in functions/ |
| 22 | `debug-users.html` | Dev tool | App name, localStorage keys, download filename |
| 23 | `start.bat` | Dev script | App name |
| 24 | `README.md` | Docs | App name, repo path |
| 25 | `AGENTS.md` | Docs | localStorage key prefix |
| 26 | `CLAUDE.md` | Docs | localStorage key prefix, app name |
| 27 | `renaming.md` | Docs | Archive or delete (old plan targeting "4Latr") |
| 28 | `docs/testing/TESTING.md` | Docs | Demo email |
| 29 | `docs/getting-started/QUICK_START.md` | Docs | App name, demo email, path |
| 30 | `docs/getting-started/PROJECT_SUMMARY.md` | Docs | Path |
| 31 | `docs/firebase/FIREBASE_SWITCH_GUIDE.md` | Docs | localStorage key in examples |
| 32 | `docs/firebase/FIREBASE_MIGRATION_SUMMARY.md` | Docs | Demo email |
| 33 | `docs/firebase/FIREBASE_SETUP.md` | Docs | Suggested project name |
| 34 | `docs/firebase/FIREBASE_MIGRATION_GUIDE.md` | Docs | Project name suggestion, demo email |
| 35 | `docs/authentication/SOCIAL_LOGIN_SETUP.md` | Docs | Demo email |
| 36 | `docs/authentication/THREADS_AUTH_GUIDE.md` | Docs | App name in Meta Portal instructions |

---

## Things That Do NOT Change

| Item | Reason |
|---|---|
| Firebase Project ID `later-production-9a596` | Permanent and immutable — cannot be changed |
| `.firebaserc` | References the project ID, which stays the same |
| `firebase.json` | No "4later" references — no changes needed |
| Facebook Login OAuth redirect URI (`https://later-production-9a596.firebaseapp.com/__/auth/handler`) | Goes through Firebase auth domain, not the custom domain |
| `threads-oauth-callback.html` | File itself has no "4later" text; only the URL pointing to it changes |
| `tsconfig.json` / `tsconfig.node.json` | No "4later" references |
| `src/types/index.ts` | No "4later" references |
| CI/CD pipeline files | No `.github/workflows/` exists |
