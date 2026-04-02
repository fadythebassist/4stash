import React, { useEffect, useMemo, useState } from "react";
import { Item } from "@/types";
import { useData } from "@/contexts/DataContext";
import { cleanFacebookUrl, isFacebookUrl } from "@/utils/facebook";
import "./Modal.css";

function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function shouldProxyThumbnail(urlStr?: string): boolean {
  if (!urlStr) return false;
  if (urlStr.startsWith("/api/proxy-image?")) return false;

  try {
    const hostname = new URL(urlStr, window.location.origin).hostname.toLowerCase();
    return (
      hostname.includes("instagram.com") ||
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
  if (!shouldProxyThumbnail(urlStr)) return urlStr;
  return `/api/proxy-image?url=${encodeURIComponent(urlStr)}`;
}

function isFacebookShareLike(url?: string): boolean {
  const lower = (url || "").toLowerCase();
  return (
    lower.includes("facebook.com/share/r/") ||
    lower.includes("facebook.com/share/v/") ||
    lower.includes("facebook.com/share/p/") ||
    lower.includes("fb.watch")
  );
}

function isFacebookItem(item: Item): boolean {
  return item.source === "facebook" || isFacebookUrl(item.url);
}

function isGenericFacebookDescription(text?: string): boolean {
  if (!text) return true;
  const normalized = decodeHtmlEntities(text).trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.includes("log into facebook")) return true;
  if (normalized.includes("log in to facebook")) return true;
  if (normalized.includes("start sharing and connecting")) return true;
  if (normalized.includes("create a page for a celebrity")) return true;
  if (normalized.includes("facebook helps you connect")) return true;
  return false;
}

function isGenericFacebookErrorTitle(title?: string): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (t === "403" || t === "error" || t === "facebook") return true;
  if (t === "error facebook" || t === "facebook error") return true;
  if (t.includes("403") || t.includes("forbidden") || t.includes("access denied")) return true;
  if (t.includes("log in") || t.includes("login") || t.includes("sign up")) return true;
  if (t.includes("not found") || t.includes("unavailable")) return true;
  if (t.includes("content not found") || t.includes("not available")) return true;
  if (t.includes("something went wrong")) return true;
  return false;
}

function getSafeFallbackTitle(item: Item): string {
  const currentTitle = decodeHtmlEntities(item.title || "").trim();
  const isFacebook = (item.source === "facebook") ||
    (item.url || "").toLowerCase().includes("facebook.com");

  if (currentTitle && !(isFacebook && isGenericFacebookErrorTitle(currentTitle))) {
    return currentTitle;
  }

  const lowerUrl = (item.url || "").toLowerCase();
  if (lowerUrl.includes("facebook.com/groups/") && (lowerUrl.includes("/permalink/") || lowerUrl.includes("/posts/"))) {
    return "Facebook Group Post";
  }
  if (lowerUrl.includes("facebook.com/reel") || lowerUrl.includes("facebook.com/reels/")) {
    return "Facebook Reel";
  }
  if (lowerUrl.includes("facebook.com/video") || lowerUrl.includes("facebook.com/watch")) {
    return "Facebook Video";
  }
  if (lowerUrl.includes("facebook.com/photo")) {
    return "Facebook Photo";
  }
  if (item.source === "facebook") {
    return "Facebook Post";
  }

  return currentTitle || "Saved Item";
}

