import { createHash, randomUUID } from 'node:crypto';
import { WATCH_INTERVALS, WATCH_TEXT_LIMIT, isWatchId, publicWatchUrl, watchError } from './watchStore.js';

const clone = value => structuredClone(value);
const normalize = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
const iso = value => new Date(value).toISOString();
const deferred = () => { let resolve; const done = new Promise(finish => { resolve = finish; }); return { done, resolve }; };
function observationSnapshot(observation) {
  if (!observation || typeof observation.text !== 'string') throw new Error('The source did not return readable content.');
  const text = normalize(observation.text).slice(0, WATCH_TEXT_LIMIT);
  if (!text) throw new Error('The source returned no readable content. Saved results were kept.');
  const sources = (Array.isArray(observation.sources) ? observation.sources : []).filter(source => publicWatchUrl(source?.url)).slice(0, 8)
    .map(source => ({ title: normalize(source.title || source.url).slice(0, 200), url: publicWatchUrl(source.url) }));
  return { text, hash: createHash('sha256').update(text).digest('hex'), title: normalize(observation.title).slice(0, 200),
    url: publicWatchUrl(observation.url) || sources[0]?.url || '', sources };
}
function changedExcerpts(before, after) {
  let prefix = 0;
  while (prefix < Math.min(before.length, after.length) && before[prefix] === after[prefix]) prefix++;
  const start = Math.max(0, prefix - 100);
  return { before: before.slice(start, start + 600), after: after.slice(start, start + 600) };
}
export function watchSnapshot(watch, { checking = false, error } = {}) {
  return { id: watch.id, kind: watch.kind, target: watch.target, title: watch.title, intervalMs: watch.intervalMs,
    status: watch.status, createdAt: watch.createdAt, updatedAt: watch.updatedAt, revision: watch.revision,
    checking, baselineReady: !!watch.baseline, lastCheckedAt: watch.lastCheckedAt, nextCheckAt: watch.nextCheckAt,
    lastChangedAt: watch.lastChangedAt, error: error || watch.error, latestChange: clone(watch.latestChange),
    notificationChannel: 'in_app', runsWhileServerOnline: true };
}

