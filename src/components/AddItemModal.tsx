import React, { useState, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import { fetchLinkMetadata } from "@/services/LinkMetadataService";
import { moderateItem, checkMetadata } from "@/services/ModerationService";
import "./Modal.css";

interface AddItemModalProps {
  onClose: () => void;
  onAddList?: () => void;
  initialUrl?: string;
  initialTitle?: string;
  initialContent?: string;
}

// Decode HTML entities (e.g., &#x627; → Arabic characters)
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

const AddItemModal: React.FC<AddItemModalProps> = ({
  onClose,
  onAddList,
  initialUrl = "",
  initialTitle = "",
  initialContent = "",
}) => {
  const { lists, createItem } = useData();
  const [title, setTitle] = useState(
    initialTitle ? decodeHtmlEntities(initialTitle) : "",
  );
  const [url, setUrl] = useState(initialUrl);
  const [content, setContent] = useState(
    initialContent ? decodeHtmlEntities(initialContent) : "",
  );
  const [thumbnail, setThumbnail] = useState<string | undefined>(undefined);
  const [listId, setListId] = useState(lists[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [fetchingTitle, setFetchingTitle] = useState(false);
  const [detectedSource, setDetectedSource] = useState<string | null>(null);

  type UrlMetadata = {
    title?: string;
    description?: string;
    thumbnail?: string;
    url?: string;
  };

  // Detect source from URL
  const detectSource = (
    urlStr: string,
  ): {
    source: string;
    icon: string;
    label: string;
    contentType: string;
  } | null => {
    const lower = urlStr.toLowerCase();

    if (lower.includes("facebook.com") || lower.includes("fb.watch")) {
      let contentType = "Post";
      if (
        lower.includes("/share/v/") ||
        lower.includes("/video") ||
        lower.includes("fb.watch")
      )
        contentType = "Video";
      else if (lower.includes("/share/r/") || lower.includes("/reel"))
        contentType = "Reel";
      else if (lower.includes("/share/p/") || lower.includes("/photo"))
        contentType = "Photo";
      return { source: "facebook", icon: "📘", label: "Facebook", contentType };
    }
    if (lower.includes("instagram.com")) {
      let contentType = "Post";
      if (lower.includes("/reel")) contentType = "Reel";
      else if (lower.includes("/p/")) contentType = "Photo";
      return {
        source: "instagram",
        icon: "📷",
        label: "Instagram",
        contentType,
      };
    }
    if (lower.includes("twitter.com") || lower.includes("x.com")) {
      return {
        source: "twitter",
        icon: "🐦",
        label: "X/Twitter",
        contentType: "Tweet",
      };
    }
    if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
      return {
        source: "youtube",
        icon: "▶️",
        label: "YouTube",
        contentType: "Video",
      };
    }
    if (lower.includes("tiktok.com")) {
      return {
        source: "tiktok",
        icon: "🎵",
        label: "TikTok",
        contentType: "Video",
      };
    }
    if (lower.includes("reddit.com") || lower.includes("redd.it")) {
      return {
        source: "reddit",
        icon: "👽",
        label: "Reddit",
        contentType: "Post",
      };
    }
    if (lower.includes("threads.com")) {
      return {
        source: "threads",
        icon: "🧵",
        label: "Threads",
        contentType: "Post",
      };
    }
    return null;
  };

  // Auto-fetch metadata when modal opens with initial URL
  useEffect(() => {
    if (!initialUrl) return;

    const source = detectSource(initialUrl);
    if (source) {
      setDetectedSource(source.source);
    }

    const hasGenericInitialTitle =
      !!initialTitle &&
      !!source &&
      ((source.source === "facebook" && isGenericFacebookTitle(initialTitle)) ||
        (source.source === "instagram" &&
          isGenericInstagramTitle(initialTitle)));

    const shouldFetchInitialMetadata = !initialTitle || hasGenericInitialTitle;
    if (!shouldFetchInitialMetadata) {
      return;
    }

    if (source) {
      setTitle(`${source.label} ${source.contentType}`);
    }

    const fetchInitialMetadata = async () => {
      setFetchingTitle(true);
      try {
        const meta = await fetchUrlMetadata(initialUrl);
        if (meta?.title) {
          setTitle(decodeHtmlEntities(meta.title));
        }
        if (meta?.thumbnail) {
          setThumbnail(meta.thumbnail);
        }
        if (meta?.description && !content) {
          setContent(decodeHtmlEntities(meta.description));
        }
        if (meta?.url && meta.url !== initialUrl) {
          setUrl(meta.url);
        }
      } catch (err) {
        console.error("[AddItemModal] Error fetching initial metadata:", err);
      } finally {
        setFetchingTitle(false);
      }
    };

    fetchInitialMetadata();
  }, []); // Only run once on mount

  const normalizeUrl = (urlStr: string): string | null => {
    try {
      const trimmed = urlStr.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
        return trimmed;
      return `https://${trimmed}`;
    } catch {
      return null;
    }
  };

  const fetchUnfurl = async (
    fullUrl: string,
  ): Promise<{
    url?: string;
    title?: string;
    description?: string;
    image?: string;
    nsfw?: boolean;
  } | null> => {
    try {
      // Try the API endpoint first
      const response = await fetch(
        `/api/unfurl?url=${encodeURIComponent(fullUrl)}`,
      );
      if (response.ok) {
        const data = await response.json();

        // Check for NSFW flag from server (Reddit, Twitter, etc.)
        const moderationCheck = checkMetadata(data);
        if (!moderationCheck.allowed) {
          alert(`⚠️ ${moderationCheck.reason}`);
          return null;
        }

        return {
          url: typeof data.url === "string" ? data.url : undefined,
          title: typeof data.title === "string" ? data.title : undefined,
          description:
            typeof data.description === "string" ? data.description : undefined,
          image: typeof data.image === "string" ? data.image : undefined,
          nsfw: data.nsfw === true,
        };
      }
    } catch {
      // API endpoint doesn't exist, fall back to LinkMetadataService
    }

    // Fallback to LinkMetadataService
    try {
      const metadata = await fetchLinkMetadata(fullUrl);
      return {
        url: fullUrl, // LinkMetadataService doesn't resolve redirects
        title: metadata.title,
        description: metadata.description,
        image: metadata.image,
      };
    } catch (error) {
      console.error("[AddItemModal] Failed to fetch metadata:", error);
      return null;
    }
  };

  const isGenericInstagramTitle = (value?: string) => {
    if (!value) return true;
    const t = value.trim().toLowerCase();
    if (t === "instagram") return true;
    if (t.includes("403")) return true;
    if (t.includes("forbidden")) return true;
    if (t.includes("access denied")) return true;
    if (t.includes("not available")) return true;
    if (t.includes("log in") || t.includes("login") || t.includes("sign up"))
      return true;
    if (t === "instagram • photos and videos") return true;
    return false;
  };

  /**
   * Detect if a title is a generic Facebook error/placeholder
   * Due to CORS restrictions, Facebook often returns error pages instead of metadata
   */
  const isGenericFacebookTitle = (value?: string) => {
    if (!value) return true;
    const t = value.trim().toLowerCase();
    // Common error indicators
    if (t === "403" || t === "error" || t === "facebook") return true;
    if (t === "error facebook" || t === "facebook error") return true;
    // Access restriction messages
    if (
      t.includes("403") ||
      t.includes("forbidden") ||
      t.includes("access denied")
    )
      return true;
    if (t.includes("log in") || t.includes("login") || t.includes("sign up"))
      return true;
    // Page not found or unavailable
    if (
      t.includes("not found") ||
      t.includes("unavailable") ||
      t.includes("page")
    )
      return true;
    if (t.includes("content not found") || t.includes("not available"))
      return true;
    if (t.includes("something went wrong")) return true;
    return false;
  };

  // Fetch metadata from URL (title/description/thumbnail)
  const fetchUrlMetadata = async (
    urlStr: string,
  ): Promise<UrlMetadata | null> => {
    try {
      const fullUrl = normalizeUrl(urlStr);
      if (!fullUrl) return null;
      const url = new URL(fullUrl);

      // For YouTube, use oEmbed API to get actual video title
      if (
        url.hostname.includes("youtube.com") ||
        url.hostname.includes("youtu.be")
      ) {
        try {
          const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(fullUrl)}&format=json`;
          const response = await fetch(oembedUrl);
          if (response.ok) {
            const data = await response.json();
            return {
              title: data.title || "YouTube Video",
              thumbnail: data.thumbnail_url || undefined,
            };
          }
        } catch (err) {
          console.error("Failed to fetch YouTube title:", err);
          return { title: "YouTube Video" };
        }
      }

      // For Instagram (and as a general fallback), use our server-side unfurl endpoint
      if (url.hostname.includes("instagram.com")) {
        const meta = await fetchUnfurl(fullUrl);

        // Fallback to URL-based title
        const pathParts = url.pathname.split("/").filter((p) => p);
        let fallbackTitle = "Instagram Post";
        if (pathParts.length >= 1) {
          const type = pathParts[0];
          if (type === "p") fallbackTitle = "Instagram Photo";
          else if (type === "reel") fallbackTitle = "Instagram Reel";
          else if (type === "tv") fallbackTitle = "Instagram Video";
          else fallbackTitle = `Post by @${type}`;
        }

        const description = meta?.description
          ?.replace(/^\d+\s+Likes,\s+\d+\s+Comments\s+-\s+/i, "")
          .trim();

        const metaTitle = meta?.title;
        return {
          title: !isGenericInstagramTitle(metaTitle)
            ? metaTitle
            : fallbackTitle,
          description: description || undefined,
          thumbnail: meta?.image,
        };
      }

      // For TikTok, use oEmbed API
      if (url.hostname.includes("tiktok.com")) {
        try {
          const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(fullUrl)}`;
          const response = await fetch(oembedUrl);
          if (response.ok) {
            const data = await response.json();
            if (data.title) {
              return {
                title:
                  data.title.length > 80
                    ? data.title.substring(0, 77) + "..."
                    : data.title,
                thumbnail: data.thumbnail_url || undefined,
              };
            }
            if (data.author_name) {
              return {
                title: `TikTok by @${data.author_name}`,
                thumbnail: data.thumbnail_url || undefined,
              };
            }
          }
        } catch (err) {
          console.error("Failed to fetch TikTok title:", err);
        }
        return { title: "TikTok Video" };
      }

      // For Twitter/X
      if (
        url.hostname.includes("twitter.com") ||
        url.hostname.includes("x.com")
      ) {
        const pathParts = url.pathname.split("/").filter((p) => p);
        if (pathParts.length >= 1) {
          return { title: `Tweet by @${pathParts[0]}` };
        }
        return { title: "Tweet" };
      }

      // For Facebook - simplified approach
      // Due to CORS and privacy restrictions, we provide smart fallback titles
      if (
        url.hostname.includes("facebook.com") ||
        url.hostname.includes("fb.watch")
      ) {
        // Determine content type from URL pattern
        let fallbackTitle = "Facebook Post";
        if (url.hostname.includes("fb.watch")) {
          fallbackTitle = "Facebook Video";
        } else if (
          url.pathname.includes("/video") ||
          url.pathname.includes("/share/v/")
        ) {
          fallbackTitle = "Facebook Video";
        } else if (
          url.pathname.includes("/reel") ||
          url.pathname.includes("/share/r/")
        ) {
          fallbackTitle = "Facebook Reel";
        } else if (
          url.pathname.includes("/photo") ||
          url.pathname.includes("/share/p/")
        ) {
          fallbackTitle = "Facebook Photo";
        }

        // Try to fetch metadata, but expect it to often fail due to CORS
        try {
          const meta = await fetchUnfurl(fullUrl);
          const hasValidTitle =
            meta?.title && !isGenericFacebookTitle(meta.title);

          return {
            url: meta?.url || fullUrl,
            title: hasValidTitle ? meta.title : fallbackTitle,
            description: meta?.description,
            thumbnail: meta?.image,
          };
        } catch (error) {
          console.log(
            "[AddItemModal] Facebook metadata fetch failed (expected):",
            error,
          );
          // Return fallback data without metadata
          return {
            url: fullUrl,
            title: fallbackTitle,
            description: undefined,
            thumbnail: undefined,
          };
        }
      }

      // For other URLs, try unfurl then fall back to domain
      const meta = await fetchUnfurl(fullUrl);
      if (meta?.title || meta?.description || meta?.image) {
        return {
          title: meta.title,
          description: meta.description,
          thumbnail: meta.image,
          url: meta.url,
        };
      }

      return { title: url.hostname.replace("www.", "") };
    } catch (err) {
      return null;
    }
  };

  const handleUrlChange = async (newUrl: string) => {
    setUrl(newUrl);
    setThumbnail(undefined);
    const source = detectSource(newUrl);
    setDetectedSource(source?.source ?? null);

    const trimmedUrl = newUrl.trim();
    const existingTitle = title.trim();

    const isTitleGeneric = (src?: string) => {
      if (!src) return !existingTitle;
      if (src === "facebook")
        return !existingTitle || isGenericFacebookTitle(existingTitle);
      if (src === "instagram")
        return !existingTitle || isGenericInstagramTitle(existingTitle);
      return !existingTitle;
    };

    if (source && isTitleGeneric(source.source)) {
      setTitle(`${source.label} ${source.contentType}`);
    }

    const shouldResolveFacebookShare =
      !!trimmedUrl &&
      source?.source === "facebook" &&
      (trimmedUrl.includes("facebook.com/share/") ||
        trimmedUrl.includes("fb.watch"));

    const shouldFetchMetadata =
      !!trimmedUrl &&
      (shouldResolveFacebookShare ||
        !existingTitle ||
        (source?.source === "facebook" &&
          isGenericFacebookTitle(existingTitle)) ||
        (source?.source === "instagram" &&
          isGenericInstagramTitle(existingTitle)));

    // Auto-fetch metadata if URL is provided and title is missing or generic
    if (shouldFetchMetadata) {
      setFetchingTitle(true);
      try {
        // Add timeout to prevent infinite fetching
        const timeoutPromise = new Promise<UrlMetadata | null>((resolve) =>
          setTimeout(() => resolve(null), 5000),
        );
        const metaPromise = fetchUrlMetadata(trimmedUrl);

        const fetched = await Promise.race([metaPromise, timeoutPromise]);

        // If an unfurl step resolves a redirect (e.g. Facebook /share/*), prefer saving the resolved URL.
        if (
          fetched?.url &&
          fetched.url !== trimmedUrl &&
          (newUrl.includes("facebook.com/share/") ||
            newUrl.includes("fb.watch"))
        ) {
          setUrl(fetched.url);
        }

        const shouldUpdateTitle =
          !existingTitle ||
          (source?.source === "facebook" &&
            isGenericFacebookTitle(existingTitle)) ||
          (source?.source === "instagram" &&
            isGenericInstagramTitle(existingTitle));

        if (shouldUpdateTitle && fetched?.title) {
          setTitle(decodeHtmlEntities(fetched.title));
        }
        if (fetched?.thumbnail) {
          setThumbnail(fetched.thumbnail);
        }
        if (fetched?.description && !content.trim()) {
          setContent(decodeHtmlEntities(fetched.description));
        }
      } catch (err) {
        console.error("[AddItemModal] Error fetching title:", err);
      } finally {
        setFetchingTitle(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If no title provided, try to generate one from URL
    let finalTitle = title.trim();
    let finalUrl = url.trim() || undefined;
    let finalThumbnail = thumbnail;
    let finalContent = content.trim() || undefined;

    const hasUrl = !!url.trim();

    if (!finalTitle && hasUrl) {
      const meta = await fetchUrlMetadata(url.trim());
      const resolvedUrl = meta?.url || url.trim();
      finalUrl = resolvedUrl;
      finalTitle = meta?.title || "Untitled";
      if (!finalThumbnail && meta?.thumbnail) finalThumbnail = meta.thumbnail;
      if (!finalContent && meta?.description) finalContent = meta.description;

      setUrl(resolvedUrl);
    } else if (hasUrl && (!finalThumbnail || !finalContent)) {
      // Title might already be a fallback (e.g. "Instagram Photo"), but we still want thumbnail/snippet.
      const meta = await fetchUrlMetadata(url.trim());
      const resolvedUrl = meta?.url || url.trim();
      finalUrl = resolvedUrl;
      if (!finalThumbnail && meta?.thumbnail) finalThumbnail = meta.thumbnail;
      if (!finalContent && meta?.description) finalContent = meta.description;

      setUrl(resolvedUrl);
    } else if (!finalTitle && !hasUrl) {
      alert("Please enter a title or URL");
      return;
    }

    if (!listId) {
      alert("Please select a list");
      return;
    }

    setLoading(true);

    try {
      // Moderate content before saving
      const moderationResult = moderateItem({
        url: finalUrl,
        title: finalTitle,
        content: finalContent,
      });

      if (!moderationResult.allowed) {
        alert(
          `⚠️ Content blocked: ${moderationResult.reason || "This content is not allowed"}`,
        );
        setLoading(false);
        return;
      }

      const finalSource = finalUrl ? detectSource(finalUrl)?.source : undefined;

      await createItem({
        title: finalTitle,
        url: finalUrl,
        content: finalContent,
        thumbnail: finalThumbnail,
        listId,
        type: url ? "link" : "text",
        source: finalSource,
      });

      onClose();
    } catch (err) {
      alert("Failed to add item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content slide-in-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Add Item</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Preview section when sharing from other apps */}
          {(url || thumbnail || detectedSource) && (
            <div className="share-preview">
              {fetchingTitle ? (
                <div className="share-preview-loading">
                  <div className="fetching-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span>Loading preview...</span>
                </div>
              ) : detectedSource === "facebook" && url.trim() ? (
                /* Facebook: show thumbnail if available, otherwise branded card */
                thumbnail ? (
                  <div className="share-preview-fb-card">
                    <div className="share-preview-fb-header">
                      <svg
                        viewBox="0 0 24 24"
                        fill="white"
                        width="18"
                        height="18"
                      >
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                      <span>Facebook</span>
                    </div>
                    <div className="share-preview-fb-thumb">
                      <img src={thumbnail} alt="Facebook preview" />
                    </div>
                  </div>
                ) : (
                  <div className="share-preview-fb-card">
                    <div className="share-preview-fb-header">
                      <svg
                        viewBox="0 0 24 24"
                        fill="white"
                        width="18"
                        height="18"
                      >
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                      <span>Facebook</span>
                    </div>
                    <div className="share-preview-fb-body">
                      <span className="share-preview-fb-icon">
                        {"\u{1F517}"}
                      </span>
                      <span className="share-preview-fb-text">
                        Link saved — tap to view on Facebook
                      </span>
                    </div>
                  </div>
                )
              ) : thumbnail ? (
                <img
                  src={thumbnail}
                  alt="Preview"
                  className="share-preview-image"
                />
              ) : (
                detectedSource && (
                  <div className="share-preview-placeholder">
                    <span className={`share-preview-icon ${detectedSource}`}>
                      {detectedSource === "facebook" && "📘"}
                      {detectedSource === "instagram" && "📷"}
                      {detectedSource === "twitter" && "🐦"}
                      {detectedSource === "youtube" && "▶️"}
                      {detectedSource === "tiktok" && "🎵"}
                      {detectedSource === "reddit" && "👽"}
                      {detectedSource === "threads" && "🧵"}
                    </span>
                    <span className="share-preview-text">
                      Preview not available
                    </span>
                  </div>
                )
              )}
              {detectedSource && (
                <div className="share-preview-badge">
                  <span
                    className={`share-preview-badge-icon ${detectedSource}`}
                  >
                    {detectedSource === "facebook" && "📘"}
                    {detectedSource === "instagram" && "📷"}
                    {detectedSource === "twitter" && "🐦"}
                    {detectedSource === "youtube" && "▶️"}
                    {detectedSource === "tiktok" && "🎵"}
                    {detectedSource === "reddit" && "👽"}
                    {detectedSource === "threads" && "🧵"}
                  </span>
                  <span className="share-preview-badge-text">
                    {detectedSource === "facebook" && "Facebook"}
                    {detectedSource === "instagram" && "Instagram"}
                    {detectedSource === "twitter" && "X/Twitter"}
                    {detectedSource === "youtube" && "YouTube"}
                    {detectedSource === "tiktok" && "TikTok"}
                    {detectedSource === "reddit" && "Reddit"}
                    {detectedSource === "threads" && "Threads"}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="url">URL</label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com or youtu.be/..."
              disabled={loading}
              autoFocus={!initialUrl}
            />
          </div>

          <div className="form-group">
            <label htmlFor="title">
              Title
              {fetchingTitle && (
                <span className="fetching-indicator"> (fetching...)</span>
              )}
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Auto-generated from URL or enter manually"
              disabled={loading || fetchingTitle}
            />
          </div>

          <div className="form-group">
            <label htmlFor="content">Notes</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add any notes or description..."
              rows={4}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="list">List *</label>
            <select
              id="list"
              value={listId}
              onChange={(e) => {
                if (e.target.value === "__add_new__") {
                  onAddList?.();
                } else {
                  setListId(e.target.value);
                }
              }}
              required
              disabled={loading}
            >
              {onAddList && (
                <option value="__add_new__" style={{ fontWeight: "bold" }}>
                  + Add New List
                </option>
              )}
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.icon} {list.name}
                </option>
              ))}
            </select>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Adding..." : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddItemModal;
