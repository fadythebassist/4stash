import React, { useEffect, useMemo, useRef, useState } from "react";
import { Item } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import FacebookEmbed from "./FacebookEmbed";
import InstagramEmbed from "./InstagramEmbed";
import RedditEmbed from "./RedditEmbed";
import TikTokEmbed from "./TikTokEmbed";
import TweetEmbed from "./TweetEmbed";
import ThreadsEmbed from "./ThreadsEmbed";
import YouTubeEmbed from "./YouTubeEmbed";
import VimeoEmbed from "./VimeoEmbed";
import "./ContentCard.css";

// Decode HTML entities for proper display
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

interface ContentCardProps {
  item: Item;
  onDelete: () => void;
  onArchive: () => void;
  onClick: () => void;
  layoutMode?: 'grid' | 'list';
}

const MAX_TEXT_CHARS = 150; // Approximate chars for 2 lines

const ContentCard: React.FC<ContentCardProps> = ({
  item,
  onDelete,
  onArchive,
  onClick,
  layoutMode = 'grid',
}) => {
  const { user } = useAuth();
  const { updateItem } = useData();
  // Keep updateItem in a ref so the unfurl effect never needs it as a dependency.
  // This prevents the effect from re-running every time the context re-renders.
  const updateItemRef = useRef(updateItem);
  useEffect(() => { updateItemRef.current = updateItem; }, [updateItem]);
  const autoplayVideos = user?.settings?.autoplayVideos !== false;

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [resolvedThumbnail, setResolvedThumbnail] = useState<
    string | undefined
  >(undefined);
  const [resolvedContent, setResolvedContent] = useState<string | undefined>(
    undefined,
  );
  const [resolvedFacebookUrl, setResolvedFacebookUrl] = useState<
    string | undefined
  >(undefined);
  const [isTextExpanded, setIsTextExpanded] = useState(false);

  // Refs so the unfurl effect can read the latest resolved values
  // without listing them as dependencies (they are outputs of the effect,
  // not inputs that should re-trigger it).
  const resolvedThumbnailRef = useRef<string | undefined>(undefined);
  const resolvedFacebookUrlRef = useRef<string | undefined>(undefined);

  const minSwipeDistance = 100;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
    if (touchStart !== null) {
      const distance = touchStart - e.targetTouches[0].clientX;
      if (distance > 0) {
        setSwipeOffset(Math.min(distance, 150));
      }
    }
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;

    if (isLeftSwipe) {
      onArchive();

      // Haptic feedback
      if ("vibrate" in navigator) {
        navigator.vibrate(50);
      }
    }

    setSwipeOffset(0);
    setTouchStart(null);
    setTouchEnd(null);
  };

  const derivedSource = useMemo(() => {
    // Try URL detection first for better accuracy
    if (item.url) {
      try {
        const normalized =
          item.url.startsWith("http://") || item.url.startsWith("https://")
            ? item.url
            : `https://${item.url}`;
        const url = new URL(normalized);
        const hostname = url.hostname.toLowerCase();
        
        // Map domains to source names
        if (hostname.includes("facebook.com") || hostname.includes("fb.watch"))
          return "facebook";
        if (hostname.includes("instagram.com")) return "instagram";
        if (hostname.includes("tiktok.com")) return "tiktok";
        if (hostname.includes("reddit.com") || hostname.includes("redd.it"))
          return "reddit";
        if (hostname.includes("twitter.com") || hostname.includes("x.com"))
          return "twitter";
        if (hostname.includes("youtube.com") || hostname.includes("youtu.be"))
          return "youtube";
        if (hostname.includes("vimeo.com")) return "vimeo";
        if (hostname.includes("threads.net") || hostname.includes("threads.com")) return "threads";
        
        // Extract domain name for other sources
        const parts = hostname.replace("www.", "").split(".");
        if (parts.length >= 2) {
          return parts[parts.length - 2]; // e.g., "medium" from "medium.com"
        }
        return hostname;
      } catch {
        // If URL parsing fails, fall back to item.source
      }
    }
    
    // Fall back to stored source if URL detection failed
    return item.source;
  }, [item.source, item.url]);

  const sourceBadges: Record<string, { emoji: string; color: string; name: string }> = {
    youtube: { emoji: "▶️", color: "#ff0000", name: "YouTube" },
    twitter: { emoji: "𝕏", color: "#000000", name: "X" },
    tiktok: { emoji: "🎵", color: "#000000", name: "TikTok" },
    instagram: { emoji: "📷", color: "#e4405f", name: "Instagram" },
    reddit: { emoji: "👽", color: "#ff4500", name: "Reddit" },
    facebook: { emoji: "📘", color: "#1877f2", name: "Facebook" },
    threads: { emoji: "🧵", color: "#000000", name: "Threads" },
    medium: { emoji: "📝", color: "#000000", name: "Medium" },
    linkedin: { emoji: "💼", color: "#0077b5", name: "LinkedIn" },
    pinterest: { emoji: "📌", color: "#e60023", name: "Pinterest" },
    tumblr: { emoji: "📱", color: "#35465c", name: "Tumblr" },
    github: { emoji: "💻", color: "#181717", name: "GitHub" },
    vimeo: { emoji: "▶️", color: "#1ab7ea", name: "Vimeo" },
  };

  const getSourceBadge = () => {
    if (derivedSource && sourceBadges[derivedSource]) {
      const badge = sourceBadges[derivedSource];
      return (
        <span className="source-badge" style={{ background: badge.color }}>
          {badge.emoji}
        </span>
      );
    }
    
    // Generic badge for unknown sources
    if (derivedSource) {
      return (
        <span className="source-badge" style={{ background: "#666" }}>
          🔗
        </span>
      );
    }
    
    return null;
  };

  const getSourceName = () => {
    if (!derivedSource) return "";
    if (sourceBadges[derivedSource]) {
      return sourceBadges[derivedSource].name;
    }
    // Capitalize first letter for unknown sources
    return derivedSource.charAt(0).toUpperCase() + derivedSource.slice(1);
  };

  const displayThumbnail = resolvedThumbnail ?? item.thumbnail;
  const displayContent = item.content ?? resolvedContent;

  // Keep refs in sync so the unfurl effect can read the latest values
  // without them being listed as effect dependencies.
  useEffect(() => { resolvedThumbnailRef.current = resolvedThumbnail; }, [resolvedThumbnail]);
  useEffect(() => { resolvedFacebookUrlRef.current = resolvedFacebookUrl; }, [resolvedFacebookUrl]);

  const displayUrl = useMemo(() => {
    if (derivedSource !== "facebook") return item.url;
    return resolvedFacebookUrl ?? item.url;
  }, [derivedSource, item.url, resolvedFacebookUrl]);

  const shouldShowInstagramEmbed =
    derivedSource === "instagram" &&
    !!item.url &&
    (!displayContent || !displayThumbnail || thumbnailError);

  const shouldShowTikTokEmbed = derivedSource === "tiktok" && !!item.url;
  const shouldShowRedditEmbed = derivedSource === "reddit" && !!item.url;
  const shouldShowFacebookPreview = derivedSource === "facebook" && !!item.url;
  const shouldShowThreadsPreview = derivedSource === "threads" && !!item.url;
  const shouldShowYouTubeEmbed = derivedSource === "youtube" && !!item.url;
  const shouldShowVimeoEmbed = derivedSource === "vimeo" && !!item.url;

  // Suppress top media for embeds that show their own preview
  const suppressTopMedia =
    shouldShowInstagramEmbed ||
    shouldShowTikTokEmbed ||
    shouldShowRedditEmbed ||
    shouldShowFacebookPreview ||
    shouldShowThreadsPreview ||
    shouldShowYouTubeEmbed ||
    shouldShowVimeoEmbed;

  const hostname = useMemo(() => {
    if (!item.url) return "";
    try {
      const normalized =
        item.url.startsWith("http://") || item.url.startsWith("https://")
          ? item.url
          : `https://${item.url}`;
      return new URL(normalized).hostname;
    } catch {
      return item.url;
    }
  }, [item.url]);

  // Check if text content needs truncation
  const textContent = displayContent ? decodeHtmlEntities(displayContent) : '';
  const needsTruncation = textContent.length > MAX_TEXT_CHARS;
  const displayText = needsTruncation && !isTextExpanded
    ? textContent.slice(0, MAX_TEXT_CHARS).trim() + '...'
    : textContent;

  useEffect(() => {
    setThumbnailError(false);
  }, [displayThumbnail]);

  useEffect(() => {
    let cancelled = false;

    const normalizeUrl = (urlStr: string): string | null => {
      const trimmed = urlStr.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
        return trimmed;
      return `https://${trimmed}`;
    };

    const unfurl = async () => {
      // Only attempt unfurl for Instagram, Facebook, and Threads
      if (
        derivedSource !== "instagram" &&
        derivedSource !== "facebook" &&
        derivedSource !== "threads"
      )
        return;
      if (!item.url) return;
      const fullUrl = normalizeUrl(item.url);
      if (!fullUrl) return;

      // Skip if we already have all needed data (except for Facebook which needs URL resolution)
      const needsUnfurl =
        (derivedSource === "facebook" && ((!resolvedThumbnailRef.current && !item.thumbnail) || !item.content || !resolvedFacebookUrlRef.current)) ||
        derivedSource === "threads" ||
        !item.thumbnail ||
        thumbnailError ||
        !item.content;
      if (!needsUnfurl) return;

      try {
        const res = await fetch(
          `/api/unfurl?url=${encodeURIComponent(fullUrl)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        // For Facebook: update resolved URL if available and it's not a login redirect
        if (derivedSource === "facebook" && typeof data.url === "string" && data.url) {
          let resolvedUrl = data.url;

          // If the unfurl landed on a login wall, extract the real destination from ?next=
          if (resolvedUrl.includes("/login") || resolvedUrl.includes("/checkpoint")) {
            try {
              const loginUrl = new URL(resolvedUrl);
              const next = loginUrl.searchParams.get("next");
              if (next) resolvedUrl = decodeURIComponent(next);
            } catch {
              resolvedUrl = "";
            }
          }

          if (resolvedUrl && resolvedUrl !== fullUrl && !resolvedUrl.includes("/login")) {
            setResolvedFacebookUrl(resolvedUrl);
          }
        }

        // Update thumbnail if missing or failed
        if (typeof data.image === "string" && data.image) {
          if (derivedSource === "facebook") {
            // Facebook CDN URLs contain signed tokens (oh=, oe=) that change on every
            // server request — storing them would cause an infinite update loop because
            // the next unfurl call always returns a different token. Display via local
            // state only; do NOT persist to storage.
            setResolvedThumbnail(data.image);
          } else if (!item.thumbnail || thumbnailError) {
            setResolvedThumbnail(data.image);
            try {
              await updateItemRef.current({ id: item.id, thumbnail: data.image });
            } catch {
              // Non-critical
            }
          }
        }

        // Update description if missing
        if (
          !item.content &&
          typeof data.description === "string" &&
          data.description
        ) {
          setResolvedContent(data.description);
          // Persist the resolved description
          try {
            await updateItemRef.current({ id: item.id, content: data.description });
          } catch {
            // Non-critical
          }
        }
      } catch {
        // Endpoint doesn't exist or CORS blocked - this is expected
      }
    };

    unfurl();
    return () => {
      cancelled = true;
    };
  }, [derivedSource, item.url, item.thumbnail, item.content, item.id, thumbnailError]);

  return (
    <div
      className={`content-card ${item.type} ${layoutMode === 'list' ? 'list-view' : ''}`}
      style={{ transform: `translateX(-${swipeOffset}px)` }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
    >
      {/* Thumbnail — always rendered; CSS controls sizing per layout mode */}
      {!suppressTopMedia && displayThumbnail && !thumbnailError ? (
        <div className="card-thumbnail">
          <img
            src={displayThumbnail}
            alt={item.title}
            loading="lazy"
            onError={() => {
              console.log(
                "[ContentCard] Thumbnail load failed for:",
                item.title,
                "URL:",
                displayThumbnail,
              );
              setThumbnailError(true);
            }}
          />
          {item.type === "video" && derivedSource === "youtube" && (
            <div className="video-overlay">
              <div className="youtube-logo">▶️</div>
            </div>
          )}
          {item.type === "video" && derivedSource === "tiktok" && (
            <div className="video-overlay">
              <div className="tiktok-logo">♪</div>
            </div>
          )}
          {item.type === "video" && derivedSource === "instagram" && (
            <div className="video-overlay">
              <div className="instagram-logo">📷</div>
            </div>
          )}
          {getSourceBadge()}
        </div>
      ) : !suppressTopMedia && item.type === "video" ? (
        <div className="card-thumbnail placeholder">
          <div className="video-placeholder">
            <span>▶️</span>
            <p>{item.title}</p>
          </div>
          {getSourceBadge()}
        </div>
      ) : !suppressTopMedia && displayThumbnail && thumbnailError ? (
        <div className="card-thumbnail placeholder">
          <div className="image-placeholder">
            <span>🖼️</span>
            <p>{item.title}</p>
          </div>
          {getSourceBadge()}
        </div>
      ) : layoutMode === 'list' ? (
        <div className="card-thumbnail placeholder">
          <div className="image-placeholder">
            <span>{derivedSource && sourceBadges[derivedSource] ? sourceBadges[derivedSource].emoji : '🔗'}</span>
          </div>
        </div>
      ) : null}

      <div className="card-content">
        {layoutMode === 'list' && derivedSource && (
          <div className="list-source">
            {getSourceBadge()}
            <span className="source-name">{getSourceName()}</span>
          </div>
        )}
        <div className="card-header">
          <h3 className="card-title">{decodeHtmlEntities(item.title)}</h3>
          {item.nsfw && <span className="nsfw-badge">NSFW</span>}
          {layoutMode === 'list' && item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card-url"
              onClick={(e) => e.stopPropagation()}
            >
              {hostname}
            </a>
          )}
          <div className="card-actions">
            <button
              className="card-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label="Delete"
            >
              🗑️
            </button>
          </div>
        </div>

        {displayContent && !shouldShowFacebookPreview && (
          <p className={`card-text ${isTextExpanded ? 'expanded' : ''}`}>
            {displayText}
            {needsTruncation && !isTextExpanded && (
              <button
                className="card-text-more"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTextExpanded(true);
                }}
              >
                more
              </button>
            )}
            {needsTruncation && isTextExpanded && (
              <button
                className="card-text-less"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTextExpanded(false);
                }}
              >
                less
              </button>
            )}
          </p>
        )}

        {shouldShowTikTokEmbed && item.url && (
          <TikTokEmbed
            key={`tt-${item.id}`}
            url={item.url}
          />
        )}

        {shouldShowRedditEmbed && item.url && <RedditEmbed url={item.url} />}

        {shouldShowFacebookPreview && item.url && (
          <FacebookEmbed
            key={`fb-${item.id}-${autoplayVideos ? 'on' : 'off'}`}
            url={displayUrl || item.url}
            title={item.title}
            description={displayContent}
            thumbnail={displayThumbnail}
            autoplay={autoplayVideos}
          />
        )}

        {shouldShowThreadsPreview && item.url && (
          <ThreadsEmbed
            url={item.url}
            title={item.title}
            description={displayContent}
            thumbnail={displayThumbnail}
          />
        )}

        {shouldShowInstagramEmbed && item.url && (
          <InstagramEmbed url={item.url} />
        )}

        {shouldShowYouTubeEmbed && item.url && (
          <YouTubeEmbed
            key={`yt-${item.id}-${autoplayVideos ? "on" : "off"}`}
            url={item.url}
            autoplay={autoplayVideos}
          />
        )}

        {shouldShowVimeoEmbed && item.url && (
          <VimeoEmbed
            key={`vm-${item.id}-${autoplayVideos ? "on" : "off"}`}
            url={item.url}
            autoplay={autoplayVideos}
          />
        )}

        {item.url && derivedSource === "twitter" && (
          <TweetEmbed url={item.url} />
        )}

        {item.url &&
          derivedSource !== "twitter" &&
          derivedSource !== "instagram" &&
          derivedSource !== "tiktok" &&
          derivedSource !== "reddit" &&
          derivedSource !== "facebook" &&
          derivedSource !== "threads" &&
          derivedSource !== "youtube" &&
          derivedSource !== "vimeo" &&
          !displayThumbnail && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card-link"
              onClick={(e) => e.stopPropagation()}
            >
              {hostname}
            </a>
          )}

        <div className="card-footer">
          <span className="card-date">
            {new Date(item.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>

          {item.tags && item.tags.length > 0 && (
            <div className="card-tags">
              {item.tags.slice(0, 2).map((tag, idx) => (
                <span key={idx} className="card-tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {swipeOffset > 50 && (
        <div
          className="swipe-indicator"
          style={{ opacity: Math.min(swipeOffset / 100, 1) }}
        >
          Archive
        </div>
      )}
    </div>
  );
};

export default ContentCard;
