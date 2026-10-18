import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export const WATCH_INTERVALS = [900000, 3600000, 21600000, 86400000];
export const WATCH_TEXT_LIMIT = 40000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => structuredClone(value);
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const optionalDate = value => value === null || date(value);
const digest = value => createHash('sha256').update(value).digest('hex');
export const isWatchId = value => typeof value === 'string' && UUID.test(value);
export function watchError(message, status = 400) { return Object.assign(new Error(message), { status, statusCode: status }); }
export function publicWatchUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.href.length > 2000) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}
const clean = (value, maximum) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maximum) : '';
export function normalizeWatchRequest(body) {
  if (!object(body) || !isWatchId(body.requestId)) throw watchError('A UUID requestId is required.');
  if (!['url', 'topic'].includes(body.kind)) throw watchError('Choose a URL or topic watch.');
  if (typeof body.target !== 'string' || !body.target.trim() || body.target.length > (body.kind === 'url' ? 2000 : 500)) throw watchError('Enter a valid URL or a topic of up to 500 characters.');
  const target = body.kind === 'url' ? publicWatchUrl(body.target.trim()) : clean(body.target, 500);
  if (!target) throw watchError('Use an HTTP or HTTPS URL without embedded credentials.');
  const intervalMs = body.intervalMs ?? 3600000;
  if (!WATCH_INTERVALS.includes(intervalMs)) throw watchError('Choose a 15 minute, 1 hour, 6 hour, or 24 hour interval.');
  if (body.title != null && (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 160)) throw watchError('The watch title must contain 1 to 160 characters.');
  return { requestId: body.requestId.toLowerCase(), kind: body.kind, target,
    title: clean(body.title, 160) || (body.kind === 'url' ? new URL(target).hostname : target.slice(0, 80)), intervalMs };
}
const validSources = sources => Array.isArray(sources) && sources.length <= 8 && sources.every(source => object(source)
  && typeof source.title === 'string' && source.title.length <= 200 && !!publicWatchUrl(source.url));
function validBaseline(value) {
  return value === null || (object(value) && /^[0-9a-f]{64}$/.test(value.hash) && typeof value.text === 'string'
    && !!value.text.trim() && value.text.length <= WATCH_TEXT_LIMIT && value.hash === digest(value.text)
    && typeof value.title === 'string' && value.title.length <= 200
    && typeof value.url === 'string' && value.url.length <= 2000 && (!value.url || publicWatchUrl(value.url)) && validSources(value.sources));
}
function validChange(value) {
  return value === null || (object(value) && isWatchId(value.id) && date(value.observedAt)
    && ['summary', 'before', 'after', 'title', 'url'].every(key => typeof value[key] === 'string')
    && value.before.length <= 600 && value.after.length <= 600 && value.summary.length <= 300
    && value.title.length <= 200 && value.url.length <= 2000 && (!value.url || publicWatchUrl(value.url)) && validSources(value.sources));
}
function validWatch(watch, ownerId) {
  if (!object(watch) || watch.ownerId !== ownerId || watch.version !== 1 || !isWatchId(watch.id)
    || !isWatchId(watch.requestId) || typeof watch.inputHash !== 'string' || !/^[0-9a-f]{64}$/.test(watch.inputHash)
    || !['url', 'topic'].includes(watch.kind) || typeof watch.target !== 'string' || !watch.target || watch.target.length > 2000
    || (watch.kind === 'url' && !publicWatchUrl(watch.target)) || (watch.kind === 'topic' && watch.target.length > 500)
    || typeof watch.title !== 'string' || !watch.title || watch.title.length > 160
    || !WATCH_INTERVALS.includes(watch.intervalMs) || !['active', 'paused', 'archived'].includes(watch.status)
    || !Number.isSafeInteger(watch.revision) || watch.revision < 1 || !date(watch.createdAt) || !date(watch.updatedAt)
    || !optionalDate(watch.nextCheckAt) || (watch.status === 'active' && !date(watch.nextCheckAt)) || !optionalDate(watch.lastCheckedAt) || !optionalDate(watch.lastChangedAt)
    || !Number.isInteger(watch.failureCount) || watch.failureCount < 0 || watch.failureCount > 10
    || (watch.error !== null && (typeof watch.error !== 'string' || watch.error.length > 300))
    || !validBaseline(watch.baseline) || !validChange(watch.latestChange) || !Array.isArray(watch.requests) || watch.requests.length > 20) return false;
  if (!watch.requests.every(request => object(request) && isWatchId(request.id) && date(request.requestedAt)
    && ['queued', 'running', 'done', 'failed', 'interrupted'].includes(request.status))) return false;
  return watch.inFlight === null || (object(watch.inFlight) && date(watch.inFlight.startedAt) && typeof watch.inFlight.manual === 'boolean');
}
function validNotification(value, watches) {
  return object(value) && isWatchId(value.id) && watches.some(watch => watch.id === value.watchId)
    && value.kind === 'watch_change' && value.channel === 'in_app' && date(value.createdAt) && optionalDate(value.readAt)
    && ['watchTitle', 'summary', 'before', 'after', 'url'].every(key => typeof value[key] === 'string')
    && value.watchTitle.length <= 160 && value.summary.length <= 300 && value.before.length <= 600 && value.after.length <= 600
    && value.url.length <= 2000 && (!value.url || publicWatchUrl(value.url)) && validSources(value.sources);
}

