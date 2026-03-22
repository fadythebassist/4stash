import React, { useState, useEffect, useRef } from "react";
import { useData } from "@/contexts/DataContext";
import { fetchLinkMetadata } from "@/services/LinkMetadataService";
import { moderateItem, checkMetadata } from "@/services/ModerationService";
import TweetEmbed from "@/components/TweetEmbed";
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
  // Ref to always hold the latest resolved URL, bypassing React state closure lag.
  // This ensures handleSubmit always uses the canonical URL even if state hasn't re-rendered.
  const resolvedUrlRef = useRef<string>(initialUrl);
  const updateUrl = (newUrl: string) => {
    resolvedUrlRef.current = newUrl;
    setUrl(newUrl);
  };
  const [content, setContent] = useState(
    initialContent ? decodeHtmlEntities(initialContent) : "",
  );
  const [thumbnail, setThumbnail] = useState<string | undefined>(undefined);
  const [nsfw, setNsfw] = useState(false);
  const [listIds, setListIds] = useState<string[]>(
    lists[0]?.id ? [lists[0].id] : [],
  );
  const [loading, setLoading] = useState(false);
  const [fetchingTitle, setFetchingTitle] = useState(false);
  const [detectedSource, setDetectedSource] = useState<string | null>(null);

  const sourceConfig: Record<string, { emoji: string; label: string }> = {
    facebook: { emoji: "📘", label: "Facebook" },
    instagram: { emoji: "📷", label: "Instagram" },
    twitter: { emoji: "🐦", label: "X/Twitter" },
    youtube: { emoji: "▶️", label: "YouTube" },
    tiktok: { emoji: "🎵", label: "TikTok" },
    reddit: { emoji: "👽", label: "Reddit" },
    threads: { emoji: "🧵", label: "Threads" },
  };

  type UrlMetadata = {
    title?: string;
    description?: string;
    thumbnail?: string;
    url?: string;
    nsfw?: boolean;
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
        icon: "𝕏",
        label: "X",
        contentType: "Post",
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
    if (lower.includes("threads.net") || lower.includes("threads.com")) {
      return {
        source: "threads",
        icon: "🧵",
        label: "Threads",
        contentType: "Post",
      };
    }
    if (lower.includes("medium.com")) {
      return {
        source: "medium",
        icon: "📝",
        label: "Medium",
        contentType: "Article",
      };
    }
    if (lower.includes("linkedin.com")) {
      return {
        source: "linkedin",
        icon: "💼",
        label: "LinkedIn",
        contentType: "Post",
      };
    }
    if (lower.includes("github.com")) {
      return {
        source: "github",
        icon: "💻",
        label: "GitHub",
        contentType: "Repository",
      };
    }
    if (lower.includes("vimeo.com")) {
      return {
        source: "vimeo",
        icon: "▶️",
        label: "Vimeo",
        contentType: "Video",
      };
    }
    
    // Generic domain extraction for unknown sources
    try {
      const normalized = urlStr.startsWith("http://") || urlStr.startsWith("https://")
        ? urlStr
        : `https://${urlStr}`;
      const url = new URL(normalized);
      const hostname = url.hostname.toLowerCase();
      const parts = hostname.replace("www.", "").split(".");
      if (parts.length >= 2) {
        const domain = parts[parts.length - 2];
        return {
          source: domain,
          icon: "🔗",
          label: domain.charAt(0).toUpperCase() + domain.slice(1),
          contentType: "Link",
        };
      }
    } catch {
      // If URL parsing fails, fall through
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
          isGenericInstagramTitle(initialTitle)) ||
        (source.source === "reddit" && isGenericRedditTitle(initialTitle)));

    // Always resolve short/opaque URLs even when a title was provided by the share intent,
    // because without resolution the embed cannot render (no video ID / no real post URL).
    const isShortUrlThatNeedsResolution =
      initialUrl.includes("vt.tiktok.com") ||
      initialUrl.includes("facebook.com/share/") ||
      initialUrl.includes("fb.watch");

    const shouldFetchInitialMetadata =
      !initialTitle || hasGenericInitialTitle || isShortUrlThatNeedsResolution;
    if (!shouldFetchInitialMetadata) {
      return;
    }

    // Only set a generic placeholder title if no real title was provided
    if (source && !initialTitle) {
      setTitle(`${source.label} ${source.contentType}`);
    }

    const fetchInitialMetadata = async () => {
      setFetchingTitle(true);
      try {
        const meta = await fetchUrlMetadata(initialUrl);
        // Only overwrite title if we don't already have a real one from the share intent
        if (meta?.title && !initialTitle) {
          setTitle(decodeHtmlEntities(meta.title));
        }
        if (meta?.thumbnail) {
          setThumbnail(meta.thumbnail);
        }
        if (meta?.description && !content) {
          setContent(decodeHtmlEntities(meta.description));
        }
        // Always update the URL if it resolved to something different
        // (critical for vt.tiktok.com and facebook.com/share/ URLs)
        if (meta?.url && meta.url !== initialUrl) {
          updateUrl(meta.url);
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

  const isGenericRedditTitle = (value?: string) => {
    if (!value) return true;
    const t = value.trim().toLowerCase();
    if (t === "reddit") return true;
    if (t === "reddit - the heart of the internet") return true;
    if (t === "reddit – the heart of the internet") return true;
    if (t === "403" || t === "error" || t === "forbidden") return true;
    if (t.includes("403") || t.includes("forbidden") || t.includes("access denied"))
      return true;
    if (t.includes("log in") || t.includes("login") || t.includes("sign up"))
      return true;
    if (t.includes("not found") || t.includes("unavailable") || t.includes("not available"))
      return true;
    if (t.includes("something went wrong")) return true;
    if (t.includes("whoa there")) return true;
    return false;
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
      t.includes("unavailable")
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

      // For TikTok, resolve short URLs (vt.tiktok.com) first, then use oEmbed
      if (url.hostname.includes("tiktok.com")) {
        // Short share URLs (vt.tiktok.com) don't have a video ID — resolve via unfurl
        let resolvedTikTokUrl = fullUrl;
        if (url.hostname.includes("vt.tiktok.com")) {
          try {
            const meta = await fetchUnfurl(fullUrl);
            if (meta?.url && meta.url !== fullUrl) {
              resolvedTikTokUrl = meta.url;
            }
          } catch {
            // keep original, oEmbed will likely fail but we tried
          }
        }
        try {
          const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(resolvedTikTokUrl)}`;
          const response = await fetch(oembedUrl);
          if (response.ok) {
            const data = await response.json();
            if (data.title) {
              return {
                url: resolvedTikTokUrl,
                title:
                  data.title.length > 80
                    ? data.title.substring(0, 77) + "..."
                    : data.title,
                thumbnail: data.thumbnail_url || undefined,
              };
            }
            if (data.author_name) {
              return {
                url: resolvedTikTokUrl,
                title: `TikTok by @${data.author_name}`,
                thumbnail: data.thumbnail_url || undefined,
              };
            }
          }
        } catch (err) {
          console.error("Failed to fetch TikTok title:", err);
        }
        return { url: resolvedTikTokUrl, title: "TikTok Video" };
      }

      // For Twitter/X — try unfurl first for real metadata, fall back to username
      if (
        url.hostname.includes("twitter.com") ||
        url.hostname.includes("x.com")
      ) {
        const pathParts = url.pathname.split("/").filter((p) => p);
        const fallbackTitle =
          pathParts.length >= 1 ? `Tweet by @${pathParts[0]}` : "Tweet";
        try {
          const meta = await fetchUnfurl(fullUrl);
          if (meta?.title || meta?.description || meta?.image) {
            return {
              title: meta.title || fallbackTitle,
              description: meta.description,
              thumbnail: meta.image,
              url: meta.url,
            };
          }
        } catch (err) {
          console.error("[AddItemModal] Twitter metadata fetch failed:", err);
        }
        return { title: fallbackTitle };
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

      // For Reddit — route through our Cloud Function unfurl which tries:
      // 1. Reddit .json API (often 403'd from GCP, but worth trying)
      // 2. Reddit oEmbed API (works server-side, returns real post title)
      // 3. Jina proxy as final fallback
      if (url.hostname.includes("reddit.com") || url.hostname.includes("redd.it")) {
        const pathParts = url.pathname.split("/").filter((p) => p);
        let fallbackTitle = "Reddit Post";
        const subredditIdx = pathParts.indexOf("r");
        if (subredditIdx !== -1 && pathParts[subredditIdx + 1]) {
          fallbackTitle = `Reddit Post in r/${pathParts[subredditIdx + 1]}`;
        }

        try {
          const meta = await fetchUnfurl(fullUrl);
          const hasValidTitle = meta?.title && !isGenericRedditTitle(meta.title);
          return {
            url: meta?.url || fullUrl,
            title: hasValidTitle ? meta.title : fallbackTitle,
            description: meta?.description,
            thumbnail: meta?.image,
          };
        } catch {
          return { url: fullUrl, title: fallbackTitle };
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
    updateUrl(newUrl);
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
      if (src === "reddit")
        return !existingTitle || isGenericRedditTitle(existingTitle);
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
        source?.source === "twitter" ||
        source?.source === "reddit" ||
        (source?.source === "facebook" &&
          isGenericFacebookTitle(existingTitle)) ||
        (source?.source === "instagram" &&
          isGenericInstagramTitle(existingTitle)) ||
        (source?.source === "reddit" &&
          isGenericRedditTitle(existingTitle)));

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

        // Update the URL if it resolved to something more specific.
        // This is critical for short/opaque URLs (vt.tiktok.com, fb.watch, facebook.com/share/)
        // where the embed cannot work without the canonical URL.
        const isShortOrShareUrl =
          (source?.source === "tiktok" && trimmedUrl.includes("vt.tiktok.com")) ||
          trimmedUrl.includes("fb.watch") ||
          trimmedUrl.includes("facebook.com/share/");
        if (fetched?.url && fetched.url !== trimmedUrl && isShortOrShareUrl) {
          updateUrl(fetched.url);
        }

        const shouldUpdateTitle =
          !existingTitle ||
          (source?.source === "facebook" &&
            isGenericFacebookTitle(existingTitle)) ||
          (source?.source === "instagram" &&
            isGenericInstagramTitle(existingTitle)) ||
          (source?.source === "reddit" &&
            isGenericRedditTitle(existingTitle));

        if (shouldUpdateTitle && fetched?.title) {
          setTitle(decodeHtmlEntities(fetched.title));
        }
        if (fetched?.thumbnail) {
          setThumbnail(fetched.thumbnail);
        }
        if (fetched?.nsfw) {
          setNsfw(true);
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

    // If no title provided, try to generate one from URL.
    // Use resolvedUrlRef.current to get the latest canonical URL regardless of whether
    // React has flushed the state update from fetchInitialMetadata yet (race condition fix).
    let finalTitle = title.trim();
    const currentUrl = resolvedUrlRef.current || url;
    let finalUrl = currentUrl.trim() || undefined;
    let finalThumbnail = thumbnail;
    let finalContent = content.trim() || undefined;

    const hasUrl = !!currentUrl.trim();

    if (!finalTitle && hasUrl) {
      const meta = await fetchUrlMetadata(currentUrl.trim());
      const resolvedUrl = meta?.url || currentUrl.trim();
      finalUrl = resolvedUrl;
      finalTitle = meta?.title || "Untitled";
      if (!finalThumbnail && meta?.thumbnail) finalThumbnail = meta.thumbnail;
      if (!finalContent && meta?.description) finalContent = meta.description;

      updateUrl(resolvedUrl);
    } else if (hasUrl && (!finalThumbnail || !finalContent)) {
      // Title might already be a fallback (e.g. "Instagram Photo"), but we still want thumbnail/snippet.
      const meta = await fetchUrlMetadata(currentUrl.trim());
      const resolvedUrl = meta?.url || currentUrl.trim();
      finalUrl = resolvedUrl;
      if (!finalThumbnail && meta?.thumbnail) finalThumbnail = meta.thumbnail;
      if (!finalContent && meta?.description) finalContent = meta.description;

      updateUrl(resolvedUrl);
    } else if (!finalTitle && !hasUrl) {
      alert("Please enter a title or URL");
      return;
    }

    if (!listIds.length) {
      alert("Please select at least one list");
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
        listIds,
        type: url ? "link" : "text",
        source: finalSource,
        nsfw: nsfw || undefined,
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
              ) : detectedSource === "twitter" && url.trim() ? (
                <div className="share-preview-tweet">
                  <TweetEmbed url={url.trim()} />
                </div>
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
                      {sourceConfig[detectedSource]?.emoji ?? "🔗"}
                    </span>
                    <span className="share-preview-text">
                      Preview not available
                    </span>
                  </div>
                )
              )}
              {detectedSource && sourceConfig[detectedSource] && (
                <div className="share-preview-badge">
                  <span
                    className={`share-preview-badge-icon ${detectedSource}`}
                  >
                    {sourceConfig[detectedSource].emoji}
                  </span>
                  <span className="share-preview-badge-text">
                    {sourceConfig[detectedSource].label}
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
            <label>Lists *</label>
            <div className="list-picker">
              {lists.map((list) => {
                const checked = listIds.includes(list.id);
                return (
                  <label
                    key={list.id}
                    className={`list-picker-item${checked ? " selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={loading}
                      onChange={() => {
                        setListIds((prev) =>
                          prev.includes(list.id)
                            ? prev.filter((id) => id !== list.id)
                            : [...prev, list.id],
                        );
                      }}
                    />
                    <span className="list-picker-icon">{list.icon}</span>
                    <span className="list-picker-name">{list.name}</span>
                  </label>
                );
              })}
              {onAddList && (
                <button
                  type="button"
                  className="list-picker-add"
                  onClick={onAddList}
                  disabled={loading}
                >
                  + New List
                </button>
              )}
            </div>
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
              disabled={loading || fetchingTitle}
            >
              {loading ? "Adding..." : fetchingTitle ? "Fetching..." : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddItemModal;
