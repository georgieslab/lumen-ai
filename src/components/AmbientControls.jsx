import React, { useEffect, useId, useRef, useState } from 'react';
import { swatchesFor } from '../services/ambience';
import './AmbientControls.css';

const RAYS = Array.from({ length: 8 }, (_, index) => index * 45);
const SPARKS = [
  { x: 8.4, y: 8.2, r: 0.9, delay: '0s' },
  { x: 24.2, y: 6.6, r: 0.7, delay: '0.8s' },
  { x: 23, y: 15.6, r: 0.8, delay: '1.6s' }
];
const PAINT_SPOTS = [
  { x: 9.4, y: 14.2 },
  { x: 12.8, y: 8.6 },
  { x: 19.4, y: 8 },
  { x: 24.2, y: 11.8 }
];
// Palette outline with a thumb hole (even-odd), drawn for a 32x32 box.
const PALETTE_PATH =
  'M16 3.2C8.9 3.2 3.4 8.6 3.4 15.3c0 6.6 5.3 12.1 12.2 12.1 1.9 0 3.1-1.1 3.1-2.6 0-.9-.4-1.5-.9-2.1-.4-.5-.8-1.1-.8-1.9 0-1.5 1.2-2.6 2.8-2.6h3.2c3.3 0 5.7-2.5 5.7-5.7C28.7 8 23 3.2 16 3.2z' +
  'M12.6 19.3a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 1 0 0-3.8z';

// A sun that rises, shines, sets and gives way to a moon over a horizon: the same picture in every phase,
// so changing the atmosphere slides the sun or moon into place instead of swapping icons.
function AtmosphereIcon({ phase, auto }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const skyClip = `atmo-sky-${uid}`;
  const moonMask = `atmo-moon-${uid}`;
  const glow = `atmo-glow-${uid}`;
  return (
    <svg className={`atmo-icon phase-${phase}${auto ? ' is-auto' : ''}`} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={skyClip}>
          <rect x="0" y="0" width="32" height="22.4" />
        </clipPath>
        <mask id={moonMask}>
          <rect x="0" y="0" width="32" height="32" fill="#fff" />
          <circle cx="19.6" cy="8.6" r="5.1" fill="#000" />
        </mask>
        <radialGradient id={glow}>
          <stop offset="0" style={{ stopColor: 'var(--sun)', stopOpacity: 0.95 }} />
          <stop offset="1" style={{ stopColor: 'var(--sun)', stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <circle className="atmo-ring" cx="16" cy="16" r="14.6" />
      <ellipse className="atmo-glow" cx="16" cy="22.2" rx="10.5" ry="4.4" fill={`url(#${glow})`} />
      <g clipPath={`url(#${skyClip})`}>
        <g className="atmo-sun">
          <g className="atmo-rays">
            {RAYS.map((angle) => (
              <path key={angle} d="M16 2.4v2.4" transform={`rotate(${angle} 16 12)`} />
            ))}
          </g>
          <circle className="atmo-sun-disc" cx="16" cy="12" r="4.7" />
          <circle className="atmo-sun-shine" cx="14.4" cy="10.4" r="1.5" />
        </g>
      </g>
      <g className="atmo-moon">
        <circle cx="16" cy="11" r="6.2" mask={`url(#${moonMask})`} />
      </g>
      {SPARKS.map((spark) => (
        <circle
          key={spark.x}
          className="atmo-star"
          cx={spark.x}
          cy={spark.y}
          r={spark.r}
          style={{ animationDelay: spark.delay }}
        />
      ))}
      <path className="atmo-horizon" d="M5 22.6H27" />
      <path className="atmo-water" d="M9.5 25.6H22.5M12.5 28.4H19.5" />
    </svg>
  );
}

// An artist's palette whose paint dots take the colours of the active theme.
function ThemeIcon({ themeId }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const clip = `palette-clip-${uid}`;
  const colours = swatchesFor(themeId);
  const style = Object.fromEntries(colours.map((colour, index) => [`--c${index + 1}`, colour]));
  return (
    <svg className="palette-icon" viewBox="0 0 32 32" style={style} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clip}>
          <path d={PALETTE_PATH} clipRule="evenodd" />
        </clipPath>
      </defs>
      <path className="palette-body" d={PALETTE_PATH} fillRule="evenodd" />
      <g clipPath={`url(#${clip})`}>
        <rect className="palette-sweep" x="-8" y="0" width="7" height="32" />
      </g>
      <g key={themeId} className="palette-paints">
        {PAINT_SPOTS.map((spot, index) => (
          <circle
            key={index}
            className={`paint paint-${index + 1}`}
            cx={spot.x}
            cy={spot.y}
            r="2.2"
            style={{ '--d': `${index * 0.09}s` }}
          />
        ))}
      </g>
    </svg>
  );
}

// Two small icon-only controls for the top bar. They carry no text: the pictures say what they are, one
// tooltip under the pair names the button you hover or focus, and tapping flashes the new setting for a
// moment (touch screens have no hover).
export default function AmbientControls({
  phase,
  auto,
  atmosphereTip,
  themeId,
  themeTip,
  groupLabel,
  onCycleAtmosphere,
  onCycleTheme
}) {
  const [hover, setHover] = useState(null);
  const [flash, setFlash] = useState(null);
  const timer = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const press = (kind, action) => {
    action();
    clearTimeout(timer.current);
    setFlash({ kind, id: Date.now() });
    timer.current = setTimeout(() => setFlash(null), 1900);
  };

  const tipFor = (kind) => (kind === 'atmosphere' ? atmosphereTip : themeTip);
  const hoverProps = (kind) => ({
    onPointerEnter: (event) => event.pointerType === 'mouse' && setHover(kind),
    onPointerLeave: () => setHover(null),
    onFocus: (event) => event.currentTarget.matches(':focus-visible') && setHover(kind),
    onBlur: () => setHover(null)
  });

  const shown = flash ? flash.kind : hover;

  return (
    <div className="ambient-bar" role="group" aria-label={groupLabel}>
      <button
        type="button"
        className={`ambient-btn atmosphere-btn phase-${phase}`}
        onClick={() => press('atmosphere', onCycleAtmosphere)}
        aria-label={atmosphereTip}
        {...hoverProps('atmosphere')}
      >
        <AtmosphereIcon phase={phase} auto={auto} />
      </button>
      <button
        type="button"
        className="ambient-btn theme-btn"
        style={{ '--ambient-accent': swatchesFor(themeId)[0] }}
        onClick={() => press('theme', onCycleTheme)}
        aria-label={themeTip}
        {...hoverProps('theme')}
      >
        <ThemeIcon themeId={themeId} />
      </button>
      {shown && (
        <span
          key={flash ? flash.id : shown}
          className={`ambient-tip${flash ? ' is-flash' : ''}`}
          role={flash ? 'status' : undefined}
          aria-hidden={flash ? undefined : true}
        >
          {tipFor(shown)}
        </span>
      )}
    </div>
  );
}