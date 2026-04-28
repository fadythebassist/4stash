import React, { useEffect, useRef, useState } from "react";
import { openPlatformUrl } from "@/utils/openPlatformUrl";
import { apiUrl, isAndroidWebView } from "@/utils/apiBase";
import "./SocialCard.css";

interface ThreadsEmbedProps {
  url: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  onThumbnailError?: () => void;
}

function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function isLoginWallTitle(t?: string): boolean {
  if (!t) return false;
  return t.includes("Log in") || t.includes("Threads \u2022 Log in");
}

function isLoginWallDescription(d?: string): boolean {
  if (!d) return false;
  const lower = d.toLowerCase();
  return (
    lower.includes("join threads to share ideas") ||
    lower.includes("log in with your instagram") ||
    lower.includes("say more with threads")
  );
}

function shouldProxyThumbnail(urlStr?: string): boolean {
  if (!urlStr) return false;
  if (urlStr.includes("/api/proxy-image?")) return false;

  try {
    const hostname = new URL(urlStr, window.location.origin).hostname.toLowerCase();
    return (
      // Don't proxy cdninstagram.com — time-sensitive signed tokens that fail when proxied.
      // Load directly; onError → re-unfurl will refresh the URL if it's expired.
      hostname.includes("instagram.com") && !hostname.includes("cdninstagram.com") ||
      hostname.endsWith("fbcdn.net") ||
      hostname.includes("facebook.com") ||
      hostname.endsWith("fbsbx.com")
    );
  } catch {
    return false;
  }
}

function toProxyThumbnail(urlStr?: string): string | undefined {
  if (!urlStr) return undefined;
  if (urlStr.startsWith("/api/proxy-image?")) return apiUrl(urlStr);
  if (!shouldProxyThumbnail(urlStr)) return urlStr;
  return apiUrl(`/api/proxy-image?url=${encodeURIComponent(urlStr)}`);
}

// Threads embed.js registers itself on window.instgrm (same key as Instagram).
// We capture it once on load and store it separately so Instagram's embed.js
// cannot overwrite our reference.
const threadsWin = window as unknown as {
  __threadsEmbedPromise?: Promise<boolean>;
  __threadsEmbeds?: { process: () => void };
};

/**
 * Returns a promise that resolves to `true` when embed.js has loaded and
 * `__threadsEmbeds` is ready, or `false` if the script fails to load.
 * Subsequent calls return the same promise (singleton).
 */
function getThreadsEmbedScript(): Promise<boolean> {
  if (threadsWin.__threadsEmbedPromise) return threadsWin.__threadsEmbedPromise;

  threadsWin.__threadsEmbedPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://www.threads.net/embed.js";
    script.async = true;
    script.onload = () => {
      // Capture the Threads Embeds handler before Instagram's embed.js can
      // overwrite window.instgrm with its own version.
      const win = window as unknown as {
        instgrm?: { Embeds?: { process: () => void } };
      };
      if (win.instgrm?.Embeds) {
        threadsWin.__threadsEmbeds = win.instgrm.Embeds;
      }
      resolve(true);
    };
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  return threadsWin.__threadsEmbedPromise;
}

/**
 * Ask embed.js to process all unprocessed blockquotes in the DOM.
 * Re-reads __threadsEmbeds each time so a late capture still works.
 */
function processThreadsEmbeds(): void {
  threadsWin.__threadsEmbeds?.process();
}

function getAppTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

function normalizeThreadsUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    if (parsed.hostname.includes("threads.com")) {
      parsed.hostname = parsed.hostname.replace("threads.com", "threads.net");
    }
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return urlStr;
  }
}

function getThreadsFallbackTitle(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const handle = parsed.pathname.match(/^\/@([^/]+)/)?.[1];
    return handle ? `Threads post by @${handle}` : "Threads Post";
  } catch {
    return "Threads Post";
  }
}

