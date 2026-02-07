import React, { useEffect, useMemo, useRef, useState } from 'react';
import './FacebookEmbed.css';

// Decode HTML entities for proper display
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

interface FacebookEmbedProps {
  url: string;
  title?: string;
  description?: string;
  thumbnail?: string;
}

/**
 * Detect whether the URL points to a Facebook video (or reel / fb.watch).
 */
function isFacebookVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('fb.watch') ||
    lower.includes('/video') ||
    lower.includes('/reel') ||
    lower.includes('/watch') ||
    lower.includes('/share/v/') ||
    lower.includes('/share/r/')
  );
}

/**
 * Determine the Facebook content type label from the URL.
 */
function getFacebookContentType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('fb.watch') || lower.includes('/video') || lower.includes('/watch') || lower.includes('/share/v/')) return 'Video';
  if (lower.includes('/reel') || lower.includes('/share/r/')) return 'Reel';
  if (lower.includes('/photo') || lower.includes('/share/p/')) return 'Photo';
  return 'Post';
}

const FacebookLogo: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

/**
 * FacebookEmbed – always tries the iframe plugin first (even for /share/ URLs,
 * because Facebook's own plugin server may resolve them internally).
 * Falls back to a static branded card after a timeout if the iframe stays empty.
 */
const FacebookEmbed: React.FC<FacebookEmbedProps> = ({ url, title, description, thumbnail }) => {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const normalizedUrl = useMemo(() => {
    const trimmed = url.trim();
    if (!trimmed) return null;
    return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
  }, [url]);

  const isVideo = useMemo(() => (normalizedUrl ? isFacebookVideoUrl(normalizedUrl) : false), [normalizedUrl]);
  const contentType = useMemo(() => (normalizedUrl ? getFacebookContentType(normalizedUrl) : 'Post'), [normalizedUrl]);
  const isGroupPermalink = useMemo(() => {
    if (!normalizedUrl) return false;
    const lower = normalizedUrl.toLowerCase();
    return lower.includes('facebook.com/groups/') && lower.includes('/permalink/');
  }, [normalizedUrl]);

  // For videos/reels: Always try iframe first to enable playback, fallback to thumbnail on error
  // For posts/photos: If we have a thumbnail, show it immediately (skip iframe loading state)
  const shouldPreferThumbnailCard = !!thumbnail && !isVideo;

  // Always try the iframe plugin — Facebook's plugin server may resolve /share/ URLs internally
  const iframeSrc = useMemo(() => {
    if (!normalizedUrl) return null;
    const href = encodeURIComponent(normalizedUrl);
    if (isVideo) {
      // Request larger dimensions to accommodate vertical videos without cropping
      return `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=500&height=800`;
    }
    return `https://www.facebook.com/plugins/post.php?href=${href}&show_text=true&width=500`;
  }, [normalizedUrl, isVideo]);

  // After the iframe fires onLoad, check if it rendered real content.
  // Facebook plugin iframes load but render a tiny ~0-height body when the URL is invalid.
  // Give it a grace period then measure height; if still tiny → show fallback.
  useEffect(() => {
    if (!iframeLoaded) return;
    const timer = setTimeout(() => {
      const el = iframeRef.current;
      if (el) {
        // If the iframe rendered but is very short, Facebook couldn't resolve the URL
        const height = el.getBoundingClientRect().height;
        if (height < 80) {
          setShowFallback(true);
        }
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [iframeLoaded]);

  // Also set a hard timeout: if iframe hasn't loaded at all after 8s, show fallback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!iframeLoaded) {
        setShowFallback(true);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [iframeLoaded]);

  if (!normalizedUrl) return null;

  // ── Show iframe plugin (always attempted first) ──
  if (iframeSrc && !showFallback && !isGroupPermalink && !shouldPreferThumbnailCard) {
    return (
      <div className="fb-card" onClick={(e) => e.stopPropagation()}>
        <div className="fb-card-header">
          <FacebookLogo />
          <span className="fb-card-header-text">
            Facebook {contentType}
          </span>
        </div>

        <div className="fb-card-iframe-wrap">
          {!iframeLoaded && (
            <div className="fb-card-loading">
              <div className="fb-card-dots">
                <span />
                <span />
                <span />
              </div>
              <span>Loading preview...</span>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title={`Facebook ${contentType}`}
            scrolling="no"
            allow="encrypted-media; picture-in-picture; web-share"
            allowFullScreen
            style={{ opacity: iframeLoaded ? 1 : 0 }}
            onLoad={() => setIframeLoaded(true)}
            onError={() => setShowFallback(true)}
          />
        </div>

        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fb-card-button"
          onClick={(e) => e.stopPropagation()}
        >
          Open in Facebook
        </a>
      </div>
    );
  }

  // ── Fallback: iframe failed or timed out → static branded card ──
  return (
    <div className="fb-card" onClick={(e) => e.stopPropagation()}>
      <div className="fb-card-header">
        <FacebookLogo />
        <span className="fb-card-header-text">
          Facebook {contentType}
        </span>
      </div>

      {thumbnail && !thumbnailFailed ? (
        <div className="fb-card-thumbnail">
          <img
            src={thumbnail}
            alt={title || `Facebook ${contentType}`}
            onError={() => setThumbnailFailed(true)}
          />
        </div>
      ) : (
        <div className="fb-card-body">
          <div className="fb-card-icon">{'\u{1F4F0}'}</div>
          <p className="fb-card-cta">Tap below to view on Facebook</p>
        </div>
      )}

      {description && (
        <div style={{ padding: '8px 14px', fontSize: '0.85rem', color: '#65676b' }}>
          {decodeHtmlEntities(description)}
        </div>
      )}

      <a
        href={normalizedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="fb-card-button"
        onClick={(e) => e.stopPropagation()}
      >
        Open in Facebook
      </a>
    </div>
  );
};

export default FacebookEmbed;
