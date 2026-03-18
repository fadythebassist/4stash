import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { threadsAuthService } from "@/services/ThreadsAuthService";
import "./FacebookEmbed.css"; // Reuse Facebook embed styles

interface ThreadsEmbedProps {
  url: string;
  title?: string;
  description?: string;
  thumbnail?: string;
}

interface ThreadsOEmbedData {
  html?: string;
  author_name?: string;
  thumbnail_url?: string;
}

const ThreadsEmbed: React.FC<ThreadsEmbedProps> = ({
  url,
  title,
  description,
  thumbnail,
}) => {
  const { getSocialConnection } = useAuth();
  const [thumbnailError, setThumbnailError] = useState(false);
  const [oembedData, setOembedData] = useState<ThreadsOEmbedData | null>(null);
  const [oembedLoading, setOembedLoading] = useState(true);
  const [oembedError, setOembedError] = useState(false);
  
  const threadsConnection = getSocialConnection?.('threads');

  // Fetch oEmbed data if user is connected to Threads
  useEffect(() => {
    if (!threadsConnection || !url) {
      setOembedLoading(false);
      return;
    }

    const fetchOEmbed = async () => {
      try {
        setOembedLoading(true);
        const data = await threadsAuthService.getOEmbedData(
          url,
          threadsConnection.accessToken,
          600 // max width
        );
        setOembedData(data);
        setOembedError(false);
      } catch (error) {
        console.error('Failed to fetch Threads oEmbed data:', error);
        setOembedError(true);
        setOembedData(null);
      } finally {
        setOembedLoading(false);
      }
    };

    fetchOEmbed();
  }, [url, threadsConnection]);

  // Process Threads embed script after HTML is inserted
  useEffect(() => {
    if (oembedData?.html) {
      // Load Threads embed script if not already loaded
      if (!(window as any).threadsEmbedProcessed) {
        const script = document.createElement('script');
        script.src = 'https://www.threads.net/embed.js';
        script.async = true;
        document.body.appendChild(script);
        (window as any).threadsEmbedProcessed = true;
      } else {
        // If script already loaded, process embeds
        if ((window as any).ThreadsEmbeds) {
          (window as any).ThreadsEmbeds.process();
        }
      }
    }
  }, [oembedData]);
  
  const handleClick = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Show rich embed if available and loaded
  if (threadsConnection && oembedData?.html && !oembedError) {
    return (
      <div 
        className="threads-embed"
        dangerouslySetInnerHTML={{ __html: oembedData.html }}
      />
    );
  }

  // Show loading state while fetching oEmbed
  if (threadsConnection && oembedLoading) {
    return (
      <div className="fb-card">
        <div className="fb-card-header">
          <span style={{ fontSize: "20px" }}>🧵</span>
          <span>Threads</span>
        </div>
        <div className="fb-card-body">
          <div className="fb-card-description" style={{ color: 'var(--text-tertiary)' }}>
            Loading preview...
          </div>
        </div>
      </div>
    );
  }

  // Fallback to card UI (no connection or oEmbed failed)
  const isInstagramCDN = thumbnail?.includes('cdninstagram.com');
  const shouldShowThumbnail = thumbnail && !isInstagramCDN && !thumbnailError;

  // Filter out generic login/placeholder text
  const isGenericTitle = title?.includes('Log in') || title?.includes('Threads • Log in');
  const isGenericDescription = description?.includes('Join Threads to share ideas') || 
                                  description?.includes('Log in with your Instagram');
  
  const displayTitle = !isGenericTitle ? title : undefined;
  const displayDescription = !isGenericDescription ? description : undefined;

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
      {shouldShowThumbnail && (
        <div className="fb-card-thumb">
          <img 
            src={thumbnail} 
            alt="Threads preview"
            onError={() => setThumbnailError(true)}
            loading="lazy"
          />
        </div>
      )}
      <div className="fb-card-body">
        {displayTitle && <div className="fb-card-title">{displayTitle}</div>}
        {displayDescription && (
          <div className="fb-card-description">{displayDescription}</div>
        )}
        {!displayTitle && !displayDescription && (
          <div className="fb-card-description">
            🧵 View on Threads
            {!threadsConnection && (
              <div style={{ fontSize: '0.85em', marginTop: '4px', opacity: 0.7 }}>
                💡 Connect your Threads account in Settings for rich previews
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreadsEmbed;
