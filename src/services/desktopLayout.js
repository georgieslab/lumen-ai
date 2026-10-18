export const DESKTOP_LAYOUT_KEY = 'lumen_desktop_visibility_v1';
export const DESKTOP_ITEMS = [
  { id: 'day', label: 'Plan my day', defaultVisible: true },
  { id: 'decision', label: 'Decision desk', defaultVisible: true },
  { id: 'verify', label: 'Verify this', defaultVisible: true },
  { id: 'watches', label: 'Watch this', defaultVisible: true },
  { id: 'projects', label: 'Project spaces', defaultVisible: true },
  { id: 'code-analysis', label: 'Code analysis', defaultVisible: false },
  { id: 'seo-analysis', label: 'SEO analysis', defaultVisible: false },
  { id: 'daily-brief', label: 'Daily brief', defaultVisible: false },
  { id: 'budget-planner', label: 'Budget planner', defaultVisible: false },
  { id: 'day-schedule', label: 'Day schedule', defaultVisible: false },
  { id: 'open-web-page', label: 'Open web page', defaultVisible: false },
  { id: 'persona', label: 'Persona card', defaultVisible: true },
  { id: 'weather', label: 'Live weather', defaultVisible: true }
];

export function normalizeDesktopVisibility(value) {
  return Object.fromEntries(DESKTOP_ITEMS.map(item => [item.id,
    typeof value?.[item.id] === 'boolean' ? value[item.id] : item.defaultVisible]));
}
export function loadDesktopVisibility(storage = globalThis.localStorage) {
  try { return normalizeDesktopVisibility(JSON.parse(storage.getItem(DESKTOP_LAYOUT_KEY))); }
  catch { return normalizeDesktopVisibility(null); }
}
export function saveDesktopVisibility(value, storage = globalThis.localStorage) {
  const normalized = normalizeDesktopVisibility(value);
  try { storage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify(normalized)); } catch {}
  return normalized;
}
export function clearDesktopPositions(storage = globalThis.localStorage) {
  for (const item of DESKTOP_ITEMS) {
    try { storage.removeItem(`lumen_desktop_pill_${item.id}`); } catch {}
  }
  for (const key of ['lumen_persona_card_position', 'lumen_weather_tile_position']) {
    try { storage.removeItem(key); } catch {}
  }
}

export function desktopPillPosition(index, count) {
  const side = index % 2;
  const row = Math.floor(index / 2);
  const rows = Math.ceil((count - side) / 2);
  return { left: side ? '79%' : '21%', top: `${rows <= 3 ? 18 + row * 21 : 10 + row * 72 / (rows - 1)}%` };
}
