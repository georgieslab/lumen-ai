// State for a task Lumen is carrying out: a short list of steps, each pending, active or finished.
// Everything here is pure (no React, no network) so it can be tested on its own.

export const RESEARCH_STEPS = ['search', 'reading', 'synthesis', 'pdf'];
export const PAGE_STEPS = ['brief', 'build'];
const MAX_TOOL_STEPS = 8;

const clip = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function hostOf(url) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, '');
  } catch (_) {
    return clip(url, 40);
  }
}

export function isAbortError(error) {
  return Boolean(error) && error.name === 'AbortError';
}

// The topic of a research request, without the "research ..." lead-in or the "... as a PDF" tail.
export function researchTopic(prompt) {
  const topic = String(prompt || '')
    .replace(/^(please\s+)?(research|investigate|look\s+up|find\s+out\s+about)\s+/i, '')
    .replace(/\s+(and\s+)?(make|create|provide|give\s+me|compile)\s+(a\s+)?(pdf|report|briefing|dossier)\b[\s\S]*$/i, '')
    .replace(/^(?:a\s+topic\s+and\s+)?(?:provide|make|create|give\s+me|compile)\s+(?:me\s+)?(?:a\s+)?(?:sourced\s+)?(?:pdf\s+)?(?:report|briefing|dossier)?\s*(?:about|on)\s+/i, '')
    .trim();
  return clip(topic || prompt, 90);
}

export function createMission({ kind, title = '', now = Date.now() }) {
  // A page build starts with its brief already approved and the page being written.
  const steps = kind === 'research'
    ? RESEARCH_STEPS.map((id, index) => ({ id, kind: 'stage', state: index === 0 ? 'active' : 'pending', meta: {} }))
    : kind === 'page'
      ? PAGE_STEPS.map((id, index) => ({ id, kind: 'stage', state: index === 0 ? 'done' : 'active', meta: {} }))
      : [];
  return { id: `mission-${now}`, kind, title: clip(title, 90), status: 'running', startedAt: now, endedAt: null, progress: 0, steps };
}

// A progress event from the research stream: { stage, message, progress, sources?, pagesRead? }.
export function applyProgress(mission, event) {
  if (!mission || mission.status !== 'running') return mission;
  const index = mission.steps.findIndex((step) => step.id === event?.stage);
  if (index < 0) return mission;
  const meta = {};
  if (Number.isFinite(event.sources)) meta.sources = event.sources;
  if (Number.isFinite(event.pagesRead)) meta.pagesRead = event.pagesRead;
  if (Number.isFinite(event.searchesCompleted)) meta.searchesCompleted = event.searchesCompleted;
  if (Number.isFinite(event.searchesTotal)) meta.searchesTotal = event.searchesTotal;
  if (Number.isFinite(event.searchesFailed)) meta.searchesFailed = event.searchesFailed;
  if (Number.isFinite(event.pagesFailed)) meta.pagesFailed = event.pagesFailed;
  const steps = mission.steps.map((step, i) => {
    if (i < index) return { ...step, state: 'done' };
    if (i === index) return { ...step, state: 'active', meta: { ...step.meta, ...meta } };
    return { ...step, state: 'pending' };
  });
  const progress = Math.max(0, Math.min(100, Number(event.progress) || 0));
  return { ...mission, steps, progress: Math.max(mission.progress, progress) };
}

export function summarizeToolInput(name, input) {
  const args = input && typeof input === 'object' ? input : {};
  switch (name) {
    case 'live_web_search':
      return { query: clip(args.query, 80) };
    case 'browse_web_page':
    case 'call_direct_api':
      return { host: hostOf(args.url) };
    case 'get_live_weather':
      return { city: clip(args.city || args.location, 60) };
    case 'get_crypto_and_market_prices':
      return { asset: clip(args.asset || args.symbol || args.coin, 40) };
    case 'create_pdf_document':
      return { title: clip(args.title, 80) };
    default:
      return { name: clip(name, 40) };
  }
}

// A tool_start event from the chat stream starts the next step (and the mission, if none is running yet).
export function applyToolStart(mission, event, now = Date.now()) {
  const base = mission || createMission({ kind: 'chat', now });
  if (base.status !== 'running') return base;
  const closed = base.steps.map((step) => (step.state === 'active' ? { ...step, state: 'done' } : step));
  const count = closed.filter((step) => step.kind === 'tool').length + 1;
  const step = {
    id: `tool-${count}`,
    kind: 'tool',
    tool: clip(event?.name, 60),
    params: summarizeToolInput(event?.name, event?.input),
    state: 'active',
    meta: {}
  };
  return { ...base, steps: [...closed, step].slice(-MAX_TOOL_STEPS) };
}

// The answer has started to stream: whatever tool was running has finished.
export function markWriting(mission) {
  // Streaming words are the page itself being written, so its step stays active until the reply ends.
  if (!mission || mission.kind === 'page' || mission.status !== 'running' || !mission.steps.some((step) => step.state === 'active')) return mission;
  return { ...mission, steps: mission.steps.map((step) => (step.state === 'active' ? { ...step, state: 'done' } : step)) };
}

export function finishMission(mission, { status = 'done', now = Date.now() } = {}) {
  if (!mission) return mission;
  const steps = mission.steps.map((step) => {
    if (status === 'done') return { ...step, state: 'done' };
    if (step.state === 'active') return { ...step, state: status === 'stopped' ? 'stopped' : 'failed' };
    if (step.state === 'pending') return { ...step, state: 'skipped' };
    return step;
  });
  return { ...mission, status, steps, endedAt: now, progress: status === 'done' ? 100 : mission.progress };
}

// The small record kept with a finished reply so "how Lumen did this" survives a reload.
export function missionActivity(mission) {
  if (!mission || mission.steps.length === 0) return null;
  return {
    kind: mission.kind,
    status: mission.status,
    durationMs: Math.max(0, (mission.endedAt || mission.startedAt) - mission.startedAt),
    steps: mission.steps.map(({ id, kind, tool, params, state, meta }) => ({ id, kind, tool, params, state, meta }))
  };
}

// For answers that arrived without live events (the non-streaming fallback): the tools the server reports.
export function activityFromTools(toolsUsed, durationMs = 0) {
  const tools = Array.isArray(toolsUsed) ? toolsUsed.filter((tool) => tool && tool.name) : [];
  if (tools.length === 0) return null;
  return {
    kind: 'chat',
    status: 'done',
    durationMs,
    steps: tools.slice(0, MAX_TOOL_STEPS).map((tool, index) => ({
      id: `tool-${index + 1}`,
      kind: 'tool',
      tool: clip(tool.name, 60),
      params: summarizeToolInput(tool.name, tool.input),
      state: 'done',
      meta: {}
    }))
  };
}

// m:ss for the timer on the card.
export function elapsedLabel(startedAt, endedAt, now = Date.now()) {
  const seconds = Math.max(0, Math.floor(((endedAt || now) - startedAt) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
