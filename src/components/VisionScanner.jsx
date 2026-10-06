import React, { useRef, useState } from 'react';
import { processFile } from '../services/api';
import { getTranslations } from '../utils/translations';

/**
 * High-Aesthetic Apple visionOS Spatial Media & Vision Icon
 */
export function SpatialMediaIcon({ className = '', size = 20 }) {
  return (
    <svg 
      className={`spatial-media-icon ${className}`} 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="spatialGlassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id="spatialChassisGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
        </linearGradient>
        <radialGradient id="spatialLensIrisGrad" cx="38%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#8b5cf6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#0b0f19" stopOpacity="0.95" />
        </radialGradient>
      </defs>

      {/* Spatial Camera Chassis / Glass Rounded Frame */}
      <rect 
        x="2.5" 
        y="3.5" 
        width="19" 
        height="17" 
        rx="5.2" 
        className="spatial-icon-chassis" 
        stroke="url(#spatialChassisGrad)" 
        strokeWidth="1.5" 
      />

      {/* Precision Viewfinder Reticles */}
      <path d="M5.5 6.5H7.5" stroke="url(#spatialGlassGrad)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5.5 6.5V8.5" stroke="url(#spatialGlassGrad)" strokeWidth="1.4" strokeLinecap="round" />
      
      <path d="M18.5 6.5H16.5" stroke="url(#spatialGlassGrad)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M18.5 6.5V8.5" stroke="url(#spatialGlassGrad)" strokeWidth="1.4" strokeLinecap="round" />

      <path d="M5.5 17.5H7.5" stroke="url(#spatialGlassGrad)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5.5 17.5V15.5" stroke="url(#spatialGlassGrad)" strokeWidth="1.4" strokeLinecap="round" />

      <path d="M18.5 17.5H16.5" stroke="url(#spatialGlassGrad)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M18.5 17.5V15.5" stroke="url(#spatialGlassGrad)" strokeWidth="1.4" strokeLinecap="round" />

      {/* Optical Outer Lens Aperture Ring */}
      <circle 
        cx="12" 
        cy="12" 
        r="4.5" 
        className="spatial-icon-lens-ring" 
        stroke="url(#spatialGlassGrad)" 
        strokeWidth="1.5" 
      />

      {/* Multi-depth Lens Iris */}
      <circle 
        cx="12" 
        cy="12" 
        r="2.2" 
        className="spatial-icon-lens-iris" 
        fill="url(#spatialLensIrisGrad)" 
      />

      {/* Specular Curved Glint / Glass Arc Highlight */}
      <path 
        d="M9.8 9.8 A 3.1 3.1 0 0 1 14.2 9.8" 
        className="spatial-icon-glint" 
        stroke="#ffffff" 
        strokeWidth="1.2" 
        strokeLinecap="round" 
        strokeOpacity="0.95" 
      />

      {/* Document Fold / Multimodal Accent Node */}
      <circle 
        cx="17" 
        cy="7" 
        r="1.2" 
        className="spatial-icon-dot" 
        fill="url(#spatialGlassGrad)" 
      />
    </svg>
  );
}

