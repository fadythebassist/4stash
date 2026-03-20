import React, { useMemo, useState } from "react";

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    return trimmed;
  return `https://${trimmed}`;
}

function extractYouTubeVideoId(urlStr: string): string | null {
  const normalized = normalizeUrl(urlStr);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    const hostname = url.hostname.toLowerCase();

    if (hostname.includes("youtu.be")) {
      // https://youtu.be/{id}
      const id = url.pathname.slice(1).split("/")[0];
      return id || null;
    }

    if (hostname.includes("youtube.com")) {
      // https://www.youtube.com/watch?v={id}
      const v = url.searchParams.get("v");
      if (v) return v;

      // https://www.youtube.com/shorts/{id}
      // https://www.youtube.com/live/{id}
      // https://www.youtube.com/embed/{id}
      const match = url.pathname.match(/\/(?:shorts|live|embed)\/([^/?&#]+)/);
      if (match?.[1]) return match[1];
    }

    return null;
  } catch {
    // Fallback regex for raw strings
    const match = urlStr.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/))([^/?&#]+)/,
    );
    return match?.[1] ?? null;
  }
}

export interface YouTubeEmbedProps {
  url: string;
  autoplay?: boolean;
  muted?: boolean;
}

const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({
  url,
  autoplay = false,
  muted,
}) => {
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  const videoId = useMemo(() => extractYouTubeVideoId(url), [url]);
  const [failed, setFailed] = useState(false);

  // mute=1 is required for autoplay to work under browser autoplay policies.
  // If caller explicitly passes muted, respect it; otherwise default to muted-when-autoplaying.
  const isMuted = muted !== undefined ? muted : autoplay;

  const embedUrl = useMemo(() => {
    if (!videoId) return null;
    const params = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      autoplay: autoplay ? "1" : "0",
      mute: isMuted ? "1" : "0",
    });
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  }, [videoId, autoplay, isMuted]);

  if (!embedUrl || failed) {
    return (
      <div
        className="youtube-embed-container"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={normalizedUrl ?? url}
          target="_blank"
          rel="noopener noreferrer"
          className="card-link"
          onClick={(e) => e.stopPropagation()}
        >
          View on YouTube
        </a>
      </div>
    );
  }

  return (
    <div
      className="youtube-embed-container"
      onClick={(e) => e.stopPropagation()}
    >
      <iframe
        src={embedUrl}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
};

export default YouTubeEmbed;
