import React, { useMemo, useState } from "react";

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    return trimmed;
  return `https://${trimmed}`;
}

function extractVimeoVideoId(urlStr: string): string | null {
  const normalized = normalizeUrl(urlStr);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    const hostname = url.hostname.toLowerCase();

    if (!hostname.includes("vimeo.com")) return null;

    // https://vimeo.com/{id}
    // https://vimeo.com/{id}/{hash}  (private videos with hash)
    // https://player.vimeo.com/video/{id}
    const match = url.pathname.match(/\/(?:video\/)?(\d+)/);
    return match?.[1] ?? null;
  } catch {
    // Fallback regex
    const match = urlStr.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return match?.[1] ?? null;
  }
}

function extractVimeoHash(urlStr: string): string | null {
  const normalized = normalizeUrl(urlStr);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    // Private video hash is the second path segment: /id/hash
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && /^[a-f0-9]+$/i.test(parts[1])) return parts[1];
    return null;
  } catch {
    return null;
  }
}

export interface VimeoEmbedProps {
  url: string;
  autoplay?: boolean;
  muted?: boolean;
}

const VimeoEmbed: React.FC<VimeoEmbedProps> = ({ url, autoplay = false, muted }) => {
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  const videoId = useMemo(() => extractVimeoVideoId(url), [url]);
  const videoHash = useMemo(() => extractVimeoHash(url), [url]);
  const [failed, setFailed] = useState(false);

  // Vimeo requires muted=1 for autoplay to work under browser autoplay policies.
  const isMuted = muted !== undefined ? muted : autoplay;

  const embedUrl = useMemo(() => {
    if (!videoId) return null;
    const params = new URLSearchParams({
      autoplay: autoplay ? "1" : "0",
      muted: isMuted ? "1" : "0",
      byline: "0",
      portrait: "0",
      title: "0",
      dnt: "1",
    });
    if (videoHash) params.set("h", videoHash);
    return `https://player.vimeo.com/video/${videoId}?${params.toString()}`;
  }, [videoId, videoHash, autoplay, isMuted]);

  if (!embedUrl || failed) {
    return (
      <div
        className="vimeo-embed-container"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={normalizedUrl ?? url}
          target="_blank"
          rel="noopener noreferrer"
          className="card-link"
          onClick={(e) => e.stopPropagation()}
        >
          View on Vimeo
        </a>
      </div>
    );
  }

  return (
    <div
      className="vimeo-embed-container"
      onClick={(e) => e.stopPropagation()}
    >
      <iframe
        src={embedUrl}
        title="Vimeo video"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
};

export default VimeoEmbed;
