import React, { useEffect, useMemo, useRef, useState } from "react";

const TIKTOK_EMBED_SRC = "https://www.tiktok.com/embed.js";

let tiktokEmbedPromise: Promise<void> | null = null;

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

function loadTikTokEmbed(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  if (tiktokEmbedPromise) return tiktokEmbedPromise;

  tiktokEmbedPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TIKTOK_EMBED_SRC}"]`,
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load TikTok embed")),
        {
          once: true,
        },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = TIKTOK_EMBED_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load TikTok embed"));
    document.head.appendChild(script);
  });

  return tiktokEmbedPromise;
}

export interface TikTokEmbedProps {
  url: string;
}

const TikTokEmbed: React.FC<TikTokEmbedProps> = ({ url }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  const videoId = useMemo(() => extractTikTokVideoId(url), [url]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      setFailed(false);
      if (!normalizedUrl || !videoId || !containerRef.current) {
        setFailed(true);
        return;
      }

      containerRef.current.innerHTML = "";

      // Create blockquote structure TikTok script expects
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

      try {
        await loadTikTokEmbed();
        if (cancelled) return;

        // TikTok embed.js usually scans the DOM automatically on load.
        // For dynamic inserts, re-adding the blockquote before/after load is enough.
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    render();

    return () => {
      cancelled = true;
    };
  }, [normalizedUrl, videoId]);

  if (failed && normalizedUrl) {
    return (
      <div
        className="tiktok-embed-container"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={normalizedUrl}
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