export default function VisionScanner({
  selectedFile,
  selectedImage, // backward compatibility
  processingFile,
  isProcessing,
  isComplete,
  onFileSelected,
  onImageSelected, // backward compatibility
  onFileCleared,
  onImageCleared, // backward compatibility
  isThinking,
  externalInputRef,
  activeLanguage = 'en-US'
}) {
  const t = getTranslations(activeLanguage).scanner;
  const currentFile = selectedFile || processingFile || selectedImage;
  const isAnalyzing = Boolean((processingFile || selectedFile) && isThinking);
  const isFinished = Boolean(isComplete && !selectedFile && (processingFile || currentFile));
  const handleSelect = onFileSelected || onImageSelected;
  const handleClear = onFileCleared || onImageCleared;
  const isPdf = Boolean(
    currentFile && (
      currentFile.isPdf || 
      currentFile.mimeType === 'application/pdf' || 
      currentFile.name?.toLowerCase().endsWith('.pdf')
    )
  );

  const internalInputRef = useRef(null);
  const fileInputRef = externalInputRef || internalInputRef;
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const processed = await processFile(file);
      if (handleSelect) handleSelect(processed);
    } catch (err) {
      console.warn("Could not process selected file:", err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    if (!file) return;
    const isImg = file.type?.startsWith('image/');
    const fileName = (file.name || '').toLowerCase();
    const fileType = (file.type || '').toLowerCase();
    const isPdfFile = fileType.includes('pdf') || fileName.endsWith('.pdf');
    if (!isImg && !isPdfFile) return;

    try {
      const processed = await processFile(file);
      if (handleSelect) handleSelect(processed);
    } catch (err) {
      console.warn("Could not process dropped file:", err);
    }
  };

  return (
    <div 
      className={`vision-scanner-container ${isDragging ? 'dragging' : ''} ${currentFile ? 'has-image' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {!externalInputRef && (
        <input 
          type="file" 
          ref={fileInputRef}
          accept="image/*,application/pdf,.pdf"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      )}

      {currentFile ? (
        <div className={`spatial-preview-card ${isAnalyzing ? 'processing' : ''} ${isFinished ? 'complete' : ''}`}>
          <div className="spatial-glass-sheen"></div>
          
          {isPdf ? (
            <div className={`spatial-doc-icon-wrap ${isAnalyzing ? 'pulse-processing' : ''}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="pdf-doc-svg">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <line x1="10" y1="9" x2="8" y2="9"></line>
              </svg>
              <span className="spatial-pdf-tag">PDF</span>
              {isAnalyzing && <div className="doc-scanner-sweep"></div>}
            </div>
          ) : (
            <div className="spatial-img-thumb-wrap">
              <img src={currentFile.dataUrl} alt="Inspection payload" className="spatial-thumb-img" />
              <div className={`spatial-laser-scanner ${isAnalyzing ? 'processing' : ''}`}></div>
              <div className="spatial-lens-glint-overlay"></div>
            </div>
          )}

          <div className="spatial-preview-info">
            <div className="spatial-filename-row">
              <span className="spatial-preview-filename" title={currentFile.name}>
                {currentFile.name}
              </span>
              <span className={`spatial-status-tag ${isFinished ? 'complete' : isAnalyzing ? 'processing' : isPdf ? 'pdf' : 'vision'}`}>
                {isFinished 
                  ? t.analysisComplete 
                  : isAnalyzing 
                  ? (isPdf ? t.analyzingDoc : t.analyzingImg) 
                  : (isPdf ? t.docAttached : t.visionReady)}
              </span>
            </div>
            <span className="spatial-preview-sub">
              {isFinished
                ? t.completeSub
                : isAnalyzing 
                ? t.analyzingSub 
                : (isPdf ? t.pdfSub : t.visionSub)}
            </span>
          </div>

          {!isAnalyzing && !isFinished && (
            <button 
              type="button" 
              className="spatial-clear-btn" 
              onClick={handleClear}
              disabled={isThinking}
              title={t.removeTooltip}
              aria-label={t.removeTooltip}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}

          {isAnalyzing && (
            <div className="spatial-processing-spinner" title="Analyzing payload">
              <div className="spinner-ring"></div>
            </div>
          )}

          {isFinished && (
            <div className="spatial-complete-check" title={t.analysisComplete}>
              ✓
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="spatial-scanner-btn"
          onClick={() => fileInputRef.current?.click()}
          title={t.inspectSub}
        >
          <div className="spatial-lens-aperture">
            <SpatialMediaIcon size={20} />
            <div className="spatial-lens-ambient-glow"></div>
          </div>
          <div className="spatial-scanner-text-block">
            <span className="spatial-scanner-title">{t.inspectTitle}</span>
            <span className="spatial-scanner-hint">{t.inspectSub}</span>
          </div>
          <div className="spatial-format-pill">
            <span>PDF</span>
            <span className="dot-divider">•</span>
            <span>IMG</span>
          </div>
        </button>
      )}
    </div>
  );
}
