// Colours shown on the paint dots of the Visual theme button, one set per theme in App.css.
export const THEME_SWATCHES = {
  visionos: ['#38bdf8', '#8b5cf6', '#ec4899', '#67e8f9'],
  cyberpunk: ['#00fff2', '#ff007f', '#9d00ff', '#fcee09'],
  obsidian: ['#f1f5f9', '#94a3b8', '#64748b', '#334155'],
  solardawn: ['#f59e0b', '#f97316', '#f43f5e', '#fde68a'],
  highcontrast: ['#ffffff', '#ffff00', '#00ffff', '#000000']
};

export const THEME_IDS = Object.keys(THEME_SWATCHES);

export const ATMOSPHERE_PHASES = ['morning', 'day', 'evening', 'night'];

export function swatchesFor(themeId) {
  return THEME_SWATCHES[themeId] || THEME_SWATCHES.visionos;
}

// The atmosphere setting is either 'auto' (follow the clock) or a fixed phase; the icon always shows a phase.
export function atmospherePhase(setting, clockPhase) {
  const phase = setting === 'auto' ? clockPhase : setting;
  return ATMOSPHERE_PHASES.includes(phase) ? phase : 'day';
}

export function isAutoAtmosphere(setting) {
  return setting === 'auto';
}
