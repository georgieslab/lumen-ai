import React from 'react';

/**
 * Lumen AI Official Brandmark & Emblem
 * Futuristic Apple visionOS inspired liquid glass neural aperture
 * Features multi-layered gyroscopic 360° rotation in opposite directions
 */
export default function LumenLogo({ size = 32, className = '', animated = true }) {
  return (
    <div 
      className={`lumen-logo-wrap ${animated ? 'is-animated' : ''} ${className}`}
      style={{ width: size, height: size }}
      title="Lumen AI — Ambient Neural Copilot"
      aria-label="Lumen AI Logo"
    >
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="lumen-logo-svg"
      >
        <defs>
          {/* Primary Celestial Gradient */}
          <linearGradient id="lumenGradientMain" x1="10%" y1="10%" x2="90%" y2="90%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>

          {/* Secondary Ring Gradient */}
          <linearGradient id="lumenGradientRing" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>

          {/* Inner Orbit Gradient */}
          <linearGradient id="lumenGradientOrbit" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          {/* Liquid Glass Highlight */}
          <linearGradient id="lumenGlassSpecular" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
          </linearGradient>

          {/* Core Radiance Radial */}
          <radialGradient id="lumenCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#38bdf8" />
            <stop offset="70%" stopColor="#8b5cf6" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
          </radialGradient>

          {/* Deep Ambient Glow Filter */}
          <filter id="lumenGlowFilter" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Layer 0: Ambient Breathing Nebula Aura */}
        <circle 
          cx="50" 
          cy="50" 
          r="44" 
          fill="url(#lumenGradientMain)" 
          opacity="0.18" 
          className="logo-ambient-aura"
        />

        {/* Layer 1: Outer Orbital Segmented Ring (Rotates 360° Clockwise) */}
        <g className="logo-layer-outer-clockwise">
          <circle 
            cx="50" 
            cy="50" 
            r="41" 
            stroke="url(#lumenGradientRing)" 
            strokeWidth="2.2" 
            strokeDasharray="160 14 30 14" 
            strokeLinecap="round" 
            opacity="0.75"
            className="logo-outer-ring"
          />
          {/* Orbital Micro Satellite Nodes */}
          <circle cx="50" cy="9" r="2.2" fill="#38bdf8" opacity="0.95" />
          <circle cx="50" cy="91" r="1.8" fill="#ec4899" opacity="0.85" />
        </g>

        {/* Layer 2: Middle Prismatic Aperture & Neural Cross (Rotates 360° Counter-Clockwise) */}
        <g className="logo-layer-middle-counter" filter="url(#lumenGlowFilter)">
          <path
            d="M50 16 C68.78 16 84 31.22 84 50 C84 68.78 68.78 84 50 84 C31.22 84 16 68.78 16 50 C16 31.22 31.22 16 50 16 Z"
            stroke="url(#lumenGradientMain)"
            strokeWidth="3.2"
            fill="none"
            opacity="0.9"
            className="logo-mid-lens"
          />

          {/* Diagonal Ray Cross Apertures (Neural Nodes) */}
          <line x1="28" y1="28" x2="38" y2="38" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
          <line x1="72" y1="72" x2="62" y2="62" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
          <line x1="72" y1="28" x2="62" y2="38" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
          <line x1="28" y1="72" x2="38" y2="62" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />

          {/* Cardinal Micro Nodes */}
          <circle cx="50" cy="18" r="1.8" fill="#38bdf8" />
          <circle cx="82" cy="50" r="1.8" fill="#818cf8" />
          <circle cx="50" cy="82" r="1.8" fill="#ec4899" />
          <circle cx="18" cy="50" r="1.8" fill="#06b6d4" />
        </g>

        {/* Layer 3: Inner Liquid Glass Shell & Orbit (Rotates 360° Clockwise) */}
        <g className="logo-layer-inner-clockwise">
          <circle 
            cx="50" 
            cy="50" 
            r="26" 
            fill="#0c1222" 
            fillOpacity="0.88"
            stroke="url(#lumenGradientOrbit)" 
            strokeWidth="1.8" 
            strokeDasharray="60 12"
            strokeLinecap="round"
            className="logo-inner-shell"
          />
          <circle cx="50" cy="24" r="1.5" fill="#ffffff" opacity="0.9" />
          <circle cx="50" cy="76" r="1.5" fill="#38bdf8" opacity="0.85" />
        </g>

        {/* Layer 4: Glowing Neural Singularity Core */}
        <circle 
          cx="50" 
          cy="50" 
          r="16" 
          fill="url(#lumenCoreGlow)" 
          className="logo-inner-core"
        />

        {/* Layer 5: Specular Crescent Glint (Curved Glass Highlight - Rotates Counter-Clockwise) */}
        <g className="logo-layer-glint-counter">
          <path 
            d="M28 32 C34 23 44 20 56 21 C46 24 37 30 33 40 C30 36 29 34 28 32 Z" 
            fill="url(#lumenGlassSpecular)" 
            className="logo-specular-glint"
          />
        </g>

        {/* Layer 6: Ultra-Bright Center Core Singularity Dot */}
        <circle 
          cx="50" 
          cy="50" 
          r="4.5" 
          fill="#ffffff" 
          className="logo-bright-spark"
        />
      </svg>
    </div>
  );
}