// Each owner has one atomic snapshot, so a change and its notification commit together.
export function createWatchStore({ directory, now = Date.now, maxSavedPerOwner = 100, maxActivePerOwner = 20, maxOwnerBytes = 16 * 1024 * 1024 } = {}) {
  if (!directory) throw new TypeError('A watch storage directory is required.');
  const root = path.resolve(directory);
  const owners = new Map();
  let queue = Promise.resolve();
  const ownerKey = ownerId => {
    if (typeof ownerId !== 'string' || !ownerId || ownerId.length > 512) throw watchError('A watch owner is required.');
    return digest(ownerId);
  };
  const initialized = (async () => {
    await mkdir(root, { recursive: true });
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isFile() || !/^[0-9a-f]{64}\.json$/.test(entry.name)) continue;
      try {
        const filename = path.join(root, entry.name);
        const stat = await lstat(filename);
        if (!stat.isFile() || stat.size > maxOwnerBytes) continue;
        const data = JSON.parse(await readFile(filename, 'utf8'));
        if (!object(data) || data.version !== 1 || typeof data.ownerId !== 'string' || `${ownerKey(data.ownerId)}.json` !== entry.name
          || !Array.isArray(data.watches) || !Array.isArray(data.notifications)) continue;
        const seen = new Set(); let activeCount = 0;
        const watches = data.watches.filter(watch => {
          if (!validWatch(watch, data.ownerId) || seen.has(watch.id) || (watch.status !== 'archived' && activeCount >= maxActivePerOwner)) return false;
          seen.add(watch.id); if (watch.status !== 'archived') activeCount++;
          return true;
        }).slice(0, maxSavedPerOwner);
        owners.set(data.ownerId, { version: 1, ownerId: data.ownerId, watches,
          notifications: data.notifications.filter(value => validNotification(value, watches)).slice(-50) });
      } catch { /* A corrupt owner snapshot must not hide another owner's watches. */ }
    }
  })();
  const transaction = operation => {
    const result = queue.then(() => initialized).then(operation);
    queue = result.catch(() => {});
    return result;
  };
  const owner = ownerId => { ownerKey(ownerId); return clone(owners.get(ownerId) || { version: 1, ownerId, watches: [], notifications: [] }); };
  async function commit(data) {
    data.notifications = data.notifications.slice(-50);
    const json = JSON.stringify(data);
    if (Buffer.byteLength(json) > maxOwnerBytes) throw watchError('The saved watch limit has been reached.', 413);
    const filename = path.join(root, `${ownerKey(data.ownerId)}.json`);
    const temporary = path.join(root, `${ownerKey(data.ownerId)}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, json, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      for (let attempt = 0; ; attempt++) {
        try { await rename(temporary, filename); break; }
        catch (error) { if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 5) throw error; await delay(25 * 2 ** attempt); }
      }
    } catch (error) { await unlink(temporary).catch(() => {}); throw watchError('Watch storage is temporarily unavailable.', 503); }
    owners.set(data.ownerId, JSON.parse(json));
  }
  return {
    async create({ ownerId, ...body }) {
      const input = normalizeWatchRequest(body);
      return transaction(async () => {
        const data = owner(ownerId);
        const inputHash = digest(JSON.stringify(input));
        const previous = data.watches.find(watch => watch.requestId === input.requestId);
        if (previous) { if (previous.inputHash !== inputHash) throw watchError('This request ID belongs to a different watch.', 409); return clone(previous); }
        if (data.watches.length >= maxSavedPerOwner || data.watches.filter(watch => watch.status !== 'archived').length >= maxActivePerOwner) throw watchError('The saved watch limit has been reached. Archive a watch before adding another.', 429);
        const timestamp = new Date(now()).toISOString();
        const watch = { version: 1, id: randomUUID(), ownerId, ...input, inputHash, revision: 1,
          status: 'active', createdAt: timestamp, updatedAt: timestamp, nextCheckAt: timestamp,
          lastCheckedAt: null, lastChangedAt: null, baseline: null, latestChange: null, error: null, failureCount: 0, inFlight: null, requests: [] };
        data.watches.push(watch); await commit(data); return clone(watch);
      });
    },
    async get(id, ownerId) { return transaction(() => { if (!isWatchId(id)) return null; return clone(owner(ownerId).watches.find(watch => watch.id === id) || null); }); },
    async list(ownerId) { return transaction(() => owner(ownerId).watches.sort((a, b) => b.createdAt.localeCompare(a.createdAt))); },
    async all() { return transaction(() => [...owners.values()].flatMap(data => clone(data.watches))); },
    async update(id, ownerId, mutate) {
      return transaction(async () => {
        const data = owner(ownerId);
        const watch = data.watches.find(value => value.id === id);
        if (!watch) throw watchError('Watch not found.', 404);
        const immutable = Object.fromEntries(['id', 'ownerId', 'version', 'requestId', 'inputHash', 'kind', 'target', 'createdAt'].map(key => [key, watch[key]]));
        await mutate(watch, data.notifications);
        Object.assign(watch, immutable);
        watch.requests = watch.requests.slice(-20); watch.revision++; watch.updatedAt = new Date(now()).toISOString();
        if (!validWatch(watch, ownerId) || data.notifications.some(value => !validNotification(value, data.watches))) throw watchError('Invalid saved watch data.');
        await commit(data); return clone(watch);
      });
    },
    async notifications(ownerId) { return transaction(() => owner(ownerId).notifications.slice().reverse()); },
    async acknowledge(id, ownerId) {
      return transaction(async () => {
        const data = owner(ownerId);
        const notification = data.notifications.find(value => value.id === id);
        if (!notification) throw watchError('Notification not found.', 404);
        notification.readAt ||= new Date(now()).toISOString(); await commit(data); return clone(notification);
      });
    },
    async recover() {
      return transaction(async () => {
        for (const existing of owners.values()) {
          const data = clone(existing); let changed = false;
          for (const watch of data.watches) {
            if (!watch.inFlight && !watch.requests.some(request => ['queued', 'running'].includes(request.status))) continue;
            watch.inFlight = null;
            watch.requests = watch.requests.map(request => ['queued', 'running'].includes(request.status) ? { ...request, status: 'interrupted' } : request);
            watch.error = 'The server restarted during a check. Saved results were kept.';
            watch.nextCheckAt = watch.status === 'active' ? new Date(now()).toISOString() : null;
            watch.revision++; watch.updatedAt = new Date(now()).toISOString(); changed = true;
          }
          if (changed) await commit(data);
        }
      });
    }
  };
}
