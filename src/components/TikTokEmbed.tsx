import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./SocialCard.css";

const TIKTOK_EMBED_SRC = "https://www.tiktok.com/embed.js";

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    return trimmed;
  return `https://${trimmed}`;
}

/**
 * Return a canonical TikTok URL with tracking/share params stripped.
 * TikTok's embed.js rejects blockquotes whose `cite` contains query params
 * like ?_r=1&_t=... — only the clean path form is reliably accepted.
 */
function cleanTikTokUrl(urlStr: string): string {
  const normalized = normalizeUrl(urlStr);
  if (!normalized) return urlStr;
  try {
    const u = new URL(normalized);
    // Keep only the origin + pathname — drop all query params and hash
    return u.origin + u.pathname;
  } catch {
    return urlStr;
  }
}

function extractTikTokVideoId(urlStr: string): string | null {
  const normalized = normalizeUrl(urlStr);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    const match = url.pathname.match(/\/video\/(\d+)/);
    if (match?.[1]) return match[1];
    return null;
  } catch {
    const match = urlStr.match(/\/video\/(\d+)/);
    return match?.[1] ?? null;
  }
}

// Module-level singleton — the TikTok embed script is loaded once and reused.
// Calling triggerTikTokEmbed() on subsequent cards reuses the already-loaded script
// instead of re-injecting a new <script> tag on every render.
let tikTokEmbedPromise: Promise<void> | null = null;

function triggerTikTokEmbed(): void {
  if (typeof window === "undefined") return;

  // If the script already ran and the SDK is available, defer reload() by one
  // animation frame so the blockquote is committed to the DOM before the SDK scans.
  const win = window as unknown as {
    tiktokEmbed?: { reload?: () => void };
  };
  if (win.tiktokEmbed?.reload) {
    requestAnimationFrame(() => {
      win.tiktokEmbed?.reload?.();
    });
    return;
  }

  // Script is already loading — nothing more to do; it will process the
  // blockquote once it fires its load event.
  if (tikTokEmbedPromise) return;

  tikTokEmbedPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TIKTOK_EMBED_SRC}"]`,
    );
    if (existing) {
      // Already in DOM from a previous module evaluation (e.g. HMR) — reuse.
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = TIKTOK_EMBED_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { tikTokEmbedPromise = null; resolve(); };
    document.head.appendChild(script);
  });
}

const TikTokLogo: React.FC = () => (
  <svg
    className="social-card-logo"
    width="18"
    height="20"
    viewBox="0 0 18 21"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9.37 0h3.24c.17 1.86.94 3.24 2.12 4.16A5.84 5.84 0 0 0 18 5.26v3.38a9.2 9.2 0 0 1-5.24-1.68v7.46A6.58 6.58 0 0 1 6.18 21 6.58 6.58 0 0 1 0 14.58a6.58 6.58 0 0 1 6.94-6.52v3.44a3.24 3.24 0 0 0-3.58 3.14 3.24 3.24 0 0 0 3.28 3.22A3.26 3.26 0 0 0 9.9 14.7l.02-14.7h-.55z"
      fill="white"
    />
  </svg>
);

export interface TikTokEmbedProps {
  url: string;
  thumbnail?: string;
  title?: string;
  description?: string;
}

