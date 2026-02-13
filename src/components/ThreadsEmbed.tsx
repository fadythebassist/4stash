import React from "react";
import "./FacebookEmbed.css"; // Reuse Facebook embed styles

interface ThreadsEmbedProps {
  url: string;
  title?: string;
  description?: string;
  thumbnail?: string;
}

const ThreadsEmbed: React.FC<ThreadsEmbedProps> = ({
  url,
  title,
  description,
  thumbnail,
}) => {
  const [thumbnailError, setThumbnailError] = React.useState(false);
  
  const handleClick = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="fb-card fb-card-clickable"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="fb-card-header">
        <span style={{ fontSize: "20px" }}>🧵</span>
        <span>Threads</span>
      </div>
      {thumbnail && !thumbnailError ? (
        <div className="fb-card-thumb">
          <img 
            src={thumbnail} 
            alt="Threads preview"
            onError={() => {
              console.log("[ThreadsEmbed] Thumbnail failed to load, using fallback");
              setThumbnailError(true);
            }}
            loading="lazy"
          />
        </div>
      ) : thumbnail ? (
        <div className="fb-card-body" style={{ padding: "40px 20px", textAlign: "center" }}>
          <div className="fb-card-icon" style={{ fontSize: "48px", marginBottom: "12px" }}>🧵</div>
          <div className="fb-card-cta">View on Threads</div>
        </div>
      ) : null}
      <div className="fb-card-body">
        {title && <div className="fb-card-title">{title}</div>}
        {description && (
          <div className="fb-card-description">{description}</div>
        )}
        {!title && !description && (
          <div className="fb-card-description">🧵 View on Threads</div>
        )}
      </div>
    </div>
  );
};

export default ThreadsEmbed;
