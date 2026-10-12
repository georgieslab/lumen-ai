/* ==========================================================================
   Lumen AI — Aura Preset System
   8 pre-created ambient lighting mood presets
   ========================================================================== */

export const PRESET_AURAS = [
  {
    id: 'midnight-nebula',
    name: 'Midnight Nebula',
    icon: '🌌',
    description: 'Deep cosmic dark with violet & indigo swirls',
    colors: ['#0f0a2e', '#1e1b4b', '#312e81'],
    accent: '#818cf8',
    atmosphere: 'night',
  },
  {
    id: 'aurora-borealis',
    name: 'Aurora Borealis',
    icon: '🌈',
    description: 'Ethereal northern lights with teal & emerald',
    colors: ['#042f2e', '#064e3b', '#0d9488'],
    accent: '#2dd4bf',
    atmosphere: 'evening',
  },
  {
    id: 'solar-flare',
    name: 'Solar Flare',
    icon: '☀️',
    description: 'Warm golden dawn with amber radiance',
    colors: ['#431407', '#7c2d12', '#ea580c'],
    accent: '#fb923c',
    atmosphere: 'morning',
  },
  {
    id: 'ocean-depths',
    name: 'Ocean Depths',
    icon: '🌊',
    description: 'Deep marine blue with cyan bioluminescence',
    colors: ['#0c1445', '#1e3a5f', '#0369a1'],
    accent: '#38bdf8',
    atmosphere: 'day',
  },
  {
    id: 'rose-quartz',
    name: 'Rose Quartz',
    icon: '🌸',
    description: 'Soft blush pink with gentle magenta shimmer',
    colors: ['#2e0a1e', '#4a1942', '#be185d'],
    accent: '#f472b6',
    atmosphere: 'evening',
  },
  {
    id: 'arctic-frost',
    name: 'Arctic Frost',
    icon: '❄️',
    description: 'Ice-cold silver blue with crystalline whites',
    colors: ['#0f172a', '#1e293b', '#475569'],
    accent: '#94a3b8',
    atmosphere: 'night',
  },
  {
    id: 'volcanic-ember',
    name: 'Volcanic Ember',
    icon: '🔥',
    description: 'Smoldering crimson with deep molten amber',
    colors: ['#1c0404', '#450a0a', '#dc2626'],
    accent: '#ef4444',
    atmosphere: 'night',
  },
  {
    id: 'zen-garden',
    name: 'Zen Garden',
    icon: '🍃',
    description: 'Calm verdant green with mossy earth tones',
    colors: ['#052e16', '#14532d', '#16a34a'],
    accent: '#4ade80',
    atmosphere: 'day',
  },
];

/**
 * Look up an aura by its ID. Falls back to the first preset.
 * @param {string} id
 * @returns {object}
 */
export function getAuraById(id) {
  return PRESET_AURAS.find((a) => a.id === id) || PRESET_AURAS[0];
}

/**
 * Return the ID of the next aura in the cycle.
 * @param {string} currentId
 * @returns {string}
 */
export function getNextAuraId(currentId) {
  const idx = PRESET_AURAS.findIndex((a) => a.id === currentId);
  const nextIdx = (idx + 1) % PRESET_AURAS.length;
  return PRESET_AURAS[nextIdx].id;
}