interface ItemDetailModalProps {
  item: Item;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  onClose,
  onDelete,
  onEdit,
}) => {
  const { updateItem } = useData();
  const [thumbnailError, setThumbnailError] = useState(false);
  const [resolvedThumbnail, setResolvedThumbnail] = useState<string | undefined>(undefined);
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(undefined);
  const [resolvedTitle, setResolvedTitle] = useState<string | undefined>(undefined);
  const [resolvedContent, setResolvedContent] = useState<string | undefined>(undefined);

  const getYouTubeEmbedUrl = (url: string): string | null => {
    try {
      let videoId: string | null = null;
      let fullUrl = url;

      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        fullUrl = `https://${url}`;
      }

      if (fullUrl.includes("youtube.com/watch")) {
        const urlObj = new URL(fullUrl);
        videoId = urlObj.searchParams.get("v");
      } else if (fullUrl.includes("youtu.be/")) {
        const match = fullUrl.match(/youtu\.be\/([^?&]+)/);
        videoId = match ? match[1] : null;
      } else if (fullUrl.includes("youtube.com/embed/")) {
        const match = fullUrl.match(/embed\/([^?&]+)/);
        videoId = match ? match[1] : null;
      }

      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    } catch (err) {
      console.error("Failed to extract YouTube video ID:", err);
      return null;
    }
  };

  const youtubeEmbedUrl =
    item.source === "youtube" && item.url ? getYouTubeEmbedUrl(item.url) : null;

  const displayThumbnail = useMemo(
    () => toProxyThumbnail(resolvedThumbnail ?? item.thumbnail),
    [resolvedThumbnail, item.thumbnail],
  );
  const displayUrl = useMemo(
    () => cleanFacebookUrl(resolvedUrl ?? item.url) ?? resolvedUrl ?? item.url,
    [resolvedUrl, item.url],
  );
  const displayTitle = decodeHtmlEntities(resolvedTitle ?? getSafeFallbackTitle(item));
  const displayContent = useMemo(() => {
    const nextContent = resolvedContent ?? item.content;
    if (isFacebookItem(item) && isGenericFacebookDescription(nextContent)) {
      return undefined;
    }
    return nextContent;
  }, [resolvedContent, item]);

  useEffect(() => {
    setThumbnailError(false);
  }, [displayThumbnail]);

  useEffect(() => {
    let cancelled = false;

    const resolveItem = async () => {
      if (!item.url) return;

      const needsUnfurl =
        item.source === "instagram" ||
        item.source === "threads" ||
        (item.source === "facebook" && isFacebookShareLike(item.url)) ||
        shouldProxyThumbnail(item.thumbnail) ||
        !item.thumbnail;

      if (!needsUnfurl) return;

      try {
        const res = await fetch(`/api/unfurl?url=${encodeURIComponent(item.url)}`);
        if (!res.ok) return;

        const data = await res.json();
        if (cancelled) return;

        const nextThumbnail = typeof data.image === "string" ? toProxyThumbnail(data.image) : undefined;
        const nextUrl = typeof data.url === "string" && data.url
          ? cleanFacebookUrl(data.url) ?? data.url
          : undefined;
        const nextTitle = typeof data.title === "string" && data.title &&
          !(isFacebookItem(item) && isGenericFacebookErrorTitle(data.title))
          ? data.title
          : undefined;
        const nextContent = typeof data.description === "string" && data.description ? data.description : undefined;
        const safeNextContent =
          isFacebookItem(item) && isGenericFacebookDescription(nextContent)
            ? undefined
            : nextContent;

        if (nextThumbnail) {
          setResolvedThumbnail(nextThumbnail);
        }
        if (nextUrl && nextUrl !== item.url) {
          setResolvedUrl(nextUrl);
        }
        if (nextTitle && nextTitle !== item.title) {
          setResolvedTitle(nextTitle);
        }
        if (safeNextContent && !item.content) {
          setResolvedContent(safeNextContent);
        }

        const updatePayload: {
          id: string;
          url?: string;
          thumbnail?: string;
          title?: string;
          content?: string;
        } = { id: item.id };

        let hasChanges = false;

        if (nextUrl && nextUrl !== item.url) {
          updatePayload.url = nextUrl;
          hasChanges = true;
        }
        if (nextThumbnail && nextThumbnail !== item.thumbnail && !isFacebookItem(item)) {
          updatePayload.thumbnail = nextThumbnail;
          hasChanges = true;
        }
        if (nextTitle && nextTitle !== item.title) {
          updatePayload.title = nextTitle;
          hasChanges = true;
        }
        if (safeNextContent && safeNextContent !== item.content) {
          updatePayload.content = safeNextContent;
          hasChanges = true;
        }

        if (hasChanges) {
          await updateItem(updatePayload);
        }
      } catch {
        // Non-critical detail modal enrichment
      }
    };

    void resolveItem();

    return () => {
      cancelled = true;
    };
  }, [item, updateItem]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-detail slide-in-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{displayTitle}</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {youtubeEmbedUrl ? (
            <div className="video-player">
              <iframe
                src={youtubeEmbedUrl}
                title={displayTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          ) : (
            displayThumbnail && !thumbnailError && (
              <div className="detail-thumbnail">
                <img
                  src={displayThumbnail}
                  alt={displayTitle}
                  onError={() => setThumbnailError(true)}
                />
              </div>
            )
          )}

          {displayContent && (
            <div className="detail-section">
              <h3>Notes</h3>
              <p>{decodeHtmlEntities(displayContent)}</p>
            </div>
          )}

          {displayUrl && (
            <div className="detail-section">
              <h3>Link</h3>
              <a
                href={displayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="detail-link"
              >
                {displayUrl}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          )}

          {item.tags && item.tags.length > 0 && (
            <div className="detail-section">
              <h3>Tags</h3>
              <div className="detail-tags">
                {item.tags.map((tag, idx) => (
                  <span key={idx} className="detail-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="detail-section">
            <h3>Details</h3>
            <div className="detail-meta">
              <div className="meta-item">
                <span className="meta-label">Created</span>
                <span className="meta-value">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
              {item.source && (
                <div className="meta-item">
                  <span className="meta-label">Source</span>
                  <span className="meta-value">{item.source}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={onDelete} className="btn btn-danger">
            Delete
          </button>
          <button onClick={onEdit} className="btn btn-secondary">
            Edit
          </button>
          <button onClick={onClose} className="btn btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemDetailModal;
