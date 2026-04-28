import React, { useEffect, useMemo, useRef, useState } from "react";
import { openPlatformUrl } from "@/utils/openPlatformUrl";
import { cleanFacebookUrl } from "@/utils/facebook";
import "./FacebookEmbed.css";

// Decode HTML entities for proper display
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

interface FacebookEmbedProps {
  url: string;
  /** Original saved URL — used for video/reel detection when `url` is a resolved redirect. */
  originalUrl?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  autoplay?: boolean;
}

/**
 * Detect whether the URL points to a Facebook video (or reel / fb.watch).
 */
function isFacebookVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("fb.watch") ||
    lower.includes("/video") ||
    lower.includes("/reel") ||
    lower.includes("/watch") ||
    lower.includes("/share/v/") ||
    lower.includes("/share/r/")
  );
}

/**
 * Detect whether the URL is a Facebook short-share link (share/p/, share/v/, share/r/).
 * Facebook's own plugin cannot render these — they require login to resolve.
 */
function isFacebookShortShareUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("facebook.com/share/p/") ||
    lower.includes("facebook.com/share/v/") ||
    lower.includes("facebook.com/share/r/")
  );
}

/**
 * Detect whether the URL is a Facebook login/checkpoint redirect.
 * These URLs must never be passed to the embed plugin.
 */
function isFacebookLoginUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("facebook.com/login") ||
    lower.includes("facebook.com/checkpoint")
  );
}

function isFacebookGroupUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().includes("/groups/");
  } catch {
    return url.toLowerCase().includes("facebook.com/groups/");
  }
}

function isGenericFacebookDescription(text?: string): boolean {
  if (!text) return true;
  const t = text.trim().toLowerCase();
  if (!t) return true;
  if (t.includes("log into facebook")) return true;
  if (t.includes("log in to facebook")) return true;
  if (t.includes("log in to facebook to start sharing")) return true;
  if (t.includes("create a page for a celebrity")) return true;
  if (t.includes("facebook helps you connect")) return true;
  return false;
}

/**
 * Returns true only for URL patterns that Facebook's embed plugin can actually render:
 * - /<username>/posts/<id>/
 * - /<numeric_id>/posts/<id>/
 * - /permalink.php?story_fbid=...
 * - /photo?fbid=... or /photo.php?fbid=...
 * - /video.php?v=... or /watch/?v=...
 * - /<username>/videos/<id>/
 * - /<username>/reels/<id>/
 * - /groups/<id>/permalink/<id>/ or /groups/<id>/posts/<id>/
 * - fb.watch/...
 *
 * Profile pages, page indexes, events, groups index, marketplace etc. are NOT embeddable.
 */
function isFacebookEmbeddableUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("facebook.com") && !u.hostname.includes("fb.watch")) return false;
    if (u.hostname.includes("fb.watch")) return true;
    const path = u.pathname.toLowerCase().replace(/\/$/, "");
    // Posts (including group posts)
    if (/\/posts\//.test(path)) return true;
    // Permalinks (including group permalinks)
    if (path.includes("/permalink.php") || (path === "/permalink.php")) return true;
    if (/\/permalink\//.test(path)) return true;
    if (u.searchParams.has("story_fbid")) return true;
    // Photos
    if (path.includes("/photo") || u.searchParams.has("fbid")) return true;
    // Videos
    if (path.includes("/videos/") || path === "/video.php" || u.searchParams.has("v")) return true;
    // Watch
    if (path === "/watch" || path.startsWith("/watch/")) return true;
    // Reels
    if (path.includes("/reel") || path.includes("/reels/")) return true;
  } catch { /* ignore */ }
  return false;
}

/**
 * Determine the Facebook content type label from the URL.
 */
function getFacebookContentType(url: string): string {
  const lower = url.toLowerCase();
  if (
    lower.includes("fb.watch") ||
    lower.includes("/video") ||
    lower.includes("/watch") ||
    lower.includes("/share/v/")
  )
    return "Video";
  if (lower.includes("/reel") || lower.includes("/share/r/")) return "Reel";
  if (lower.includes("/photo") || lower.includes("/share/p/")) return "Photo";
  if (lower.includes("profile.php") || lower.includes("/people/")) return "Profile";
  if (lower.includes("/events/")) return "Event";
  if (lower.includes("/groups/")) return "Group";
  if (lower.includes("/pages/")) return "Page";
  return "Post";
}

const FacebookLogo: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

