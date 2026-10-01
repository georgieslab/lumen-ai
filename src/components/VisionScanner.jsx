import React, { useRef, useState } from 'react';
import { compressImage } from '../services/api';

export default function VisionScanner({
  selectedImage,
  onImageSelected,
  onImageCleared,
  isThinking
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      onImageSelected(compressed);
    } catch (err) {
      console.warn("Could not compress selected image:", err);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const compressed = await compressImage(file);
      onImageSelected(compressed);
    } catch (err) {
      console.warn("Could not compress dropped image:", err);
    }
  };

  return (
    <div 
      className={`vision-scanner-container ${isDragging ? 'dragging' : ''} ${selectedImage ? 'has-image' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input 
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {selectedImage ? (
        <div className="image-preview-card">
          <div className="preview-image-wrap">
            <img src={selectedImage.dataUrl} alt="Inspection payload" className="preview-thumb" />
            <div className="scanner-line-active"></div>
          </div>
          <div className="preview-meta">
            <span className="preview-filename">{selectedImage.name}</span>
            <span className="preview-badge">Multimodal Ready</span>
          </div>
          <button 
            type="button" 
            className="clear-preview-btn" 
            onClick={onImageCleared}
            disabled={isThinking}
            title="Remove image"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="scanner-trigger-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach or drop an image for AI vision inspection"
        >
          <div className="scanner-icon-wrap">
            <svg className="moving-camera-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle className="svg-aperture-ring" cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
              <path d="M23 19A2 2 0 0 1 21 21H3A2 2 0 0 1 1 19V8A2 2 0 0 1 3 6H7L9 3H15L17 6H21A2 2 0 0 1 23 8Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <circle className="svg-lens-iris" cx="12" cy="13" r="3" fill="currentColor" opacity="0.85" />
              <line className="svg-scanner-beam" x1="5" y1="13" x2="19" y2="13" stroke="url(#scannerGradient)" strokeWidth="1.5" strokeLinecap="round" />
              <defs>
                <linearGradient id="scannerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity="0" />
                  <stop offset="50%" stopColor="#38bdf8" stopOpacity="1" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="scanner-label">Inspect Photo / Drop Document</span>
        </button>
      )}
    </div>
  );
}
