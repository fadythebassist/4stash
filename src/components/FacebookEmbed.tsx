import React, { useEffect, useMemo, useRef, useState } from "react";
import "./FacebookEmbed.css";

// Decode HTML entities for proper display
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

interface FacebookEmbedProps {
  url: string;
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
    // Posts
    if (/\/posts\//.test(path)) return true;
    // Permalinks
    if (path.includes("/permalink.php") || (path === "/permalink.php")) return true;
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
 * FacebookEmbed – tries the iframe plugin first for regular public post URLs.
 * Short-share URLs (share/p/, share/v/, share/r/) and group permalinks are known to
 * be unrenderable by the plugin — these skip the iframe and show the branded fallback card.
 * For videos/reels, falls back to a thumbnail card if the plugin doesn't send postMessage events.
 */
const FacebookEmbed: React.FC<FacebookEmbedProps> = ({
  url,
  title,
  description,
  thumbnail,
  autoplay = true,
}) => {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [manualFallback, setManualFallback] = useState(false);
  const [isPotentiallyBroken, setIsPotentiallyBroken] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const normalizedUrl = useMemo(() => {
    const trimmed = url.trim();
    if (!trimmed) return null;
    return trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
  }, [url]);

  const isVideo = useMemo(
    () => (normalizedUrl ? isFacebookVideoUrl(normalizedUrl) : false),
    [normalizedUrl],
  );
  const safeDescription = useMemo(
    () => (isGenericFacebookDescription(description) ? undefined : description),
    [description],
  );
  const contentType = useMemo(
    () => (normalizedUrl ? getFacebookContentType(normalizedUrl) : "Post"),
    [normalizedUrl],
  );
  const isGroupPermalink = useMemo(() => {
    if (!normalizedUrl) return false;
    const lower = normalizedUrl.toLowerCase();
    if (!lower.includes("facebook.com/groups/")) return false;
    // Group post URLs: /groups/<id>/permalink/<id>/ or /groups/<id>/posts/<id>/
    // Facebook's embed plugin does not work for group content — skip iframe entirely.
    return (
      lower.includes("/permalink/") ||
      lower.includes("/posts/")
    );
  }, [normalizedUrl]);

  // Facebook short-share URLs (share/p/, share/r/, share/v/) cannot be rendered by
  // Facebook's own plugin server — they always return "post no longer available".
  // Login-redirect URLs must also never reach the plugin.
  // Skip the iframe entirely and go straight to the branded fallback card.
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

  // For videos/reels: Always try iframe first to enable playback, fallback to thumbnail on error
  // For posts/photos: If we have a thumbnail, show it immediately (skip iframe loading state)
  const shouldPreferThumbnailCard = !!thumbnail && !isVideo;

  // Build the iframe src for public posts/videos that the plugin can render
  const iframeSrc = useMemo(() => {
    if (!normalizedUrl) return null;
    const href = encodeURIComponent(normalizedUrl);
    if (isVideo) {
      // Request larger dimensions to accommodate vertical videos without cropping
      const autoplayParam = autoplay ? '1' : '0';
      return `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=500&height=800&autoplay=${autoplayParam}&muted=1`;
    }
    return `https://www.facebook.com/plugins/post.php?href=${href}&show_text=true&width=500`;
  }, [normalizedUrl, isVideo, autoplay]);

  // Reset iframe loaded state when src changes (e.g., autoplay toggle)
  useEffect(() => {
    setIframeLoaded(false);
    setShowFallback(false);
    setIsPotentiallyBroken(false);
  }, [iframeSrc]);

  // After the iframe fires onLoad, check if it rendered real content.
  // Facebook plugin iframes load but render a tiny ~0-height body when the URL is invalid.
  // Give it a grace period then measure height; if still tiny → show fallback.
  //
  // For videos, the CSS fixes the iframe at 600px, so getBoundingClientRect won't help.
  // Instead, listen for Facebook's postMessage resize events — a working embed sends them;
  // a blocked/unavailable one never does. If none arrive within 6s of onLoad, auto-fallback.
  useEffect(() => {
    if (!iframeLoaded) return;

    let receivedFacebookMessage = false;

    const onMessage = (event: MessageEvent) => {
      // Facebook sends postMessages from www.facebook.com for working embeds.
      // Messages arrive as JSON strings or objects with a type like "xfbml.size".
      try {
        if (!event.origin.includes("facebook.com")) return;
        const iframeWindow = iframeRef.current?.contentWindow;
        if (iframeWindow && event.source !== iframeWindow) return;
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        // Facebook resize/ready events signal the embed rendered real content.
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
        console.log(
          "[FacebookEmbed] Detected iframe height:",
          height,
          "isVideo:",
          isVideo,
          "receivedFacebookMessage:",
          receivedFacebookMessage,
        );
        if (!isVideo) {
          // For posts/photos: CSS doesn't fix height, so measure it.
          // A working embed renders at >100px; an error/unavailable post renders very small.
          // Some blocked embeds still render a large gray frame with a broken icon.
          // In that case height looks valid, but Facebook never sends resize/ready messages.
          if (height < 100 || !receivedFacebookMessage) {
            setShowFallback(true);
          }
        } else {
          // For videos/reels: iframe is CSS-fixed at 600px so height check is useless.
          // Rely on postMessage signal instead.
          // If Facebook sent a resize/ready event, the embed is working — keep it.
          // If no message arrived, the embed is showing the "Unavailable" error screen.
          if (!receivedFacebookMessage) {
            if (thumbnail) {
              // We have a thumbnail — switch straight to the static card.
              setShowFallback(true);
            } else {
              // No thumbnail but still blocked — show the manual fallback button.
              setIsPotentiallyBroken(true);
            }
          }
        }
      }
    }, 6000);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [iframeLoaded, isVideo, thumbnail]);

  // Hard timeout: if iframe hasn't fired onLoad at all after 6s (posts) or 10s (videos), show fallback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!iframeLoaded) {
        setShowFallback(true);
      }
    }, isVideo ? 10000 : 6000);
    return () => clearTimeout(timer);
  }, [iframeLoaded, isVideo]);

  if (!normalizedUrl) return null;

  // ── Show iframe plugin (always attempted first) ──
  if (
    iframeSrc &&
    !showFallback &&
    !manualFallback &&
    !isGroupPermalink &&
    !isShortShareUrl &&
    !isNotEmbeddable &&
    !shouldPreferThumbnailCard
  ) {
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
            allow="encrypted-media; picture-in-picture; web-share; unload"
            allowFullScreen
            style={{ opacity: iframeLoaded ? 1 : 0 }}
            onLoad={() => setIframeLoaded(true)}
            onError={() => setShowFallback(true)}
          />
        </div>

        {isPotentiallyBroken && thumbnail && (
          <button
            className="fb-card-fallback-button"
            onClick={(e) => {
              e.stopPropagation();
              setManualFallback(true);
            }}
            title="Video not working? Show preview card instead"
          >
            🖼️ Show as card
          </button>
        )}

        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fb-card-button"
          onClick={(e) => e.stopPropagation()}
        >
          Open in Facebook
        </a>
      </div>
    );
  }

  // ── Fallback: iframe failed or timed out → static branded card ──
  return (
    <div
      className="fb-card fb-card-clickable"
      onClick={(e) => {
        e.stopPropagation();
        window.open(normalizedUrl, "_blank", "noopener,noreferrer");
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
        </div>
      ) : (
        <div className="fb-card-body">
          <div className="fb-card-icon">{"\u{1F4F0}"}</div>
          <p className="fb-card-cta">Tap to view on Facebook</p>
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
        onClick={(e) => e.stopPropagation()}
      >
        Open in Facebook
      </a>
    </div>
  );
};

export default FacebookEmbed;
