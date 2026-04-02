import React, { useCallback, useMemo, useState } from "react";
import "./SocialCard.css";

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    return trimmed;
  return `https://${trimmed}`;
}

function getContentType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("/pulse/") || lower.includes("/article/")) return "Article";
  if (lower.includes("/posts/") || lower.includes("/feed/update/")) return "Post";
  if (lower.includes("/jobs/") || lower.includes("/job/")) return "Job";
  if (lower.includes("/events/")) return "Event";
  if (lower.includes("/company/")) return "Company";
  if (lower.includes("/in/")) return "Profile";
  return "Post";
}

const LinkedInLogo: React.FC = () => (
  <svg
    className="social-card-logo"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="white"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

export interface LinkedInEmbedProps {
  url: string;
  thumbnail?: string;
  title?: string;
  description?: string;
}

const LinkedInEmbed: React.FC<LinkedInEmbedProps> = ({
  url,
  thumbnail,
  title,
  description,
}) => {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  const contentType = useMemo(() => getContentType(url), [url]);

  const handleCardClick = useCallback(() => {
    if (normalizedUrl) {
      window.open(normalizedUrl, "_blank", "noopener,noreferrer");
    }
  }, [normalizedUrl]);

  if (!normalizedUrl) return null;

  const isGenericTitle = !title || title.length < 5;
  const isGenericDesc = !description || description.length < 10;
  const displayTitle = !isGenericTitle ? title : undefined;
  const displayDesc = !isGenericDesc ? description : undefined;

  return (
    <div className="social-card social-card--linkedin" onClick={(e) => e.stopPropagation()}>
      <div className="social-card-header">
        <LinkedInLogo />
        <span className="social-card-header-text">LinkedIn {contentType}</span>
      </div>

      {thumbnail && !thumbnailFailed ? (
        <div
          className="social-card-thumbnail"
          onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
          style={{ cursor: "pointer" }}
        >
          <img
            src={thumbnail}
            alt={displayTitle || `LinkedIn ${contentType}`}
            onError={() => setThumbnailFailed(true)}
            loading="lazy"
          />
        </div>
      ) : (
        <div
          className="social-card-body"
          onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
          style={{ cursor: "pointer" }}
        >
          {(displayTitle || displayDesc) ? (
            <>
              {displayTitle && <div className="social-card-title">{displayTitle}</div>}
              {displayDesc && <div className="social-card-description">{displayDesc}</div>}
            </>
          ) : (
            <>
              <div className="social-card-icon">💼</div>
              <p className="social-card-cta">Tap to view on LinkedIn</p>
            </>
          )}
        </div>
      )}

      {thumbnail && !thumbnailFailed && (displayTitle || displayDesc) && (
        <div className="social-card-text">
          {displayTitle && <div className="social-card-title">{displayTitle}</div>}
          {displayDesc && <div className="social-card-description">{displayDesc}</div>}
        </div>
      )}

      <a
        href={normalizedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="social-card-button"
        onClick={(e) => e.stopPropagation()}
      >
        Open in LinkedIn
      </a>
    </div>
  );
};

export default LinkedInEmbed;
