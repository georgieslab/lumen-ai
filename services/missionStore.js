import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { validateMissionCheckpoint } from './agentRunner.js';

const MISSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STATUSES = new Set(['queued', 'running', 'pausing', 'paused', 'completed', 'failed', 'cancelled']);
const clone = (value) => structuredClone(value);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const objectArray = (value) => Array.isArray(value) && value.every(object);

function validCheckpoint(checkpoint) {
  try { validateMissionCheckpoint(checkpoint); return true; }
  catch { return false; }
}

function validStoredRecord(record, id) {
  return object(record) && record.id === id && record.version === 1
    && typeof record.ownerId === 'string' && !!record.ownerId && record.ownerId.length <= 512
    && typeof record.requestId === 'string' && !!record.requestId && record.requestId.length <= 160
    && typeof record.inputHash === 'string' && /^[0-9a-f]{64}$/.test(record.inputHash)
    && object(record.input) && typeof record.title === 'string' && record.title.length <= 160
    && STATUSES.has(record.status) && Number.isSafeInteger(record.revision) && record.revision >= 1
    && typeof record.createdAt === 'string' && Number.isFinite(Date.parse(record.createdAt))
    && typeof record.updatedAt === 'string' && Number.isFinite(Date.parse(record.updatedAt))
    && (record.context === null || object(record.context))
    && object(record.result) && typeof record.result.reply === 'string'
    && objectArray(record.result.widgets) && objectArray(record.result.tools) && objectArray(record.result.webSources)
    && (record.error === null || typeof record.error === 'string')
    && (record.recoveryReason === null || typeof record.recoveryReason === 'string')
    && (record.checkpoint === null || validCheckpoint(record.checkpoint));
}

export function missionError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  return error;
}

export function isMissionId(id) { return typeof id === 'string' && MISSION_ID.test(id); }

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function serialize(value, limit, message) {
  let result;
  try { result = JSON.stringify(value); }
  catch { throw missionError('Mission data must be JSON serializable.'); }
  if (result === undefined) throw missionError('Mission data must be JSON serializable.');
  if (Buffer.byteLength(result) > limit) throw missionError(message, 413);
  return result;
}

/** A single-process JSON store. Every mutation is serialized and committed with an atomic rename. */
export function createMissionStore({ directory, maxPerOwner = 100, maxRecordBytes = 8 * 1024 * 1024, maxInputBytes = 512 * 1024 } = {}) {
  if (!directory) throw new TypeError('A mission storage directory is required.');
  const root = path.resolve(directory);
  const records = new Map();
  let queue = Promise.resolve();
  const filePath = (id) => {
    if (!isMissionId(id)) throw missionError('Invalid mission ID.');
    return path.join(root, `${id}.json`);
  };
  const initialized = (async () => {
    await mkdir(root, { recursive: true });
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const id = entry.name.slice(0, -5);
      if (!isMissionId(id)) continue;
      const filename = filePath(id);
      const stat = await lstat(filename);
      if (!stat.isFile() || stat.size > maxRecordBytes) continue;
      let record;
      try { record = JSON.parse(await readFile(filename, 'utf8')); }
      catch { continue; } // One incomplete/corrupt file must not hide the other missions.
      if (!validStoredRecord(record, id)) continue;
      records.set(id, record);
    }
  })().catch((cause) => { const error = missionError('Mission storage is temporarily unavailable.', 503); error.cause = cause; throw error; });
  function transaction(operation) {
    const result = queue.then(() => initialized).then(operation);
    queue = result.catch(() => {});
    return result;
  }
  async function commit(record) {
    const json = serialize(record, maxRecordBytes, 'The mission checkpoint is too large to save.');
    const filename = filePath(record.id);
    const temporary = path.join(root, `${record.id}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, json, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      // Windows indexing/antivirus can briefly lock a just-written file. Retry the atomic
      // operation itself; deleting the previous record would break checkpoint durability.
      for (let attempt = 0; ; attempt++) {
        try { await rename(temporary, filename); break; }
        catch (error) {
          if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 5) throw error;
          await delay(25 * (2 ** attempt));
        }
      }
    } catch (error) {
      await unlink(temporary).catch(() => {});
      const unavailable = missionError('Mission storage is temporarily unavailable.', 503);
      unavailable.cause = error;
      throw unavailable;
    }
    const saved = JSON.parse(json);
    records.set(saved.id, saved);
    return clone(saved);
  }
  return {
    async create({ ownerId, requestId, input, title, context = null }) {
      return transaction(async () => {
        if (typeof ownerId !== 'string' || !ownerId || ownerId.length > 512) throw missionError('A mission owner is required.');
        if (typeof requestId !== 'string' || !requestId || requestId.length > 160) throw missionError('A valid request ID is required.');
        const serializedInput = serialize(input, maxInputBytes, 'The mission request is too large.');
        const safeInput = JSON.parse(serializedInput);
        if (!safeInput || typeof safeInput !== 'object' || Array.isArray(safeInput)) throw missionError('Mission input must be an object.');
        const inputHash = createHash('sha256').update(canonical(safeInput)).digest('hex');
        const owned = [...records.values()].filter((record) => record.ownerId === ownerId);
        const existing = owned.find((record) => record.requestId === requestId);
        if (existing) {
          if (existing.inputHash !== inputHash) throw missionError('This request ID was already used for a different mission.', 409);
          return clone(existing);
        }
        if (owned.length >= maxPerOwner) throw missionError('The saved mission limit has been reached.', 429);
        const now = new Date().toISOString();
        return commit({ version: 1, id: randomUUID(), ownerId, requestId, inputHash, input: safeInput,
          title: String(title || safeInput.message || safeInput.prompt || 'New mission').replace(/\s+/g, ' ').trim().slice(0, 160) || 'New mission',
          context, status: 'queued', revision: 1, createdAt: now, updatedAt: now,
          checkpoint: null, result: { reply: '', widgets: [], tools: [], webSources: [] }, error: null, recoveryReason: null });
      });
    },
    async get(id, ownerId) {
      return transaction(() => {
        filePath(id);
        const record = records.get(id);
        return record && record.ownerId === ownerId ? clone(record) : null;
      });
    },
    async list(ownerId) {
      return transaction(() => [...records.values()].filter((record) => record.ownerId === ownerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone));
    },
    async update(id, mutator) {
      return transaction(async () => {
        filePath(id);
        const previous = records.get(id);
        if (!previous) throw missionError('Mission not found.', 404);
        const draft = clone(previous);
        const next = await mutator(draft) || draft;
        for (const field of ['id', 'ownerId', 'requestId', 'inputHash', 'input', 'createdAt', 'version']) next[field] = clone(previous[field]);
        if (!STATUSES.has(next.status)) throw missionError('Invalid mission status.');
        next.revision = previous.revision + 1;
        next.updatedAt = new Date().toISOString();
        return commit(next);
      });
    },
    async recover() {
      return transaction(async () => {
        for (const previous of records.values()) {
          if (!['running', 'pausing'].includes(previous.status)) continue;
          const complete = previous.checkpoint?.phase === 'complete' && validCheckpoint(previous.checkpoint);
          const next = { ...clone(previous), status: complete ? 'completed' : 'paused', revision: previous.revision + 1,
            updatedAt: new Date().toISOString(), error: null,
            recoveryReason: complete ? null : 'The server restarted. Resume from the last saved checkpoint.' };
          if (complete) next.result = { ...next.result, reply: previous.checkpoint.reply || '', widgets: previous.checkpoint.widgets || [], tools: previous.checkpoint.calls || [] };
          await commit(next);
        }
        return [...records.values()].map(clone);
      });
    }
  };
}
