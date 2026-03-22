import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { threadsAuthService } from "@/services/ThreadsAuthService";
import "./FacebookEmbed.css"; // Reuse Facebook embed styles

interface ThreadsEmbedProps {
  url: string;
  title?: string;
  description?: string;
  thumbnail?: string;
}

interface ThreadsOEmbedData {
  html?: string;
  author_name?: string;
  thumbnail_url?: string;
}

const win = window as unknown as {
  threadsEmbedScriptLoaded?: boolean;
  ThreadsEmbeds?: { process: () => void };
};

/** Load embed.js once per page; call process() if already loaded. */
function loadThreadsEmbedScript(): void {
  if (win.threadsEmbedScriptLoaded) {
    win.ThreadsEmbeds?.process();
    return;
  }
  win.threadsEmbedScriptLoaded = true;
  const script = document.createElement("script");
  script.src = "https://www.threads.net/embed.js";
  script.async = true;
  script.onload = () => {
    win.ThreadsEmbeds?.process();
  };
  document.body.appendChild(script);
}

/** Return the current app theme so we can pass it to the blockquote. */
function getAppTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

/**
 * Normalize a Threads URL so embed.js always receives a threads.net URL.
 * embed.js is hosted on threads.net and only reliably processes threads.net
 * permalinks — threads.com URLs and tracking params cause "Thread not available".
 */
function normalizeThreadsUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    // Rewrite threads.com → threads.net
    if (parsed.hostname.includes("threads.com")) {
      parsed.hostname = parsed.hostname.replace("threads.com", "threads.net");
    }
    // Strip tracking/share params that embed.js rejects
    const trackingParams = ["mt", "igshid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    for (const p of trackingParams) parsed.searchParams.delete(p);
    return parsed.toString();
  } catch {
    return urlStr;
  }
}

const ThreadsEmbed: React.FC<ThreadsEmbedProps> = ({
  url,
  title,
  description,
  thumbnail,
}) => {
  const { getSocialConnection } = useAuth();
  const [thumbnailError, setThumbnailError] = useState(false);
  const [oembedData, setOembedData] = useState<ThreadsOEmbedData | null>(null);
  const [oembedLoading, setOembedLoading] = useState(true);
  const [oembedError, setOembedError] = useState(false);
  const blockquoteRef = useRef<HTMLDivElement>(null);

  // Always use a threads.net URL with tracking params stripped for embed.js
  const embedUrl = normalizeThreadsUrl(url);

  const threadsConnection = getSocialConnection?.("threads");

  // Fetch oEmbed data if user is connected to Threads
  useEffect(() => {
    if (!threadsConnection || !url) {
      setOembedLoading(false);
      return;
    }

    let cancelled = false;
    const fetchOEmbed = async () => {
      try {
        setOembedLoading(true);
        const data = await threadsAuthService.getOEmbedData(
          url,
          threadsConnection.accessToken,
          600 // max width
        );
        if (cancelled) return;
        setOembedData(data);
        setOembedError(false);
      } catch (error) {
        console.error("Failed to fetch Threads oEmbed data:", error);
        if (cancelled) return;
        setOembedError(true);
        setOembedData(null);
      } finally {
        if (!cancelled) setOembedLoading(false);
      }
    };

    fetchOEmbed();
    return () => {
      cancelled = true;
    };
  }, [url, threadsConnection]);

  // Load embed.js after oEmbed HTML is ready (connected user path)
  useEffect(() => {
    if (oembedData?.html) {
      loadThreadsEmbedScript();
    }
  }, [oembedData]);

  // Load embed.js for the native blockquote path (non-connected users).
  // Run as soon as the component mounts with a URL — do not wait for oembedLoading
  // to settle, as that delay was causing the script to be injected after the
  // blockquote was already in the DOM but never processed.
  useEffect(() => {
    if (threadsConnection || !url) return;
    const node = blockquoteRef.current;
    if (!node) return;
    loadThreadsEmbedScript();
    return () => {
      // node captured above; nothing to clean up but satisfies the lint rule.
      void node;
    };
  }, [threadsConnection, url]);

  const handleClick = () => {
    window.open(embedUrl, "_blank", "noopener,noreferrer");
  };

  // --- Connected user: rich oEmbed HTML ---
  if (threadsConnection && oembedData?.html && !oembedError) {
    return (
      <div
        className="threads-embed"
        dangerouslySetInnerHTML={{ __html: oembedData.html }}
      />
    );
  }

  // --- Connected user: loading ---
  if (threadsConnection && oembedLoading) {
    return (
      <div className="fb-card">
        <div className="fb-card-header">
          <span style={{ fontSize: "20px" }}>🧵</span>
          <span>Threads</span>
        </div>
        <div className="fb-card-body">
          <div className="fb-card-description" style={{ color: "var(--text-tertiary)" }}>
            Loading preview...
          </div>
        </div>
      </div>
    );
  }

  // --- Non-connected user (or oEmbed failed): native blockquote embed ---
  // embed.js will replace the blockquote with an iframe for public posts.
  // Always use embedUrl (threads.net, no tracking params) so embed.js accepts it.
  if (embedUrl) {
    const theme = getAppTheme();
    return (
      <div className="threads-embed" ref={blockquoteRef}>
        <blockquote
          className="text-post-media"
          data-text-post-permalink={embedUrl}
          data-theme={theme}
        >
          <a href={embedUrl} target="_blank" rel="noopener noreferrer">
            View on Threads
          </a>
        </blockquote>
      </div>
    );
  }

  // --- Last-resort card fallback (no URL) ---
  const isInstagramCDN = thumbnail?.includes("cdninstagram.com");
  const shouldShowThumbnail = thumbnail && !isInstagramCDN && !thumbnailError;

  const isGenericTitle =
    title?.includes("Log in") || title?.includes("Threads • Log in");
  const isGenericDescription =
    description?.includes("Join Threads to share ideas") ||
    description?.includes("Log in with your Instagram");

  const displayTitle = !isGenericTitle ? title : undefined;
  const displayDescription = !isGenericDescription ? description : undefined;

  return (
    <div
      className="fb-card fb-card-clickable"
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
      <div className="fb-card-header">
        <span style={{ fontSize: "20px" }}>🧵</span>
        <span>Threads</span>
      </div>
      {shouldShowThumbnail && (
        <div className="fb-card-thumb">
          <img
            src={thumbnail}
            alt="Threads preview"
            onError={() => setThumbnailError(true)}
            loading="lazy"
          />
        </div>
      )}
      <div className="fb-card-body">
        {displayTitle && <div className="fb-card-title">{displayTitle}</div>}
        {displayDescription && (
          <div className="fb-card-description">{displayDescription}</div>
        )}
        {!displayTitle && !displayDescription && (
          <div className="fb-card-description">
            🧵 View on Threads
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreadsEmbed;
