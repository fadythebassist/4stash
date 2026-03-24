import React, { useEffect, useMemo, useState } from "react";

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;

  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);

    if (parsed.hostname.includes("instagram.com")) {
      parsed.protocol = "https:";
      parsed.search = "";
      parsed.hash = "";

      if (parsed.pathname.startsWith("/reels/")) {
        parsed.pathname = parsed.pathname.replace("/reels/", "/reel/");
      }

      if (!parsed.pathname.endsWith("/")) {
        parsed.pathname = `${parsed.pathname}/`;
      }
    }

    return parsed.toString();
  } catch {
    return withProtocol;
  }
}

interface InstagramEmbedInfo {
  embedUrl: string;
  type: "reel" | "p" | "tv";
}

function getInstagramEmbedInfo(urlStr: string): InstagramEmbedInfo | null {
  try {
    const parsed = new URL(urlStr);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return null;

    const type = segments[0];
    const id = segments[1];

    if ((type === "reel" || type === "p" || type === "tv") && id) {
      return {
        embedUrl: `https://www.instagram.com/${type}/${id}/embed/`,
        type,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export interface InstagramEmbedProps {
  url: string;
}

const InstagramEmbed: React.FC<InstagramEmbedProps> = ({ url }) => {
  const [failed, setFailed] = useState(false);
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  const embedInfo = useMemo(
    () => (normalizedUrl ? getInstagramEmbedInfo(normalizedUrl) : null),
    [normalizedUrl],
  );
  const embedHeight = embedInfo?.type === "reel" ? 730 : 860;

  useEffect(() => {
    setFailed(!normalizedUrl || !embedInfo);
  }, [normalizedUrl, embedInfo]);

  return (
    <div className="instagram-embed" onClick={(e) => e.stopPropagation()}>
      {!failed && embedInfo ? (
        <iframe
          src={embedInfo.embedUrl}
          title="Instagram post"
          loading="lazy"
          scrolling="no"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          style={{ width: "100%", height: `${embedHeight}px`, border: "0", borderRadius: "12px", overflow: "hidden" }}
        />
      ) : normalizedUrl ? (
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="card-link"
          onClick={(e) => e.stopPropagation()}
        >
          View on Instagram
        </a>
      ) : null}
    </div>
  );
};

export default InstagramEmbed;
