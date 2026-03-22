import React, { useEffect, useMemo, useRef } from "react";

const TIKTOK_EMBED_SRC = "https://www.tiktok.com/embed.js";

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    return trimmed;
  return `https://${trimmed}`;
}

function extractTikTokVideoId(urlStr: string): string | null {
  const normalized = normalizeUrl(urlStr);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    // Common format: /@user/video/{id}
    const match = url.pathname.match(/\/video\/(\d+)/);
    if (match?.[1]) return match[1];
    return null;
  } catch {
    const match = urlStr.match(/\/video\/(\d+)/);
    return match?.[1] ?? null;
  }
}

/**
 * Trigger TikTok embed.js to process newly inserted blockquotes.
 *
 * TikTok's embed.js scans the DOM once on load. For dynamically inserted
 * blockquotes we remove the existing script and re-append a fresh copy —
 * this forces embed.js to re-run and pick up the new blockquote.
 */
function triggerTikTokEmbed(): void {
  if (typeof window === "undefined") return;

  // Remove any existing embed.js script so we can re-inject it fresh.
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${TIKTOK_EMBED_SRC}"]`,
  );
  if (existing) {
    existing.parentNode?.removeChild(existing);
  }

  const script = document.createElement("script");
  script.src = TIKTOK_EMBED_SRC;
  script.async = true;
  document.head.appendChild(script);
}

export interface TikTokEmbedProps {
  url: string;
}

const TikTokEmbed: React.FC<TikTokEmbedProps> = ({ url }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  const videoId = useMemo(() => extractTikTokVideoId(url), [url]);

  useEffect(() => {
    if (!normalizedUrl || !videoId || !containerRef.current) return;

    // Clear any previous embed
    containerRef.current.innerHTML = "";

    // Build the blockquote structure TikTok embed.js expects
    const blockquote = document.createElement("blockquote");
    blockquote.className = "tiktok-embed";
    blockquote.setAttribute("cite", normalizedUrl);
    blockquote.setAttribute("data-video-id", videoId);
    blockquote.style.maxWidth = "100%";
    blockquote.style.minWidth = "0";

    const section = document.createElement("section");
    const link = document.createElement("a");
    link.href = normalizedUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View on TikTok";
    section.appendChild(link);
    blockquote.appendChild(section);
    containerRef.current.appendChild(blockquote);

    // Re-inject embed.js to force a fresh DOM scan that picks up this blockquote
    triggerTikTokEmbed();

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [normalizedUrl, videoId]);

  if (!videoId || !normalizedUrl) {
    return (
      <div
        className="tiktok-embed-container"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={normalizedUrl ?? url}
          target="_blank"
          rel="noopener noreferrer"
          className="card-link"
          onClick={(e) => e.stopPropagation()}
        >
          View on TikTok
        </a>
      </div>
    );
  }

  return (
    <div
      className="tiktok-embed-container"
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
    />
  );
};

export default TikTokEmbed;
