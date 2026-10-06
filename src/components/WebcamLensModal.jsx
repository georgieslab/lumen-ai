import React, { useState, useEffect, useRef } from 'react';

export default function WebcamLensModal({ isOpen, onClose, onCapture }) {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
  const [isCapturing, setIsCapturing] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Initialize or restart camera stream
  useEffect(() => {
    if (!isOpen) {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      return;
    }

    let isMounted = true;
    setError(null);

    const startCamera = async () => {
      try {
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
        }

        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        if (isMounted) {
          setStream(newStream);
          if (videoRef.current) {
            videoRef.current.srcObject = newStream;
          }
        } else {
          newStream.getTracks().forEach(t => t.stop());
        }
      } catch (err) {
        if (isMounted) {
          console.warn("Camera access notice:", err);
          setError("Could not access camera. Please check browser permissions.");
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, facingMode]);

  // Capture frame and downscale to efficient JPEG payload
  const handleTakeSnapshot = () => {
    if (!videoRef.current || isCapturing) return;
    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');
      const maxDim = 640;
      let width = video.videoWidth || 640;
      let height = video.videoHeight || 480;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      // If front camera, mirror image for natural perception
      if (facingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
      const snapshotPayload = {
        dataUrl,
        base64: dataUrl,
        mimeType: 'image/jpeg',
        name: `Spatial_Lens_${Date.now()}.jpg`,
        isPdf: false
      };

      // Shutter visual feedback
      setTimeout(() => {
        setIsCapturing(false);
        if (onCapture) onCapture(snapshotPayload);
        onClose();
      }, 250);
    } catch (err) {
      console.warn("Snapshot capture error:", err);
      setIsCapturing(false);
    }
  };

  const toggleCameraFacing = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  if (!isOpen) return null;

  return (
    <div className="spatial-lens-backdrop animate-fade-in" onClick={onClose}>
      <div className="spatial-lens-viewfinder glass-panel" onClick={e => e.stopPropagation()}>
        {/* Viewfinder Header */}
        <div className="lens-header">
          <div className="lens-header-status">
            <span className="live-lens-dot"></span>
            <span className="live-lens-tag">SPATIAL VISION LENS</span>
          </div>
          <div className="lens-header-controls">
            <button
              type="button"
              className="lens-flip-btn"
              onClick={toggleCameraFacing}
              title="Switch front / rear camera"
            >
              🔄 Flip
            </button>
            <button
              type="button"
              className="lens-close-btn"
              onClick={onClose}
              title="Close camera"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Video Surface & Holographic Reticle */}
        <div className="lens-viewport-container">
          {error ? (
            <div className="lens-error-box">
              <span className="lens-error-icon">📷</span>
              <p>{error}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`lens-video-feed ${facingMode === 'user' ? 'mirrored' : ''}`}
                onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
              />

              {/* Shutter Flash Animation */}
              {isCapturing && <div className="lens-shutter-flash"></div>}

              {/* Holographic Vision Reticle */}
              <div className="lens-hologram-reticle">
                <div className="reticle-corner tl"></div>
                <div className="reticle-corner tr"></div>
                <div className="reticle-corner bl"></div>
                <div className="reticle-corner br"></div>
                <div className="reticle-scanline"></div>
                <div className="reticle-center-cross"></div>
              </div>
            </>
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        {/* Viewfinder Bottom Controls */}
        <div className="lens-footer">
          <span className="lens-tip">Frame document, scene, or object</span>
          <button
            type="button"
            className="lens-shutter-trigger"
            onClick={handleTakeSnapshot}
            disabled={Boolean(error) || isCapturing}
            title="Capture frame and analyze with Lumen"
          >
            <div className="shutter-inner-ring">
              <div className="shutter-center-iris"></div>
            </div>
          </button>
          <span className="lens-resolution">AI Optimized • 640px</span>
        </div>
      </div>
    </div>
  );
}