const TikTokEmbed: React.FC<TikTokEmbedProps> = ({ url, thumbnail, title, description }) => {
  const embedRef = useRef<HTMLDivElement | null>(null);
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  // Clean URL (no tracking params) — required for TikTok embed.js to accept the blockquote
  const cleanUrl = useMemo(() => (normalizedUrl ? cleanTikTokUrl(normalizedUrl) : null), [normalizedUrl]);
  const videoId = useMemo(() => extractTikTokVideoId(url), [url]);
  const [failed, setFailed] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  useEffect(() => {
    if (!cleanUrl || !videoId || !embedRef.current) return;

    setFailed(false);
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    embedRef.current.innerHTML = "";

    const blockquote = document.createElement("blockquote");
    blockquote.className = "tiktok-embed";
    blockquote.setAttribute("cite", cleanUrl);
    blockquote.setAttribute("data-video-id", videoId);
    blockquote.setAttribute("data-embed-from", "oembed");
    blockquote.style.maxWidth = "605px";
    blockquote.style.minWidth = "325px";

    const section = document.createElement("section");
    const link = document.createElement("a");
    link.href = cleanUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View on TikTok";
    section.appendChild(link);
    blockquote.appendChild(section);
    embedRef.current.appendChild(blockquote);

    triggerTikTokEmbed();

    timeoutId = setTimeout(() => {
      if (cancelled) return;
      const iframe = embedRef.current?.querySelector("iframe");
      if (!iframe) {
        setFailed(true);
      }
    }, 10000);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (embedRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps -- ref cleanup is intentional
        embedRef.current.innerHTML = "";
      }
    };
  }, [cleanUrl, videoId]);

  const handleClick = useCallback(() => {
    if (normalizedUrl) {
      window.open(normalizedUrl, "_blank", "noopener,noreferrer");
    }
  }, [normalizedUrl]);

  if (!normalizedUrl) return null;

  const isGenericTitle = !title || title.length < 5;
  const isGenericDesc = !description || description.length < 10;
  const displayTitle = !isGenericTitle ? title : undefined;
  const displayDesc = !isGenericDesc ? description : undefined;

  // No video ID — show card-only fallback
  if (!videoId) {
    return (
      <div className="social-card social-card--tiktok" onClick={(e) => e.stopPropagation()}>
        <div className="social-card-header">
          <TikTokLogo />
          <span className="social-card-header-text">TikTok</span>
        </div>
        {thumbnail && !thumbnailFailed ? (
          <div
            className="social-card-thumbnail"
            onClick={(e) => { e.stopPropagation(); handleClick(); }}
            style={{ cursor: "pointer" }}
          >
            <img
              src={thumbnail}
              alt={displayTitle || "TikTok video"}
              onError={() => setThumbnailFailed(true)}
              loading="lazy"
            />
          </div>
        ) : (
          <div
            className="social-card-body"
            onClick={(e) => { e.stopPropagation(); handleClick(); }}
            style={{ cursor: "pointer" }}
          >
            <div className="social-card-icon">🎵</div>
            <p className="social-card-cta">Tap to view on TikTok</p>
          </div>
        )}
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="social-card-button"
          onClick={(e) => e.stopPropagation()}
        >
          Open in TikTok
        </a>
      </div>
    );
  }

  // Has video ID — always wrap embed with branded header + button
  return (
    <div className="social-card social-card--tiktok" onClick={(e) => e.stopPropagation()}>
      <div className="social-card-header">
        <TikTokLogo />
        <span className="social-card-header-text">TikTok</span>
      </div>

      {!failed ? (
        <div ref={embedRef} className="social-card-embed-wrap" />
      ) : thumbnail && !thumbnailFailed ? (
        <div
          className="social-card-thumbnail"
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          style={{ cursor: "pointer" }}
        >
          <img
            src={thumbnail}
            alt={displayTitle || "TikTok video"}
            onError={() => setThumbnailFailed(true)}
            loading="lazy"
          />
        </div>
      ) : (
        <div
          className="social-card-body"
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          style={{ cursor: "pointer" }}
        >
          {(displayTitle || displayDesc) ? (
            <>
              {displayTitle && <div className="social-card-title">{displayTitle}</div>}
              {displayDesc && <div className="social-card-description">{displayDesc}</div>}
            </>
          ) : (
            <>
              <div className="social-card-icon">🎵</div>
              <p className="social-card-cta">Tap to view on TikTok</p>
            </>
          )}
        </div>
      )}

      <a
        href={normalizedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="social-card-button"
        onClick={(e) => e.stopPropagation()}
      >
        Open in TikTok
      </a>
    </div>
  );
};

export default TikTokEmbed;
