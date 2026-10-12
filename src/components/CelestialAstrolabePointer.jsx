import React, { useEffect, useRef, useState } from 'react';
import './CelestialAstrolabePointer.css';

/**
 * The Celestial Astrolabe Custom Pointer
 * - 4-Point Geometric Celestial Reticle with graduated astrolabe dial rings
 * - 1:1 Instant Focal Starlight Point (Zero input perception delay)
 * - Trailing Celestial Reticle with spring lerp
 * - Rotates 45° & locks on when hovering any interactive element across the entire screen
 * - Precision collimator over text inputs & magnetic compass during window drag
 * - Full-screen coverage without dead zones
 */
export default function CelestialAstrolabePointer() {
  const reticleRef = useRef(null);
  const focalRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [hoverState, setHoverState] = useState('default'); // 'default' | 'interactive' | 'text' | 'drag'
  const [isClicking, setIsClicking] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const mousePos = useRef({ x: -100, y: -100 });
  const reticlePos = useRef({ x: -100, y: -100 });
  const animFrameId = useRef(0);

  useEffect(() => {
    // Only enable on devices with fine pointer (mouse / trackpad)
    const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (isTouch) {
      setEnabled(false);
      return;
    }

    setEnabled(true);
    document.documentElement.classList.add('has-celestial-cursor');

    const handlePointerMove = (e) => {
      mousePos.current.x = e.clientX;
      mousePos.current.y = e.clientY;
      setIsVisible(true);

      // Instant 1:1 Focal Pinpoint tracking
      if (focalRef.current) {
        focalRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }

      // Check element under cursor across the whole screen
      const target = e.target;
      if (!target) return;

      if (target.closest('input, textarea, [contenteditable="true"]')) {
        setHoverState('text');
      } else if (
        target.closest(
          '.chat-corner-handle, .feed-header, .is-window-dragging, .is-resizing, [data-draggable="true"]'
        )
      ) {
        setHoverState('drag');
      } else if (
        target.closest(
          'button, a, [role="button"], .clickable, .aura-card, .btn, .pill, summary, select, input[type="range"], .ambient-btn, [tabindex]:not([tabindex="-1"])'
        )
      ) {
        setHoverState('interactive');
      } else {
        setHoverState('default');
      }
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true, capture: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true, capture: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true, capture: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    // Spring Lerp Loop for Celestial Astrolabe Reticle
    const render = () => {
      const targetX = mousePos.current.x;
      const targetY = mousePos.current.y;

      const dx = targetX - reticlePos.current.x;
      const dy = targetY - reticlePos.current.y;

      reticlePos.current.x += dx * 0.28;
      reticlePos.current.y += dy * 0.28;

      if (reticleRef.current) {
        reticleRef.current.style.transform = `translate3d(${reticlePos.current.x}px, ${reticlePos.current.y}px, 0)`;
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameId.current);
      window.removeEventListener('pointermove', handlePointerMove, { capture: true });
      window.removeEventListener('mousedown', handleMouseDown, { capture: true });
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.documentElement.classList.remove('has-celestial-cursor');
    };
  }, [hoverState]);

  if (!enabled) return null;

  return (
    <div
      className={`celestial-astrolabe-container ${isVisible ? 'is-visible' : 'is-hidden'} state-${hoverState} ${
        isClicking ? 'is-clicking' : ''
      }`}
      aria-hidden="true"
    >
      {/* 1:1 Instant Focal Starlight Point */}
      <div ref={focalRef} className="astrolabe-focal" />

      {/* Concentric Astrolabe Rotating Body */}
      <div ref={reticleRef} className="astrolabe-reticle">
        <svg
          viewBox="0 0 48 48"
          className="astrolabe-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer Graduated Astrolabe Ring */}
          <circle cx="24" cy="24" r="16.5" className="astrolabe-outer-ring" />

          {/* Inner Celestial Gauge Ring */}
          <circle cx="24" cy="24" r="8.5" className="astrolabe-inner-ring" />

          {/* 4 Cardinal Spikes (North, South, East, West) */}
          <g className="astrolabe-spikes">
            <line x1="24" y1="2" x2="24" y2="10" />
            <line x1="24" y1="38" x2="24" y2="46" />
            <line x1="2" y1="24" x2="10" y2="24" />
            <line x1="38" y1="24" x2="46" y2="24" />
          </g>

          {/* 45° Diagonal Astrolabe Starlight Ticks */}
          <g className="astrolabe-diagonal-ticks">
            <circle cx="12.3" cy="12.3" r="1.3" />
            <circle cx="35.7" cy="12.3" r="1.3" />
            <circle cx="12.3" cy="35.7" r="1.3" />
            <circle cx="35.7" cy="35.7" r="1.3" />
          </g>

          {/* Central 4-Point Starlight Diamond */}
          <polygon
            points="24,19 25.5,22.5 29,24 25.5,25.5 24,29 22.5,25.5 19,24 22.5,22.5"
            className="astrolabe-diamond"
          />
        </svg>

        <div className="astrolabe-click-pulse" />
      </div>
    </div>
  );
}

