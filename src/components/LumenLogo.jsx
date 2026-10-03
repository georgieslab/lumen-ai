import React from 'react';

/**
 * Lumen AI Official Brandmark & Emblem
 * Futuristic Apple visionOS inspired liquid glass neural aperture
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

          {/* Liquid Glass Highlight */}
          <linearGradient id="lumenGlassSpecular" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
          </linearGradient>

          {/* Core Radiance Radial */}
          <radialGradient id="lumenCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#38bdf8" />
            <stop offset="70%" stopColor="#8b5cf6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
          </radialGradient>

          {/* Deep Ambient Glow Filter */}
          <filter id="lumenGlowFilter" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Radiant Ambient Aura */}
        <circle 
          cx="50" 
          cy="50" 
          r="42" 
          fill="url(#lumenGradientMain)" 
          opacity="0.18" 
          className="logo-ambient-aura"
        />

        {/* Outer Orbital Glass Ring */}
        <circle 
          cx="50" 
          cy="50" 
          r="40" 
          stroke="url(#lumenGradientRing)" 
          strokeWidth="2.5" 
          strokeDasharray="180 8" 
          strokeLinecap="round" 
          opacity="0.6"
          className="logo-outer-ring"
        />

        {/* Middle Prismatic Aperture Segments */}
        <g className="logo-aperture-group" filter="url(#lumenGlowFilter)">
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
        </g>

        {/* Inner Liquid Glass Shell */}
        <circle 
          cx="50" 
          cy="50" 
          r="26" 
          fill="#0c1222" 
          fillOpacity="0.85"
          stroke="url(#lumenGradientMain)" 
          strokeWidth="1.8" 
        />

        {/* Glowing Neural Singularity Core */}
        <circle 
          cx="50" 
          cy="50" 
          r="16" 
          fill="url(#lumenCoreGlow)" 
          className="logo-inner-core"
        />

        {/* Specular Crescent Glint (Curved Glass Highlight) */}
        <path 
          d="M28 32 C34 23 44 20 56 21 C46 24 37 30 33 40 C30 36 29 34 28 32 Z" 
          fill="url(#lumenGlassSpecular)" 
          className="logo-specular-glint"
        />

        {/* Ultra-Bright Center Core Dot */}
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
