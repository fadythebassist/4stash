import React from 'react';
import { Item } from '@/types';
import './Modal.css';

// Decode HTML entities for proper display
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

interface ItemDetailModalProps {
  item: Item;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item, onClose, onDelete, onEdit }) => {
  // Extract YouTube video ID for embedding
  const getYouTubeEmbedUrl = (url: string): string | null => {
    try {
      let videoId: string | null = null;
      
      // Add protocol if missing
      let fullUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        fullUrl = 'https://' + url;
      }
      
      if (fullUrl.includes('youtube.com/watch')) {
        const urlObj = new URL(fullUrl);
        videoId = urlObj.searchParams.get('v');
      } else if (fullUrl.includes('youtu.be/')) {
        const match = fullUrl.match(/youtu\.be\/([^?&]+)/);
        videoId = match ? match[1] : null;
      } else if (fullUrl.includes('youtube.com/embed/')) {
        const match = fullUrl.match(/embed\/([^?&]+)/);
        videoId = match ? match[1] : null;
      }
      
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    } catch (err) {
      console.error('Failed to extract YouTube video ID:', err);
    }
    return null;
  };

  const youtubeEmbedUrl = item.source === 'youtube' && item.url ? getYouTubeEmbedUrl(item.url) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-detail slide-in-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{decodeHtmlEntities(item.title)}</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* YouTube Video Player */}
          {youtubeEmbedUrl ? (
            <div className="video-player">
              <iframe
                src={youtubeEmbedUrl}
                title={item.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          ) : item.thumbnail && (
            <div className="detail-thumbnail">
              <img src={item.thumbnail} alt={item.title} />
            </div>
          )}

          {item.content && (
            <div className="detail-section">
              <h3>Notes</h3>
              <p>{decodeHtmlEntities(item.content)}</p>
            </div>
          )}

          {item.url && (
            <div className="detail-section">
              <h3>Link</h3>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="detail-link">
                {item.url}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          )}

          {item.tags && item.tags.length > 0 && (
            <div className="detail-section">
              <h3>Tags</h3>
              <div className="detail-tags">
                {item.tags.map((tag, idx) => (
                  <span key={idx} className="detail-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="detail-section">
            <h3>Details</h3>
            <div className="detail-meta">
              <div className="meta-item">
                <span className="meta-label">Created</span>
                <span className="meta-value">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
              {item.source && (
                <div className="meta-item">
                  <span className="meta-label">Source</span>
                  <span className="meta-value">{item.source}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={onDelete} className="btn btn-danger">
            Delete
          </button>
          <button onClick={onEdit} className="btn btn-secondary">
            Edit
          </button>
          <button onClick={onClose} className="btn btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemDetailModal;
