import React, { useMemo } from "react";

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

export interface TikTokEmbedProps {
  url: string;
}

const TikTokEmbed: React.FC<TikTokEmbedProps> = ({ url }) => {
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  const videoId = useMemo(() => extractTikTokVideoId(url), [url]);

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

  const embedUrl = `https://www.tiktok.com/embed/v2/${videoId}?autoplay=1&loop=0`;

  return (
    <div
      className="tiktok-embed-container"
      onClick={(e) => e.stopPropagation()}
    >
      <iframe
        src={embedUrl}
        allowFullScreen
        allow="autoplay; fullscreen"
        scrolling="no"
        title="TikTok Video"
        style={{ border: "none" }}
      />
    </div>
  );
};

export default TikTokEmbed;
