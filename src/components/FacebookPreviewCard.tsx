import React, { useEffect, useState } from 'react';
import './FacebookPreviewCard.css';

export interface FacebookPreviewCardProps {
  url: string;
  title?: string;
  description?: string;
  thumbnail?: string;
}

const FacebookPreviewCard: React.FC<FacebookPreviewCardProps> = ({
  url,
  title,
  description,
  thumbnail
}) => {
  // Use provided data directly, no metadata fetching needed
  // Facebook links typically don't have extractable metadata due to CORS and Facebook's policies
  const displayTitle = title;
  const displayDescription = description;
  const displayThumbnail = thumbnail;

  const normalizedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
  const handleOpen = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if ('preventDefault' in e) {
      e.preventDefault();
    }
    window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
  };
  
  // Determine content type from URL for better display
  const getContentType = (): { icon: string; label: string } => {
    const lower = url.toLowerCase();
    if (lower.includes('/share/v/') || lower.includes('/video') || lower.includes('fb.watch') || lower.includes('/reel')) {
      return { icon: '🎬', label: 'Video' };
    }
    if (lower.includes('/share/r/')) {
      return { icon: '🎞️', label: 'Reel' };
    }
    if (lower.includes('/photo') || lower.includes('/share/p/')) {
      return { icon: '🖼️', label: 'Photo' };
    }
    return { icon: '📄', label: 'Post' };
  };
  
  const contentType = getContentType();
  const fallbackTitle = `Facebook ${contentType.label}`;
  const finalTitle = displayTitle && !displayTitle.toLowerCase().includes('facebook') ? displayTitle : fallbackTitle;

  return (
    <div
      className="facebook-preview-card"
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleOpen(e);
        }
      }}
    >
      <div className="facebook-preview-header">
        <span className="facebook-logo">📘</span>
        <span className="facebook-label">Facebook</span>
        <span className="facebook-content-type">{contentType.icon} {contentType.label}</span>
      </div>
      
      {displayThumbnail ? (
        <div className="facebook-preview-image">
          <img 
            src={displayThumbnail} 
            alt={finalTitle}
            onError={(e) => {
              // If thumbnail fails to load, hide it
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="facebook-preview-overlay">
            <span className="facebook-play-icon">{contentType.icon}</span>
          </div>
        </div>
      ) : (
        <div className="facebook-preview-placeholder">
          <span className="facebook-placeholder-icon">{contentType.icon}</span>
          <p>Tap to view on Facebook</p>
        </div>
      )}
      
      <div className="facebook-preview-content">
        {finalTitle && <h4 className="facebook-preview-title">{finalTitle}</h4>}
        {displayDescription && <p className="facebook-preview-description">{displayDescription}</p>}
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="facebook-preview-button"
          onClick={handleOpen}
        >
          Open in Facebook
        </a>
      </div>
    </div>
  );
};

export default FacebookPreviewCard;
