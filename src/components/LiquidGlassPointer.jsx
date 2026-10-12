import React, { useEffect, useRef, useState } from 'react';
import './LiquidGlassPointer.css';

/**
 * Liquid Glass Meniscus (Refractive Floating Glass Lens Pointer)
 * Features:
 * - 1:1 Instant Focal Pinpoint (Zero perception of click lag)
 * - Trailing Refractive Liquid Glass Meniscus Lens with spring lerp
 * - Dynamic velocity surface tension elongation & squish
 * - Morphic states: Interactive Hover, Text Input, Window Drag, Elastic Click
 * - Automatically disabled on touchscreens and mobile devices
 */
export default function LiquidGlassPointer() {
  const meniscusRef = useRef(null);
  const dotRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [hoverState, setHoverState] = useState('default');
  const [isClicking, setIsClicking] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const mousePos = useRef({ x: -100, y: -100 });
  const lensPos = useRef({ x: -100, y: -100 });
  const animFrameId = useRef(0);

  useEffect(() => {
    // Only enable on devices with fine pointer (mouse / trackpad)
    const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (isTouch) {
      setEnabled(false);
      return;
    }

    setEnabled(true);
    document.body.classList.add('has-custom-cursor');

    const handleMouseMove = (e) => {
      mousePos.current.x = e.clientX;
      mousePos.current.y = e.clientY;
      setIsVisible(true);

      // Instant 1:1 Focal Pinpoint
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }

      // Check context under cursor
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
          'button, a, [role="button"], .clickable, .aura-card, .btn, .pill, summary, select, input[type="range"]'
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

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    // Physics Animation Loop: Spring Lerp + Droplet Deformation
    const render = () => {
      const targetX = mousePos.current.x;
      const targetY = mousePos.current.y;

      const dx = targetX - lensPos.current.x;
      const dy = targetY - lensPos.current.y;

      // Smooth fluid lerp
      lensPos.current.x += dx * 0.22;
      lensPos.current.y += dy * 0.22;

      if (meniscusRef.current) {
        const dist = Math.hypot(dx, dy);
        let angle = 0;
        let stretch = 1;
        let squish = 1;

        // Dynamic surface tension elongation when moving
        if (dist > 1.5 && hoverState === 'default') {
          angle = Math.atan2(dy, dx);
          stretch = Math.min(1.32, 1 + dist * 0.0035);
          squish = 1 / Math.sqrt(stretch);
        }

        const x = lensPos.current.x;
        const y = lensPos.current.y;

        if (stretch > 1.02) {
          meniscusRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}rad) scale(${stretch}, ${squish})`;
        } else {
          meniscusRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        }
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameId.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.body.classList.remove('has-custom-cursor');
    };
  }, [hoverState]);

  if (!enabled) return null;

  return (
    <div
      className={`liquid-pointer-container ${isVisible ? 'is-visible' : 'is-hidden'} state-${hoverState} ${
        isClicking ? 'is-clicking' : ''
      }`}
      aria-hidden="true"
    >
      {/* Precision Photon Focal Pinpoint */}
      <div ref={dotRef} className="liquid-pointer-dot" />

      {/* Floating Refractive Liquid Glass Meniscus */}
      <div ref={meniscusRef} className="liquid-pointer-meniscus">
        <div className="meniscus-sheen" />
        <div className="meniscus-chromatic-ring" />
      </div>
    </div>
  );
}