/** Persisted timers are checked only while this process is running. No model calls. */
export function createWatchManager({ store, observe, now = Date.now, pollIntervalMs = 30000, maxConcurrent = 2, observationTimeoutMs = 60000 } = {}) {
  if (!store || typeof observe !== 'function') throw new TypeError('A watch store and observe function are required.');
  const active = new Map();
  const queued = new Map();
  const commands = new Map();
  const runtimeErrors = new Map();
  let closing = false;
  let draining = false;
  let timer;
  let ready;
  const snapshot = watch => watchSnapshot(watch, { checking: active.has(watch.id) || queued.has(watch.id), error: runtimeErrors.get(watch.id) });
  const owned = async (id, ownerId) => {
    await ready;
    const watch = await store.get(id, ownerId);
    if (!watch) throw watchError('Watch not found.', 404);
    return watch;
  };
  async function command(id, ownerId, operation) {
    const previous = commands.get(id) || Promise.resolve();
    const pending = previous.catch(() => {}).then(async () => operation(await owned(id, ownerId)));
    commands.set(id, pending);
    try { return await pending; }
    finally { if (commands.get(id) === pending) commands.delete(id); }
  }
  const enqueue = (watch, manual = false) => {
    let job = active.get(watch.id) || queued.get(watch.id);
    if (!job) { job = { id: watch.id, ownerId: watch.ownerId, manual, ...deferred(), controller: new AbortController(), intent: null }; queued.set(watch.id, job); }
    return job;
  };
  const save = async (id, ownerId, mutate) => {
    const result = await store.update(id, ownerId, mutate);
    runtimeErrors.delete(id);
    return result;
  };
  async function run(job) {
    let deadline;
    let timedOut = false;
    try {
      const watch = await save(job.id, job.ownerId, draft => {
        if (draft.status === 'archived' || (!job.manual && draft.status !== 'active')) throw watchError('This watch is paused or archived.', 409);
        draft.inFlight = { startedAt: iso(now()), manual: job.manual };
        draft.requests = draft.requests.map(request => request.status === 'queued' ? { ...request, status: 'running' } : request);
        draft.nextCheckAt = draft.status === 'active' ? iso(now() + draft.intervalMs) : null;
      });
      if (observationTimeoutMs > 0) {
        deadline = setTimeout(() => { timedOut = true; job.controller.abort(); }, observationTimeoutMs);
        deadline.unref?.();
      }
      if (job.controller.signal.aborted) throw Object.assign(new Error('The check was stopped.'), { name: 'AbortError' });
      const observation = observationSnapshot(await observe(clone(watch), { signal: job.controller.signal }));
      if (job.controller.signal.aborted) throw Object.assign(new Error('The check was stopped.'), { name: 'AbortError' });
      await save(job.id, job.ownerId, (draft, notifications) => {
        if (draft.status === 'archived' || job.controller.signal.aborted) throw Object.assign(new Error('The check was stopped.'), { name: 'AbortError' });
        const timestamp = iso(now());
        if (draft.baseline && draft.baseline.hash !== observation.hash) {
          const change = { id: randomUUID(), observedAt: timestamp, summary: `${draft.title} changed.`.slice(0, 300),
            ...changedExcerpts(draft.baseline.text, observation.text), title: observation.title, url: observation.url, sources: observation.sources };
          draft.latestChange = change; draft.lastChangedAt = timestamp;
          notifications.push({ id: change.id, kind: 'watch_change', channel: 'in_app', watchId: draft.id, watchTitle: draft.title,
            createdAt: timestamp, readAt: null, summary: change.summary, before: change.before, after: change.after, url: change.url, sources: change.sources });
        }
        draft.baseline = observation; draft.lastCheckedAt = timestamp; draft.inFlight = null;
        draft.failureCount = 0; draft.error = null;
        draft.nextCheckAt = draft.status === 'active' ? iso(now() + draft.intervalMs) : null;
        draft.requests = draft.requests.map(request => ['queued', 'running'].includes(request.status) ? { ...request, status: 'done' } : request);
      });
    } catch (error) {
      try {
        await save(job.id, job.ownerId, draft => {
          const stopped = !!job.intent;
          draft.inFlight = null;
          draft.lastCheckedAt = iso(now());
          draft.error = stopped ? (job.intent === 'close' ? 'The server stopped during a check. Saved results were kept.' : null)
            : timedOut ? 'The source check timed out. Saved results were kept.' : normalize(error.message || 'The source could not be checked.').slice(0, 300);
          if (!stopped) draft.failureCount = Math.min(10, draft.failureCount + 1);
          const delay = Math.min(86400000, draft.intervalMs * 2 ** draft.failureCount);
          draft.nextCheckAt = draft.status === 'active' ? iso(now() + delay) : null;
          draft.requests = draft.requests.map(request => ['queued', 'running'].includes(request.status) ? { ...request, status: stopped ? 'interrupted' : 'failed' } : request);
        });
      } catch { runtimeErrors.set(job.id, 'Watch storage is unavailable. Saved results were kept.'); }
    } finally {
      if (deadline) clearTimeout(deadline);
      active.delete(job.id);
      job.resolve();
      if (!closing) void drain();
    }
  }
  async function drain() {
    if (closing || draining) return;
    draining = true;
    try {
      const watches = await store.all();
      if (closing) return;
      for (const watch of watches) {
        if (watch.status === 'active' && watch.nextCheckAt && Date.parse(watch.nextCheckAt) <= now()
          && !active.has(watch.id) && !queued.has(watch.id) && !commands.has(watch.id)) enqueue(watch);
      }
      for (const [id, job] of queued) {
        if (active.size >= maxConcurrent) break;
        if (commands.has(id)) continue;
        queued.delete(id); active.set(id, job); void run(job);
      }
    } finally { draining = false; }
  }
  ready = (async () => {
    await store.recover();
    if (pollIntervalMs > 0) { timer = setInterval(() => { void drain().catch(() => {}); }, pollIntervalMs); timer.unref?.(); }
    void drain().catch(() => {});
  })();
  async function stop(id, ownerId, status) {
    const ticket = await command(id, ownerId, async watch => {
      if (watch.status === 'archived') return {};
      await save(id, ownerId, draft => { draft.status = status; draft.nextCheckAt = null; });
      const pending = queued.get(id);
      if (pending) { queued.delete(id); pending.resolve(); }
      const job = active.get(id);
      if (job) { job.intent = status; job.controller.abort(); }
      return { done: job?.done };
    });
    await ticket.done;
    return snapshot(await owned(id, ownerId));
  }
  return {
    ready,
    async start() { await ready; await drain(); },
    async tick() { await ready; await drain(); },
    async idle() {
      await ready;
      while (true) {
        await drain();
        if (draining) { await new Promise(resolve => setImmediate(resolve)); continue; }
        const jobs = [...active.values(), ...queued.values()];
        if (!jobs.length) return;
        await Promise.all(jobs.map(job => job.done));
      }
    },
    async create(input) { await ready; if (closing) throw watchError('Watch scheduling is stopping.', 503); const watch = await store.create(input); void drain(); return snapshot(watch); },
    async get(id, ownerId) { return snapshot(await owned(id, ownerId)); },
    async list(ownerId) { await ready; return (await store.list(ownerId)).map(snapshot); },
    async update(id, ownerId, patch) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key => !['title', 'intervalMs', 'resetBaseline', 'status'].includes(key))) throw watchError('Only title, interval, baseline reset, or archive can be edited.');
      if (patch.status != null) { if (patch.status !== 'archived' || Object.keys(patch).length !== 1) throw watchError('Archive must be a separate change.'); return stop(id, ownerId, 'archived'); }
      if (patch.title != null && (typeof patch.title !== 'string' || !patch.title.trim() || patch.title.length > 160)) throw watchError('The watch title must contain 1 to 160 characters.');
      if (patch.intervalMs != null && !WATCH_INTERVALS.includes(patch.intervalMs)) throw watchError('Invalid watch interval.');
      if (patch.resetBaseline != null && typeof patch.resetBaseline !== 'boolean') throw watchError('Baseline reset must be explicit.');
      const value = await command(id, ownerId, async watch => {
        if (watch.status === 'archived') throw watchError('This watch is archived.', 409);
        if (patch.resetBaseline && active.has(id)) throw watchError('Wait for the current check before resetting its baseline.', 409);
        return save(id, ownerId, draft => {
          if (patch.title) draft.title = normalize(patch.title);
          if (patch.intervalMs) { draft.intervalMs = patch.intervalMs; if (draft.status === 'active') draft.nextCheckAt = iso(now() + patch.intervalMs); }
          if (patch.resetBaseline) {
            draft.baseline = null; draft.latestChange = null; draft.lastChangedAt = null; draft.error = null; draft.failureCount = 0;
            draft.nextCheckAt = draft.status === 'active' ? iso(now()) : null;
          }
        });
      });
      void drain(); return snapshot(value);
    },
    async pause(id, ownerId) { return stop(id, ownerId, 'paused'); },
    async archive(id, ownerId) { return stop(id, ownerId, 'archived'); },
    async resume(id, ownerId) {
      if (closing) throw watchError('Watch scheduling is stopping.', 503);
      const watch = await command(id, ownerId, async current => {
        if (current.status === 'archived') throw watchError('This watch is archived.', 409);
        if (current.status === 'active') return current;
        return save(id, ownerId, draft => { draft.status = 'active'; draft.nextCheckAt = iso(now()); });
      });
      void drain(); return snapshot(watch);
    },
    async check(id, ownerId, { requestId } = {}) {
      if (!isWatchId(requestId)) throw watchError('A UUID requestId is required.');
      if (closing) throw watchError('Watch scheduling is stopping.', 503);
      const ticket = await command(id, ownerId, async watch => {
        if (closing) throw watchError('Watch scheduling is stopping.', 503);
        if (watch.status === 'archived') throw watchError('This watch is archived.', 409);
        if (watch.requests.some(request => request.id === requestId.toLowerCase())) return { done: (active.get(id) || queued.get(id))?.done };
        await save(id, ownerId, draft => { draft.requests.push({ id: requestId.toLowerCase(), requestedAt: iso(now()), status: 'queued' }); });
        const job = enqueue(watch, true);
        return { done: job.done };
      });
      void drain(); await ticket.done; return snapshot(await owned(id, ownerId));
    },
    async notifications(ownerId) { await ready; return store.notifications(ownerId); },
    async acknowledge(id, ownerId) { await ready; return store.acknowledge(id, ownerId); },
    async close() {
      await ready; closing = true; if (timer) clearInterval(timer);
      for (const job of active.values()) { job.intent ||= 'close'; job.controller.abort(); }
      await Promise.all([...commands.values()].map(pending => pending.catch(() => {})));
      for (const job of queued.values()) job.resolve(); queued.clear();
      await Promise.all([...active.values()].map(job => job.done));
    }
  };
}