/**
 * FacebookEmbed — lazy-load pattern matching Instagram:
 *
 * 1. Show thumbnail + branded inline-play button (like Instagram's "▶ Play Reel Here").
 * 2. On tap, load the Facebook plugin iframe.
 * 3. If iframe fails (postMessage timeout for posts, hard timeout for videos), revert to card.
 * 4. Short-share / login / non-embeddable URLs skip straight to the static fallback card.
 */
const FacebookEmbed: React.FC<FacebookEmbedProps> = ({
  url,
  originalUrl,
  title,
  description,
  thumbnail,
  autoplay = false,
}) => {
  // Lazy-load state — only load iframe when user taps the play button
  const [playInline, setPlayInline] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const normalizedUrl = useMemo(() => {
    const trimmed = url.trim();
    if (!trimmed) return null;
    const withProtocol =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
    try {
      const parsed = new URL(cleanFacebookUrl(withProtocol) ?? withProtocol);
      if (parsed.hostname.includes("facebook.com")) {
        parsed.protocol = "https:";
        parsed.hash = "";
        parsed.search = "";
        if (parsed.hostname === "m.facebook.com" || parsed.hostname === "mbasic.facebook.com") {
          parsed.hostname = "www.facebook.com";
        }
      }
      return parsed.toString();
    } catch {
      return withProtocol;
    }
  }, [url]);

  const isVideo = useMemo(
    () => {
      if (normalizedUrl && isFacebookVideoUrl(normalizedUrl)) return true;
      // Also check original URL — the resolved URL may have lost the /reel/ or /video/ path
      if (originalUrl && isFacebookVideoUrl(originalUrl)) return true;
      return false;
    },
    [normalizedUrl, originalUrl],
  );

  const safeDescription = useMemo(
    () => (isGenericFacebookDescription(description) ? undefined : description),
    [description],
  );

  const contentType = useMemo(
    () => {
      // Check resolved URL first, then fall back to original URL for type detection
      if (normalizedUrl) {
        const ct = getFacebookContentType(normalizedUrl);
        if (ct !== "Post") return ct;
      }
      if (originalUrl) return getFacebookContentType(originalUrl);
      return "Post";
    },
    [normalizedUrl, originalUrl],
  );

  // Facebook short-share URLs (share/p/, share/r/, share/v/) cannot be rendered by
  // Facebook's own plugin server — they always return "post no longer available".
  // Login-redirect URLs must also never reach the plugin.
  const isShortShareUrl = useMemo(
    () => normalizedUrl
      ? isFacebookShortShareUrl(normalizedUrl) || isFacebookLoginUrl(normalizedUrl)
      : false,
    [normalizedUrl],
  );

  // Profile pages, page indexes, events, groups index, marketplace etc. cannot be
  // embedded by Facebook's plugin — skip straight to the branded fallback card.
  const isNotEmbeddable = useMemo(
    () => normalizedUrl ? !isFacebookEmbeddableUrl(normalizedUrl) : false,
    [normalizedUrl],
  );

  const isGroupPostWithoutPreview = useMemo(
    () => normalizedUrl
      ? isFacebookGroupUrl(normalizedUrl) && !thumbnail && !safeDescription
      : false,
    [normalizedUrl, thumbnail, safeDescription],
  );

  // Inline button label — mirrors Instagram's wording
  const inlineButtonLabel = useMemo(() => {
    if (contentType === "Reel") return "▶ Play Reel Here";
    if (contentType === "Video") return "▶ Play Video Here";
    if (contentType === "Photo") return "View Photo Here";
    return "View Post Here";
  }, [contentType]);

  // Can this URL be embedded at all?
  const canViewInline = !isShortShareUrl && !isNotEmbeddable && !isGroupPostWithoutPreview && !!normalizedUrl;

  // Build the iframe src for public posts/videos that the plugin can render
  const iframeSrc = useMemo(() => {
    if (!normalizedUrl) return null;
    const href = encodeURIComponent(normalizedUrl);
    if (isVideo) {
      const autoplayParam = autoplay ? '1' : '0';
      return `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=500&height=800&autoplay=${autoplayParam}`;
    }
    return `https://www.facebook.com/plugins/post.php?href=${href}&show_text=true&width=500`;
  }, [normalizedUrl, isVideo, autoplay]);

  // Reset inline state when URL changes
  useEffect(() => {
    setPlayInline(false);
    setIframeLoaded(false);
    setIframeFailed(false);
  }, [iframeSrc]);

  useEffect(() => {
    setThumbnailFailed(false);
  }, [thumbnail]);

  // After iframe fires onLoad, verify it rendered real content (posts only — video plugin
  // doesn't send postMessage events).
  useEffect(() => {
    if (!playInline || !iframeLoaded) return;
    if (isVideo) return; // video plugin doesn't send postMessage — hard timeout handles it

    let receivedFacebookMessage = false;

    const onMessage = (event: MessageEvent) => {
      try {
        if (!event.origin.includes("facebook.com")) return;
        const iframeWindow = iframeRef.current?.contentWindow;
        if (iframeWindow && event.source !== iframeWindow) return;
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (
          data &&
          (data.type === "xfbml.size" ||
            data.type === "resize" ||
            data.type === "ready" ||
            typeof data.height === "number" ||
            typeof data.width === "number")
        ) {
          receivedFacebookMessage = true;
        }
      } catch {
        // Non-JSON messages — ignore
      }
    };

    window.addEventListener("message", onMessage);

    const timer = setTimeout(() => {
      const el = iframeRef.current;
      if (el) {
        const height = el.getBoundingClientRect().height;
        if (height < 100 || !receivedFacebookMessage) {
          setIframeFailed(true);
          setPlayInline(false);
        }
      }
    }, 6000);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [playInline, iframeLoaded, isVideo]);

  // Hard timeout: if iframe hasn't fired onLoad at all after N seconds, revert to card
  useEffect(() => {
    if (!playInline) return;
    const timer = setTimeout(() => {
      if (!iframeLoaded) {
        setIframeFailed(true);
        setPlayInline(false);
      }
    }, isVideo ? 10000 : 6000);
    return () => clearTimeout(timer);
  }, [playInline, iframeLoaded, isVideo]);

  if (!normalizedUrl) return null;

  // ── Inline iframe — shown after user taps the play button ──
  if (playInline && iframeSrc && !iframeFailed) {
    return (
      <div className="fb-card" onClick={(e) => e.stopPropagation()}>
        <div className="fb-card-header">
          <FacebookLogo />
          <span className="fb-card-header-text">Facebook {contentType}</span>
        </div>

        <div className="fb-card-iframe-wrap">
          {!iframeLoaded && (
            <div className="fb-card-loading">
              <div className="fb-card-dots">
                <span />
                <span />
                <span />
              </div>
              <span>Loading preview...</span>
            </div>
          )}
          <iframe
            key={iframeSrc}
            ref={iframeRef}
            src={iframeSrc}
            title={`Facebook ${contentType}`}
            scrolling="no"
            allow="autoplay; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
            style={{ opacity: iframeLoaded ? 1 : 0 }}
            onLoad={() => setIframeLoaded(true)}
            onError={() => { setIframeFailed(true); setPlayInline(false); }}
          />
        </div>

        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fb-card-button"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); openPlatformUrl(normalizedUrl); }}
        >
          Open in Facebook
        </a>
      </div>
    );
  }

  // ── Static card: thumbnail + inline-play button (or plain body if no thumbnail) ──
  return (
    <div
      className="fb-card fb-card-clickable"
      onClick={(e) => {
        e.stopPropagation();
        if (!canViewInline) openPlatformUrl(normalizedUrl);
      }}
      style={{ cursor: "pointer" }}
    >
      <div className="fb-card-header">
        <FacebookLogo />
        <span className="fb-card-header-text">Facebook {contentType}</span>
      </div>

      {thumbnail && !thumbnailFailed ? (
        <div className="fb-card-thumbnail">
          <img
            src={thumbnail}
            alt={title || `Facebook ${contentType}`}
            onError={() => setThumbnailFailed(true)}
          />
          {canViewInline && (
            <button
              type="button"
              className="fb-card-inline-play"
              onClick={(e) => {
                e.stopPropagation();
                setIframeFailed(false);
                setPlayInline(true);
              }}
            >
              {inlineButtonLabel}
            </button>
          )}
        </div>
      ) : (
        <div className="fb-card-body">
          <div className="fb-card-icon">{"\u{1F4F0}"}</div>
          <p className="fb-card-cta">
            {canViewInline ? "Tap below to view inside app" : "Tap to view on Facebook"}
          </p>
          {canViewInline && (
            <button
              type="button"
              className="fb-card-inline-play"
              onClick={(e) => {
                e.stopPropagation();
                setIframeFailed(false);
                setPlayInline(true);
              }}
            >
              {inlineButtonLabel}
            </button>
          )}
        </div>
      )}

      {safeDescription && (
        <div
          style={{ padding: "8px 14px", fontSize: "0.85rem", color: "#65676b" }}
        >
          {decodeHtmlEntities(safeDescription)}
        </div>
      )}

      <a
        href={normalizedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="fb-card-button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); openPlatformUrl(normalizedUrl); }}
      >
        Open in Facebook
      </a>
    </div>
  );
};

export default FacebookEmbed;
