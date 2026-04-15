/**
 * Base URL for all /api/* calls.
 *
 * Both the browser (PWA) and the native Android app use relative paths here.
 *
 * For the PWA: the app is served from https://4stash.com, so relative /api/*
 * paths hit Firebase Hosting which rewrites them to the Cloud Functions.
 *
 * For Android: capacitor.config.ts sets server.url = "https://4stash.com",
 * which makes the Capacitor WebView load from Firebase Hosting directly.
 * The WebView origin is therefore https://4stash.com, so relative /api/*
 * paths also reach the Cloud Functions — and Instagram/Facebook iframes are
 * no longer blocked by X-Frame-Options (they allow https://4stash.com).
 *
 * VITE_API_BASE_URL should be left empty (or unset) in .env.
 */
const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Build an absolute-safe URL for a server API path.
 *
 * @example
 * apiUrl("/api/unfurl?url=" + encodeURIComponent(url))
 * // → "/api/unfurl?url=..." in both browser and Android
 */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
