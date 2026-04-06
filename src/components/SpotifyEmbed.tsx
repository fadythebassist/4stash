import React, { useCallback, useMemo, useState } from "react";
import "./SocialCard.css";

type SpotifyEntity = "track" | "album" | "playlist" | "episode" | "show" | "artist";

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function extractSpotifyEmbedData(urlStr: string): { entity: SpotifyEntity; id: string } | null {
  const normalized = normalizeUrl(urlStr);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    if (!host.includes("spotify.com")) return null;

    const match = url.pathname.match(/\/(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)(?:[/?#]|$)/i);
    if (!match?.[1] || !match?.[2]) return null;

    const entity = match[1].toLowerCase() as SpotifyEntity;
    const id = match[2];
    return { entity, id };
  } catch {
    const match = urlStr.match(/\/(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)(?:[/?#]|$)/i);
    if (!match?.[1] || !match?.[2]) return null;
    return {
      entity: match[1].toLowerCase() as SpotifyEntity,
      id: match[2],
    };
  }
}

const SpotifyLogo: React.FC = () => (
  <svg
    className="social-card-logo"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="white"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm5.503 17.29a.748.748 0 0 1-1.03.246c-2.823-1.724-6.376-2.114-10.56-1.16a.75.75 0 0 1-.333-1.462c4.58-1.046 8.503-.603 11.675 1.333a.749.749 0 0 1 .248 1.043zm1.472-3.274a.936.936 0 0 1-1.289.309c-3.228-1.983-8.148-2.558-11.966-1.397a.938.938 0 0 1-.546-1.794c4.355-1.323 9.77-.688 13.493 1.598a.938.938 0 0 1 .308 1.284zm.126-3.41c-3.87-2.298-10.256-2.508-13.95-1.39a1.125 1.125 0 1 1-.651-2.154c4.243-1.287 11.298-1.039 15.752 1.606a1.125 1.125 0 0 1-1.151 1.938z" />
  </svg>
);

export interface SpotifyEmbedProps {
  url: string;
  title?: string;
  description?: string;
}

const SpotifyEmbed: React.FC<SpotifyEmbedProps> = ({ url, title, description }) => {
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  const embedData = useMemo(() => extractSpotifyEmbedData(url), [url]);
  const [failed, setFailed] = useState(false);

  const embedUrl = useMemo(() => {
    if (!embedData) return null;
    return `https://open.spotify.com/embed/${embedData.entity}/${embedData.id}`;
  }, [embedData]);

  const embedHeight = useMemo(() => {
    if (!embedData) return 0;
    if (embedData.entity === "track" || embedData.entity === "episode") return 152;
    return 352;
  }, [embedData]);

  const handleClick = useCallback(() => {
    if (normalizedUrl) {
      window.open(normalizedUrl, "_blank", "noopener,noreferrer");
    }
  }, [normalizedUrl]);

  if (!normalizedUrl) return null;

  const isGenericTitle = !title || title.length < 4;
  const isGenericDesc = !description || description.length < 10;
  const displayTitle = !isGenericTitle ? title : undefined;
  const displayDesc = !isGenericDesc ? description : undefined;

  return (
    <div className="social-card social-card--spotify" onClick={(e) => e.stopPropagation()}>
      <div className="social-card-header">
        <SpotifyLogo />
        <span className="social-card-header-text">Spotify</span>
      </div>

      {embedUrl && !failed ? (
        <div className="social-card-embed-wrap social-card-embed-spotify">
          <iframe
            src={embedUrl}
            title={displayTitle || "Spotify embed"}
            style={{ height: `${embedHeight}px` }}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            onError={() => setFailed(true)}
          />
        </div>
      ) : (
        <div
          className="social-card-body"
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          style={{ cursor: "pointer" }}
        >
          {(displayTitle || displayDesc) ? (
            <>
              {displayTitle && <div className="social-card-title">{displayTitle}</div>}
              {displayDesc && <div className="social-card-description">{displayDesc}</div>}
            </>
          ) : (
            <>
              <div className="social-card-icon">🎧</div>
              <p className="social-card-cta">Tap to open in Spotify</p>
            </>
          )}
        </div>
      )}

      <a
        href={normalizedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="social-card-button"
        onClick={(e) => e.stopPropagation()}
      >
        Open in Spotify
      </a>
    </div>
  );
};

export default SpotifyEmbed;
