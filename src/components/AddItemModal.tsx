import React, { useState, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import './Modal.css';

interface AddItemModalProps {
  onClose: () => void;
  initialUrl?: string;
  initialTitle?: string;
  initialContent?: string;
}

const AddItemModal: React.FC<AddItemModalProps> = ({ 
  onClose, 
  initialUrl = '', 
  initialTitle = '',
  initialContent = ''
}) => {
  const { lists, createItem } = useData();
  const [title, setTitle] = useState(initialTitle);
  const [url, setUrl] = useState(initialUrl);
  const [content, setContent] = useState(initialContent);
  const [thumbnail, setThumbnail] = useState<string | undefined>(undefined);
  const [listId, setListId] = useState(lists[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [fetchingTitle, setFetchingTitle] = useState(false);
  const [detectedSource, setDetectedSource] = useState<string | null>(null);

  type UrlMetadata = { title?: string; description?: string; thumbnail?: string; url?: string };

  // Detect source from URL
  const detectSource = (urlStr: string): { source: string; icon: string; label: string; contentType: string } | null => {
    const lower = urlStr.toLowerCase();
    
    if (lower.includes('facebook.com') || lower.includes('fb.watch')) {
      let contentType = 'Post';
      if (lower.includes('/share/v/') || lower.includes('/video') || lower.includes('fb.watch')) contentType = 'Video';
      else if (lower.includes('/share/r/') || lower.includes('/reel')) contentType = 'Reel';
      else if (lower.includes('/share/p/') || lower.includes('/photo')) contentType = 'Photo';
      return { source: 'facebook', icon: '📘', label: 'Facebook', contentType };
    }
    if (lower.includes('instagram.com')) {
      let contentType = 'Post';
      if (lower.includes('/reel')) contentType = 'Reel';
      else if (lower.includes('/p/')) contentType = 'Photo';
      return { source: 'instagram', icon: '📷', label: 'Instagram', contentType };
    }
    if (lower.includes('twitter.com') || lower.includes('x.com')) {
      return { source: 'twitter', icon: '🐦', label: 'X/Twitter', contentType: 'Tweet' };
    }
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      return { source: 'youtube', icon: '▶️', label: 'YouTube', contentType: 'Video' };
    }
    if (lower.includes('tiktok.com')) {
      return { source: 'tiktok', icon: '🎵', label: 'TikTok', contentType: 'Video' };
    }
    if (lower.includes('reddit.com') || lower.includes('redd.it')) {
      return { source: 'reddit', icon: '👽', label: 'Reddit', contentType: 'Post' };
    }
    return null;
  };

  // Auto-fetch metadata when modal opens with initial URL
  useEffect(() => {
    if (initialUrl && !initialTitle) {
      // Detect source immediately for better UX
      const source = detectSource(initialUrl);
      if (source) {
        setDetectedSource(source.source);
        // Set a temporary title while fetching
        setTitle(`${source.label} ${source.contentType}`);
      }
      
      // Fetch actual metadata
      const fetchInitialMetadata = async () => {
        setFetchingTitle(true);
        try {
          const meta = await fetchUrlMetadata(initialUrl);
          if (meta?.title) {
            setTitle(meta.title);
          }
          if (meta?.thumbnail) {
            setThumbnail(meta.thumbnail);
          }
          if (meta?.description && !content) {
            setContent(meta.description);
          }
          if (meta?.url && meta.url !== initialUrl) {
            setUrl(meta.url);
          }
        } catch (err) {
          console.error('[AddItemModal] Error fetching initial metadata:', err);
        } finally {
          setFetchingTitle(false);
        }
      };
      
      fetchInitialMetadata();
    } else if (initialUrl) {
      const source = detectSource(initialUrl);
      if (source) {
        setDetectedSource(source.source);
      }
    }
  }, []); // Only run once on mount

  const normalizeUrl = (urlStr: string): string | null => {
    try {
      const trimmed = urlStr.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
      return `https://${trimmed}`;
    } catch {
      return null;
    }
  };

  const fetchUnfurl = async (
    fullUrl: string
  ): Promise<{ url?: string; title?: string; description?: string; image?: string } | null> => {
    try {
      const response = await fetch(`/api/unfurl?url=${encodeURIComponent(fullUrl)}`);
      if (!response.ok) return null;
      const data = await response.json();
      return {
        url: typeof data.url === 'string' ? data.url : undefined,
        title: typeof data.title === 'string' ? data.title : undefined,
        description: typeof data.description === 'string' ? data.description : undefined,
        image: typeof data.image === 'string' ? data.image : undefined
      };
    } catch {
      return null;
    }
  };

  const isGenericInstagramTitle = (value?: string) => {
    if (!value) return true;
    const t = value.trim().toLowerCase();
    if (t === 'instagram') return true;
    if (t.includes('403')) return true;
    if (t.includes('forbidden')) return true;
    if (t.includes('access denied')) return true;
    if (t.includes('not available')) return true;
    if (t.includes('log in') || t.includes('login') || t.includes('sign up')) return true;
    if (t === 'instagram • photos and videos') return true;
    return false;
  };

  const isGenericFacebookTitle = (value?: string) => {
    if (!value) return true;
    const t = value.trim().toLowerCase();
    if (t === '403') return true;
    if (t === 'error') return true;
    if (t === 'error facebook') return true;
    if (t === 'facebook') return true;
    if (t.includes('403')) return true;
    if (t.includes('forbidden')) return true;
    if (t.includes('access denied')) return true;
    if (t.includes('log in') || t.includes('login') || t.includes('sign up')) return true;
    if (t.includes('content not found') || t.includes('not available')) return true;
    if (t.includes('something went wrong')) return true;
    return false;
  };

  // Fetch metadata from URL (title/description/thumbnail)
  const fetchUrlMetadata = async (urlStr: string): Promise<UrlMetadata | null> => {
    try {
      const fullUrl = normalizeUrl(urlStr);
      if (!fullUrl) return null;
      const url = new URL(fullUrl);
      
      // For YouTube, use oEmbed API to get actual video title
      if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
        try {
          const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(fullUrl)}&format=json`;
          const response = await fetch(oembedUrl);
          if (response.ok) {
            const data = await response.json();
            return {
              title: data.title || 'YouTube Video',
              thumbnail: data.thumbnail_url || undefined
            };
          }
        } catch (err) {
          console.error('Failed to fetch YouTube title:', err);
          return { title: 'YouTube Video' };
        }
      }
      
      // For Instagram (and as a general fallback), use our server-side unfurl endpoint
      if (url.hostname.includes('instagram.com')) {
        const meta = await fetchUnfurl(fullUrl);

        // Fallback to URL-based title
        const pathParts = url.pathname.split('/').filter((p) => p);
        let fallbackTitle = 'Instagram Post';
        if (pathParts.length >= 1) {
          const type = pathParts[0];
          if (type === 'p') fallbackTitle = 'Instagram Photo';
          else if (type === 'reel') fallbackTitle = 'Instagram Reel';
          else if (type === 'tv') fallbackTitle = 'Instagram Video';
          else fallbackTitle = `Post by @${type}`;
        }

        const description = meta?.description
          ?.replace(/^\d+\s+Likes,\s+\d+\s+Comments\s+-\s+/i, '')
          .trim();

        const metaTitle = meta?.title;
        return {
          title: !isGenericInstagramTitle(metaTitle) ? metaTitle : fallbackTitle,
          description: description || undefined,
          thumbnail: meta?.image
        };
      }
      
      // For TikTok, use oEmbed API
      if (url.hostname.includes('tiktok.com')) {
        try {
          const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(fullUrl)}`;
          const response = await fetch(oembedUrl);
          if (response.ok) {
            const data = await response.json();
            if (data.title) {
              return {
                title: data.title.length > 80 ? data.title.substring(0, 77) + '...' : data.title,
                thumbnail: data.thumbnail_url || undefined
              };
            }
            if (data.author_name) {
              return { title: `TikTok by @${data.author_name}`, thumbnail: data.thumbnail_url || undefined };
            }
          }
        } catch (err) {
          console.error('Failed to fetch TikTok title:', err);
        }
        return { title: 'TikTok Video' };
      }
      
      // For Twitter/X
      if (url.hostname.includes('twitter.com') || url.hostname.includes('x.com')) {
        const pathParts = url.pathname.split('/').filter(p => p);
        if (pathParts.length >= 1) {
          return { title: `Tweet by @${pathParts[0]}` };
        }
        return { title: 'Tweet' };
      }

      // For Facebook
      if (url.hostname.includes('facebook.com') || url.hostname.includes('fb.watch')) {
        const meta = await fetchUnfurl(fullUrl);
        const resolvedUrl = meta?.url || fullUrl;

        // Prefer a friendly title over the common "Error" that Facebook returns for share/redirect URLs.
        let fallbackTitle = 'Facebook Post';
        if (url.hostname.includes('fb.watch')) fallbackTitle = 'Facebook Watch';
        if (url.pathname.includes('/share/v/')) fallbackTitle = 'Facebook Video';
        else if (url.pathname.includes('/share/r/')) fallbackTitle = 'Facebook Reel';
        else if (url.pathname.includes('/share/p/')) fallbackTitle = 'Facebook Post';
        else if (url.pathname.includes('/share/')) fallbackTitle = 'Facebook Share';

        const metaTitle = meta?.title;
        return {
          url: resolvedUrl,
          title: !isGenericFacebookTitle(metaTitle) ? metaTitle : fallbackTitle,
          description: meta?.description,
          thumbnail: meta?.image
        };
      }
      
      // For other URLs, try unfurl then fall back to domain
      const meta = await fetchUnfurl(fullUrl);
      if (meta?.title || meta?.description || meta?.image) {
        return { title: meta.title, description: meta.description, thumbnail: meta.image, url: meta.url };
      }

      return { title: url.hostname.replace('www.', '') };
    } catch (err) {
      return null;
    }
  };

  const handleUrlChange = async (newUrl: string) => {
    setUrl(newUrl);
    setThumbnail(undefined);
    const source = detectSource(newUrl);
    setDetectedSource(source?.source ?? null);
    if (!title.trim() && source) {
      setTitle(`${source.label} ${source.contentType}`);
    }
    
    // Auto-fetch title if URL is provided and title is empty
    if (newUrl.trim() && !title.trim()) {
      setFetchingTitle(true);
      try {
        // Add timeout to prevent infinite fetching
        const timeoutPromise = new Promise<UrlMetadata | null>((resolve) => setTimeout(() => resolve(null), 5000));
        const metaPromise = fetchUrlMetadata(newUrl.trim());
        
        const fetched = await Promise.race([metaPromise, timeoutPromise]);
        
        // If an unfurl step resolves a redirect (e.g. Facebook /share/*), prefer saving the resolved URL.
        if (fetched?.url && fetched.url !== newUrl.trim() && newUrl.includes('facebook.com/share/')) {
          setUrl(fetched.url);
        }

        if (fetched?.title) {
          setTitle(fetched.title);
        }
        if (fetched?.thumbnail) {
          setThumbnail(fetched.thumbnail);
        }
        if (fetched?.description && !content.trim()) {
          setContent(fetched.description);
        }
      } catch (err) {
        console.error('[AddItemModal] Error fetching title:', err);
      } finally {
        setFetchingTitle(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If no title provided, try to generate one from URL
    let finalTitle = title.trim();
    let finalThumbnail = thumbnail;
    let finalContent = content.trim() || undefined;

    const hasUrl = !!url.trim();

    if (!finalTitle && hasUrl) {
      const meta = await fetchUrlMetadata(url.trim());
      const resolvedUrl = meta?.url || url.trim();
      finalTitle = meta?.title || 'Untitled';
      if (!finalThumbnail && meta?.thumbnail) finalThumbnail = meta.thumbnail;
      if (!finalContent && meta?.description) finalContent = meta.description;

      setUrl(resolvedUrl);
    } else if (hasUrl && (!finalThumbnail || !finalContent)) {
      // Title might already be a fallback (e.g. "Instagram Photo"), but we still want thumbnail/snippet.
      const meta = await fetchUrlMetadata(url.trim());
      const resolvedUrl = meta?.url || url.trim();
      if (!finalThumbnail && meta?.thumbnail) finalThumbnail = meta.thumbnail;
      if (!finalContent && meta?.description) finalContent = meta.description;

      setUrl(resolvedUrl);
    } else if (!finalTitle && !hasUrl) {
      alert('Please enter a title or URL');
      return;
    }

    if (!listId) {
      alert('Please select a list');
      return;
    }

    setLoading(true);

    try {
      const finalSource = url.trim() ? detectSource(url.trim())?.source : undefined;

      await createItem({
        title: finalTitle,
        url: url.trim() || undefined,
        content: finalContent,
        thumbnail: finalThumbnail,
        listId,
        type: url ? 'link' : 'text',
        source: finalSource
      });
      
      onClose();
    } catch (err) {
      alert('Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content slide-in-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Item</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Preview section when sharing from other apps */}
          {(url || thumbnail || detectedSource) && (
            <div className="share-preview">
              {fetchingTitle ? (
                <div className="share-preview-loading">
                  <div className="fetching-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span>Loading preview...</span>
                </div>
              ) : thumbnail ? (
                <img src={thumbnail} alt="Preview" className="share-preview-image" />
              ) : detectedSource && (
                <div className="share-preview-placeholder">
                  <span className={`share-preview-icon ${detectedSource}`}>
                    {detectedSource === 'facebook' && '📘'}
                    {detectedSource === 'instagram' && '📷'}
                    {detectedSource === 'twitter' && '🐦'}
                    {detectedSource === 'youtube' && '▶️'}
                    {detectedSource === 'tiktok' && '🎵'}
                    {detectedSource === 'reddit' && '👽'}
                  </span>
                  <span className="share-preview-text">Preview not available</span>
                </div>
              )}
              {detectedSource && (
                <div className="share-preview-badge">
                  <span className={`share-preview-badge-icon ${detectedSource}`}>
                    {detectedSource === 'facebook' && '📘'}
                    {detectedSource === 'instagram' && '📷'}
                    {detectedSource === 'twitter' && '🐦'}
                    {detectedSource === 'youtube' && '▶️'}
                    {detectedSource === 'tiktok' && '🎵'}
                    {detectedSource === 'reddit' && '👽'}
                  </span>
                  <span className="share-preview-badge-text">
                    {detectedSource === 'facebook' && 'Facebook'}
                    {detectedSource === 'instagram' && 'Instagram'}
                    {detectedSource === 'twitter' && 'X/Twitter'}
                    {detectedSource === 'youtube' && 'YouTube'}
                    {detectedSource === 'tiktok' && 'TikTok'}
                    {detectedSource === 'reddit' && 'Reddit'}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="url">URL</label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com or youtu.be/..."
              disabled={loading}
              autoFocus={!initialUrl}
            />
          </div>

          <div className="form-group">
            <label htmlFor="title">
              Title 
              {fetchingTitle && <span className="fetching-indicator"> (fetching...)</span>}
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Auto-generated from URL or enter manually"
              disabled={loading || fetchingTitle}
            />
          </div>

          <div className="form-group">
            <label htmlFor="content">Notes</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add any notes or description..."
              rows={4}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="list">List *</label>
            <select
              id="list"
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              required
              disabled={loading}
            >
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.icon} {list.name}
                </option>
              ))}
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddItemModal;
