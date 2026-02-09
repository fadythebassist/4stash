import React, { useEffect, useMemo, useState } from "react";
import { Item } from "@/types";
import FacebookEmbed from "./FacebookEmbed";
import InstagramEmbed from "./InstagramEmbed";
import RedditEmbed from "./RedditEmbed";
import TikTokEmbed from "./TikTokEmbed";
import TweetEmbed from "./TweetEmbed";
import ThreadsEmbed from "./ThreadsEmbed";
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
}

const ContentCard: React.FC<ContentCardProps> = ({
  item,
  onDelete,
  onArchive,
  onClick,
}) => {
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
    if (item.source) return item.source;
    if (!item.url) return undefined;
    const lower = item.url.toLowerCase();
    if (lower.includes("facebook.com") || lower.includes("fb.watch"))
      return "facebook";
    if (lower.includes("instagram.com")) return "instagram";
    if (lower.includes("tiktok.com")) return "tiktok";
    if (lower.includes("reddit.com") || lower.includes("redd.it"))
      return "reddit";
    if (lower.includes("twitter.com") || lower.includes("x.com"))
      return "twitter";
    if (lower.includes("youtube.com") || lower.includes("youtu.be"))
      return "youtube";
    if (lower.includes("threads.com")) return "threads";
    return undefined;
  }, [item.source, item.url]);

  const getSourceBadge = () => {
    const badges: Record<string, { emoji: string; color: string }> = {
      youtube: { emoji: "▶️", color: "#ff0000" },
      twitter: { emoji: "🐦", color: "#1da1f2" },
      tiktok: { emoji: "🎵", color: "#000000" },
      instagram: { emoji: "📷", color: "#e4405f" },
      reddit: { emoji: "👽", color: "var(--accent-primary)" },
      facebook: { emoji: "📘", color: "var(--accent-primary)" },
      threads: { emoji: "🧵", color: "#000000" },
    };

    if (derivedSource && badges[derivedSource]) {
      const badge = badges[derivedSource];
      return (
        <span className="source-badge" style={{ background: badge.color }}>
          {badge.emoji}
        </span>
      );
    }
    return null;
  };

  const displayThumbnail = resolvedThumbnail ?? item.thumbnail;
  const displayContent = item.content ?? resolvedContent;

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

  // Suppress top media for embeds that show their own preview
  const suppressTopMedia =
    shouldShowInstagramEmbed ||
    shouldShowTikTokEmbed ||
    shouldShowRedditEmbed ||
    shouldShowFacebookPreview ||
    shouldShowThreadsPreview;

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
        derivedSource === "facebook" ||
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

        // For Facebook: update resolved URL if available
        if (
          derivedSource === "facebook" &&
          typeof data.url === "string" &&
          data.url &&
          data.url !== fullUrl
        ) {
          setResolvedFacebookUrl(data.url);
        }

        // Update thumbnail if missing or failed
        if (typeof data.image === "string" && data.image) {
          // Facebook thumbnails frequently come from CORP-protected hosts (e.g. lookaside.fbsbx.com)
          // and may need to be replaced with our proxied URL even if item.thumbnail exists.
          if (derivedSource === "facebook") {
            if (data.image !== item.thumbnail) {
              setResolvedThumbnail(data.image);
            }
          } else if (!item.thumbnail || thumbnailError) {
            setResolvedThumbnail(data.image);
          }
        }

        // Update description if missing
        if (
          !item.content &&
          typeof data.description === "string" &&
          data.description
        ) {
          setResolvedContent(data.description);
        }
      } catch {
        // Endpoint doesn't exist or CORS blocked - this is expected
      }
    };

    unfurl();
    return () => {
      cancelled = true;
    };
  }, [derivedSource, item.url, item.thumbnail, item.content, thumbnailError]);

  return (
    <div
      className={`content-card ${item.type}`}
      style={{ transform: `translateX(-${swipeOffset}px)` }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
    >
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
      ) : null}

      <div className="card-content">
        <div className="card-header">
          <h3 className="card-title">{decodeHtmlEntities(item.title)}</h3>
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
          <p className="card-text">{decodeHtmlEntities(displayContent)}</p>
        )}

        {shouldShowTikTokEmbed && item.url && <TikTokEmbed url={item.url} />}

        {shouldShowRedditEmbed && item.url && <RedditEmbed url={item.url} />}

        {shouldShowFacebookPreview && item.url && (
          <FacebookEmbed
            url={displayUrl || item.url}
            title={item.title}
            description={displayContent}
            thumbnail={displayThumbnail}
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
