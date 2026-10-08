import React, { useEffect, useId, useMemo, useRef } from 'react';
import {
  buildGooBlobs,
  GOO_BALL,
  GOO_FALLBACK_STOPS,
  GOO_SIZE,
  GOO_TONES,
  GOO_TONE_STOPS,
  targetPlaybackRate,
  toneStops
} from '../services/gooOrb';
import './GooOrb.css';

// Gooey bubbles: soft circles are blurred together and the blur is cut back to a hard edge, so
// circles that get close melt into one another and pinch apart again. The SVG filter keeps colour and
// transparency, and the unblurred circles are composited back on top so every bubble keeps its own shading.
export default function GooOrb({ stateClass = 'idle', audioLevel = 0 }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const blobs = useMemo(buildGooBlobs, []);
  const rootRef = useRef(null);
  const rate = useRef({ current: 1, target: 1, frame: 0 });

  // Ease the playback rate of every running animation so state changes speed up or slow down smoothly
  // instead of making the bubbles jump to a new position.
  useEffect(() => {
    const state = rate.current;
    state.target = targetPlaybackRate(stateClass, audioLevel);
    const step = () => {
      state.frame = 0;
      const gap = state.target - state.current;
      state.current = Math.abs(gap) < 0.01 ? state.target : state.current + gap * 0.12;
      const root = rootRef.current;
      if (root && typeof root.getAnimations === 'function') {
        for (const animation of root.getAnimations({ subtree: true })) {
          if (typeof animation.updatePlaybackRate === 'function') animation.updatePlaybackRate(state.current);
        }
      }
      if (state.current !== state.target) state.frame = requestAnimationFrame(step);
    };
    if (!state.frame) state.frame = requestAnimationFrame(step);
  }, [stateClass, audioLevel]);

  useEffect(() => () => cancelAnimationFrame(rate.current.frame), []);

  // Stop animating while the orb is scrolled out of view (the landing page has it far down the page).
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      root.classList.toggle('is-offscreen', !entry.isIntersecting);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const gooId = `goo-${uid}`;
  const renderBlob = (blob) => (
    <g
      key={blob.id}
      className="goo-orbit"
      style={{ transformOrigin: `${blob.ox}px ${blob.oy}px`, '--dur': `${blob.duration}s`, '--delay': `${blob.delay}s` }}
    >
      <g className="goo-counter" style={{ transformOrigin: `${blob.cx}px ${blob.cy}px` }}>
        <circle cx={blob.cx} cy={blob.cy} r={blob.r} fill={`url(#${gooId}-${blob.tone})`} />
        {blob.kind === 'sparkle' && <Glint cx={blob.cx} cy={blob.cy} r={blob.r} />}
      </g>
    </g>
  );
  const lumps = blobs.filter((blob) => blob.kind === 'blubb').map(renderBlob);
  const satellites = blobs.filter((blob) => blob.kind === 'sparkle').map(renderBlob);

  return (
    <svg
      ref={rootRef}
      className="goo-orb"
      viewBox={`0 0 ${GOO_SIZE} ${GOO_SIZE}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {Object.entries(GOO_TONES).map(([tone, colour]) => (
          <radialGradient key={tone} id={`${gooId}-${tone}`} cx="0.5" cy="0.5" r="0.62" fx="0.33" fy="0.27">
            {toneStops(colour).map((stop, index) => (
              <stop
                key={index}
                offset={GOO_TONE_STOPS[index]}
                stopColor={GOO_FALLBACK_STOPS[tone][index]}
                style={{ stopColor: stop }}
              />
            ))}
          </radialGradient>
        ))}
        <filter
          id={gooId}
          filterUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={GOO_SIZE}
          height={GOO_SIZE}
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
      {/* Lumps first, then the satellites, then the main ball on top: bubbles are hidden while inside the body
          and only show once they break away from it. */}
      <g filter={`url(#${gooId})`}>
        {lumps}
        {satellites}
        <g className="goo-body">
          <circle cx={GOO_BALL.cx} cy={GOO_BALL.cy} r={GOO_BALL.r} fill={`url(#${gooId}-a)`} />
          <Glint cx={GOO_BALL.cx} cy={GOO_BALL.cy} r={GOO_BALL.r} />
        </g>
      </g>
    </svg>
  );
}

// A small specular highlight, always in the upper left so every bubble looks lit from the same side.
function Glint({ cx, cy, r }) {
  const x = cx - r * 0.34;
  const y = cy - r * 0.4;
  return <ellipse cx={x} cy={y} rx={r * 0.3} ry={r * 0.17} transform={`rotate(-35 ${x} ${y})`} fill="#ffffff" opacity="0.85" />;
}
