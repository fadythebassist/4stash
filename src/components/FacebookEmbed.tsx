import React, { useEffect, useRef, useState } from 'react';
import FacebookPreviewCard from './FacebookPreviewCard';
import './FacebookEmbed.css';

const FACEBOOK_SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v18.0';

let facebookSdkPromise: Promise<void> | null = null;

function normalizeUrl(urlStr: string): string {
  const trimmed = urlStr.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

function isEmbeddableUrl(url: string): boolean {
  const lower = url.toLowerCase();
  
  // fb.watch short links - try to embed as video
  if (lower.includes('fb.watch')) return true;
  
  // These URL patterns typically work with embeds
  if (
    lower.includes('/posts/') ||
    lower.includes('/videos/') ||
    lower.includes('/watch/') ||
    lower.includes('/photo') ||
    lower.includes('/permalink.php') ||
    lower.includes('/reel/')
  ) {
    return true;
  }
  
  // Share URLs - only embeddable if they look like resolved permalinks
  if (lower.includes('/share/')) {
    return false;
  }
  
  // If it's a facebook.com URL with a path (not just homepage), try embedding
  if (lower.includes('facebook.com/') && new URL(lower).pathname.length > 1) {
    return true;
  }
  
  return false;
}

function ensureFbRoot() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('fb-root')) return;
  const div = document.createElement('div');
  div.id = 'fb-root';
  document.body.appendChild(div);
}

function loadFacebookSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  const win = window as unknown as {
    FB?: { XFBML?: { parse?: (el?: HTMLElement) => void } };
  };
  if (win.FB?.XFBML) return Promise.resolve();

  if (facebookSdkPromise) return facebookSdkPromise;

  facebookSdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="https://connect.facebook.net/"]`
    );

    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Facebook SDK')),
      {
        once: true
      });
      return;
    }

    ensureFbRoot();

    const script = document.createElement('script');
    script.src = FACEBOOK_SDK_SRC;
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Facebook SDK'));
    document.body.appendChild(script);
  });

  return facebookSdkPromise;
}

export interface FacebookEmbedProps {
  url: string;
  title?: string;
  description?: string;
  thumbnail?: string;
}

const FacebookEmbed: React.FC<FacebookEmbedProps> = ({ url, title, description, thumbnail }) => {
  const normalizedUrl = normalizeUrl(url);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [embedFailed, setEmbedFailed] = useState(false);
  const [embedLoading, setEmbedLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if URL is a share URL that likely won't embed
  const isShareUrl = normalizedUrl.toLowerCase().includes('/share/');
  const canTryEmbed = !isShareUrl && isEmbeddableUrl(normalizedUrl);

  useEffect(() => {
    // For share URLs, skip embed attempt entirely
    if (isShareUrl || !canTryEmbed) {
      setEmbedFailed(true);
      setEmbedLoading(false);
      return;
    }

    let cancelled = false;

    const render = async () => {
      setEmbedFailed(false);
      setEmbedLoading(true);

      if (!normalizedUrl || !containerRef.current) {
        setEmbedFailed(true);
        setEmbedLoading(false);
        return;
      }

      containerRef.current.innerHTML = '';

      // Determine if video or post
      const isVideo = normalizedUrl.toLowerCase().includes('/video') ||
                      normalizedUrl.toLowerCase().includes('/watch') ||
                      normalizedUrl.toLowerCase().includes('/reel') ||
                      normalizedUrl.toLowerCase().includes('fb.watch');

      const post = document.createElement('div');
      post.className = isVideo ? 'fb-video' : 'fb-post';
      post.setAttribute('data-href', normalizedUrl);
      post.setAttribute('data-width', '500');
      post.setAttribute('data-show-text', 'true');

      containerRef.current.appendChild(post);

      try {
        await loadFacebookSdk();
        if (cancelled) return;

        const win = window as unknown as {
          FB?: { XFBML?: { parse?: (el?: HTMLElement) => void } };
        };
        win.FB?.XFBML?.parse?.(containerRef.current);

        // Set timeout to check if embed rendered
        timeoutRef.current = setTimeout(() => {
          if (cancelled) return;
          const iframe = containerRef.current?.querySelector('iframe');
          if (!iframe) {
            setEmbedFailed(true);
          }
          setEmbedLoading(false);
        }, 5000);

      } catch {
        if (!cancelled) {
          setEmbedFailed(true);
          setEmbedLoading(false);
        }
      }
    };

    render();

    return () => {
      cancelled = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [normalizedUrl, canTryEmbed, isShareUrl]);

  // Show preview card if embed isn't possible or failed
  if (embedFailed || !canTryEmbed) {
    return (
      <FacebookPreviewCard
        url={url}
        title={title}
        description={description}
        thumbnail={thumbnail}
      />
    );
  }

  return (
    <div className="facebook-embed" onClick={(e) => e.stopPropagation()}>
      {embedLoading && (
        <div className="facebook-embed-loading">
          <span className="facebook-embed-spinner">📘</span>
          <span>Loading Facebook content...</span>
        </div>
      )}
      <div ref={containerRef} style={{ display: embedLoading ? 'none' : 'block' }} />
      {!embedLoading && normalizedUrl && (
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="card-link"
          onClick={(e) => e.stopPropagation()}
        >
          View on Facebook
        </a>
      )}
    </div>
  );
};

export default FacebookEmbed;