const ThreadsLogo: React.FC = () => (
  <svg
    className="social-card-logo"
    width="20"
    height="20"
    viewBox="0 0 192 192"
    fill="white"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.24-38.37 34.763.39 9.98 5.088 18.593 13.223 24.246 6.873 4.776 15.718 7.128 24.9 6.634 12.11-.651 21.592-5.186 28.17-13.474 4.994-6.293 8.108-14.39 9.38-24.46 5.626 3.394 9.81 7.88 12.2 13.202 4.063 9.04 4.302 23.883-3.54 31.71-6.856 6.845-15.094 9.806-27.55 9.898-13.83-.103-24.291-4.534-31.082-13.175-6.42-8.173-9.748-19.943-9.892-35.005.144-15.062 3.472-26.832 9.892-35.005 6.791-8.641 17.252-13.072 31.082-13.175 13.922.104 24.542 4.583 31.548 13.302 3.407 4.243 5.992 9.614 7.764 16.063l15.222-4.025c-2.267-8.382-5.86-15.486-10.79-21.324-9.57-11.902-23.273-17.98-40.744-18.082h-.11c-17.375.101-30.97 6.155-40.404 17.997-8.178 10.268-12.42 24.092-12.611 41.15l-.001.632.001.633c.191 17.057 4.433 30.881 12.611 41.15 9.434 11.841 23.029 17.895 40.404 17.996h.11c15.461-.107 27.265-4.286 36.128-13.142 12.06-12.049 11.585-27.702 6.39-39.254-3.73-8.292-10.388-15.061-19.328-19.66zm-44.926 37.722c-10.151.574-20.7-3.992-21.266-15.48-.41-8.327 5.887-17.632 24.6-18.71a97.6 97.6 0 0 1 5.784-.168c6.01 0 11.59.578 16.607 1.716-1.896 27.258-16.203 32.152-25.725 32.642z" />
  </svg>
);

// Static fallback card shown when embed.js fails (e.g. Android WebView).
// Proxies all thumbnails through /api/proxy-image to bypass CORP headers.
interface StaticThreadsCardProps {
  embedUrl: string;
  thumbnail?: string;
  displayTitle?: string;
  displayDescription?: string;
  onThumbnailError?: () => void;
}

const StaticThreadsCard: React.FC<StaticThreadsCardProps> = ({
  embedUrl,
  thumbnail,
  displayTitle,
  displayDescription,
  onThumbnailError,
}) => {
  const [thumbError, setThumbError] = useState(false);
  const proxyThumbnail = toProxyThumbnail(thumbnail);
  const fallbackTitle = displayTitle ?? getThreadsFallbackTitle(embedUrl);

  const handleThumbError = () => {
    setThumbError(true);
    onThumbnailError?.();
  };

  const handleClick = () => openPlatformUrl(embedUrl);

  return (
    <div
      className="social-card social-card--threads"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="social-card-header">
        <ThreadsLogo />
        <span className="social-card-header-text">Threads</span>
      </div>

      {proxyThumbnail && !thumbError ? (
        <div className="social-card-thumbnail">
          <img
            src={proxyThumbnail}
            alt="Threads preview"
            onError={() => handleThumbError()}
            loading="lazy"
          />
        </div>
      ) : (
        <div className="social-card-body">
          <div className="social-card-title">{fallbackTitle}</div>
          {displayDescription ? (
            <div className="social-card-description">{displayDescription}</div>
          ) : (
            <p className="social-card-cta">Tap to view on Threads</p>
          )}
        </div>
      )}

      <a
        href={embedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="social-card-button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          openPlatformUrl(embedUrl);
        }}
      >
        Open in Threads
      </a>
    </div>
  );
};

const ThreadsEmbed: React.FC<ThreadsEmbedProps> = ({
  url,
  title,
  description,
  thumbnail,
  onThumbnailError,
}) => {
  const [embedFailed, setEmbedFailed] = useState(false);
  const [embedReady, setEmbedReady] = useState(false);
  const blockquoteRef = useRef<HTMLDivElement>(null);

  const embedUrl = normalizeThreadsUrl(url);

  useEffect(() => {
    if (!embedUrl) return;
    let cancelled = false;

    const run = async () => {
      // Wait for embed.js to finish loading (or fail). All concurrent cards
      // share the same promise so the script is only injected once.
      const scriptOk = await getThreadsEmbedScript();

      if (cancelled) return;

      if (!scriptOk) {
        setEmbedFailed(true);
        return;
      }

      // Script is ready — ask it to process any unprocessed blockquotes.
      processThreadsEmbeds();

      // Poll every 300 ms (up to 10 s) to detect when embed.js replaces the
      // blockquote with an iframe. We keep calling processThreadsEmbeds() on
      // each tick so blockquotes that weren't in the DOM when the script first
      // ran still get picked up.
      let elapsed = 0;
      const pollId = setInterval(() => {
        if (cancelled) {
          clearInterval(pollId);
          return;
        }
        elapsed += 300;
        processThreadsEmbeds();
        const hasIframe = !!blockquoteRef.current?.querySelector("iframe");
        if (hasIframe) {
          clearInterval(pollId);
          setEmbedReady(true);
        } else if (elapsed >= 10000) {
          clearInterval(pollId);
          setEmbedFailed(true);
        }
      }, 300);

      return () => clearInterval(pollId);
    };

    const cleanup = run();
    return () => {
      cancelled = true;
      cleanup.then((fn) => fn?.());
    };
  }, [embedUrl]);

  const handleClick = () => {
    openPlatformUrl(embedUrl);
  };

  // Filter login-wall metadata and decode HTML entities
  const isLoginWall = isLoginWallTitle(title) || isLoginWallDescription(description);
  const displayTitle = !isLoginWallTitle(title) ? (title ? decodeHtmlEntities(title) : undefined) : undefined;
  const displayDescription = !isLoginWallDescription(description) ? (description ? decodeHtmlEntities(description) : undefined) : undefined;

  // For login-wall items: don't show a thumbnail (it's the generic Threads logo),
  // let the native embed.js iframe take over. If embed.js also fails, show a
  // plain "tap to view" static card with no misleading thumbnail or description.
  const effectiveThumbnail = isLoginWall ? undefined : thumbnail;

  // --- Android WebView: skip embed.js entirely ---
  // The iframe can report as processed while still rendering blank in Capacitor.
  // Use a visible static card instead; when no thumbnail is available it still
  // shows the Threads handle and a direct open action.
  if (isAndroidWebView()) {
    return (
      <StaticThreadsCard
        embedUrl={embedUrl}
        thumbnail={effectiveThumbnail}
        displayTitle={displayTitle}
        displayDescription={displayDescription}
        onThumbnailError={onThumbnailError}
      />
    );
  }

  // --- Static fallback (embed.js failed or timed out) ---
  if (embedFailed) {
    return (
      <StaticThreadsCard
        embedUrl={embedUrl}
        thumbnail={effectiveThumbnail}
        displayTitle={displayTitle}
        displayDescription={displayDescription}
        onThumbnailError={onThumbnailError}
      />
    );
  }

  // --- Native blockquote embed (hidden while waiting for embed.js) ---
  if (embedUrl) {
    const theme = getAppTheme();
    return (
      <div className="social-card social-card--threads" onClick={(e) => e.stopPropagation()}>
        <div className="social-card-header">
          <ThreadsLogo />
          <span className="social-card-header-text">Threads</span>
        </div>
        {/* Hide the raw blockquote until embed.js processes it into an iframe */}
        <div
          className="social-card-embed-wrap"
          ref={blockquoteRef}
          style={embedReady ? undefined : { display: "none" }}
        >
          <blockquote
            className="text-post-media"
            data-text-post-permalink={embedUrl}
            data-text-post-version="0"
            data-theme={theme}
          >
            <a href={embedUrl} target="_blank" rel="noopener noreferrer">
              View on Threads
            </a>
          </blockquote>
        </div>
        {/* Show a placeholder while waiting for embed.js */}
        {!embedReady && (
          <div className="social-card-body">
            <div className="social-card-description" style={{ color: "var(--text-tertiary)" }}>
              Loading preview...
            </div>
          </div>
        )}

        <a
          href={embedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="social-card-button"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); openPlatformUrl(embedUrl); }}
        >
          Open in Threads
        </a>
      </div>
    );
  }

  // --- Last-resort: no URL, just a card ---
  return (
    <div
      className="social-card social-card--threads"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="social-card-header">
        <ThreadsLogo />
        <span className="social-card-header-text">Threads</span>
      </div>
      <div className="social-card-body">
        <div className="social-card-icon">🧵</div>
        <p className="social-card-cta">Tap to view on Threads</p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="social-card-button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); openPlatformUrl(url); }}
      >
        Open in Threads
      </a>
    </div>
  );
};

export default ThreadsEmbed;
