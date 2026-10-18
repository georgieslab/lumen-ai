import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile, lstat } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { isMissionId, missionError } from './missionStore.js';

const FILE_EXTENSIONS = new Set(['.txt', '.text', '.md', '.markdown', '.csv', '.json']);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = (value) => structuredClone(value);
const validDate = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const owner = (value) => {
  if (typeof value !== 'string' || !value || value.length > 512) throw missionError('A project owner is required.');
  return value;
};
const text = (value, maximum, label, { required = false, trim = true } = {}) => {
  if (typeof value !== 'string' || value.length > maximum || value.includes('\0') || (required && !value.trim())) {
    throw missionError(`${label} must contain ${required ? '1 to ' : 'at most '}${maximum} characters.`);
  }
  return trim ? value.trim() : value;
};
function onlyFields(input, allowed) {
  if (!object(input) || Object.keys(input).some((key) => !allowed.includes(key))) throw missionError('Invalid project fields.');
}
function fileName(value) {
  const name = text(value, 160, 'File name', { required: true });
  if (/[\\/\u0000-\u001f\u007f]/.test(name) || !FILE_EXTENSIONS.has(path.extname(name).toLowerCase())) {
    throw missionError('Use a text, Markdown, CSV, or JSON file with a plain file name.');
  }
  return name;
}
function storageError(cause) {
  const error = missionError('Project storage is temporarily unavailable.', 503);
  error.cause = cause;
  return error;
}
function publicProject(record) {
  const { version, ownerId, ...project } = record;
  return clone(project);
}
function summary(record) {
  const { id, name, description, createdAt, updatedAt, archived, revision } = record;
  return { id, name, description, createdAt, updatedAt, archived, revision, fileCount: record.files.length, pinCount: record.pins.length };
}
function validateRecord(record, id) {
  try {
    if (!object(record) || record.id !== id || record.version !== 1 || !isMissionId(id) || !validDate(record.createdAt)
      || !validDate(record.updatedAt) || !Number.isSafeInteger(record.revision) || record.revision < 1 || typeof record.archived !== 'boolean') return false;
    owner(record.ownerId);
    text(record.name, 100, 'Project name', { required: true });
    text(record.description, 2000, 'Project description');
    text(record.instructions, 12000, 'Project instructions');
    if (!Array.isArray(record.files) || record.files.length > 10 || !Array.isArray(record.pins) || record.pins.length > 100) return false;
    const fileIds = new Set();
    const names = new Set();
    for (const file of record.files) {
      if (!object(file) || !isMissionId(file.id) || fileIds.has(file.id) || !validDate(file.createdAt)) return false;
      fileName(file.name);
      text(file.text, 100000, 'File contents', { required: true, trim: false });
      if (names.has(file.name.toLowerCase())) return false;
      fileIds.add(file.id); names.add(file.name.toLowerCase());
    }
    if (record.instructions.length + record.files.reduce((total, file) => total + file.text.length, 0) > 400000) return false;
    const pins = new Set();
    const pinIds = new Set();
    for (const pin of record.pins) {
      if (!object(pin) || !isMissionId(pin.id) || !isMissionId(pin.missionId) || !validDate(pin.createdAt)
        || pinIds.has(pin.id) || pins.has(`${pin.missionId}:${pin.widgetId}`)) return false;
      text(pin.widgetId, 240, 'Artifact ID', { required: true });
      text(pin.widgetType, 80, 'Artifact type', { required: true });
      text(pin.title, 160, 'Artifact title', { required: true });
      pins.add(`${pin.missionId}:${pin.widgetId}`); pinIds.add(pin.id);
    }
    return true;
  } catch { return false; }
}

/** Local, single-process project persistence. Files are text records, never filesystem paths. */
export function createProjectStore({ directory, maxActivePerOwner = 30 } = {}) {
  if (!directory) throw new TypeError('A project storage directory is required.');
  const root = path.resolve(directory);
  const records = new Map();
  let queue = Promise.resolve();
  const location = (id) => {
    if (!isMissionId(id)) throw missionError('Invalid project ID.');
    return path.join(root, `${id}.json`);
  };
  const ready = (async () => {
    try {
      await mkdir(root, { recursive: true });
      for (const entry of await readdir(root, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
        const id = entry.name.slice(0, -5);
        if (!isMissionId(id)) continue;
        try {
          const filename = location(id);
          const stat = await lstat(filename);
          if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue;
          const record = JSON.parse(await readFile(filename, 'utf8'));
          if (validateRecord(record, id)) records.set(id, record);
        } catch { /* A corrupt project cannot hide healthy projects. */ }
      }
    } catch (error) { throw storageError(error); }
  })();
  function transaction(operation) {
    const result = queue.then(() => ready).then(operation);
    queue = result.catch(() => {});
    return result;
  }
  function owned(id, ownerId) {
    owner(ownerId); location(id);
    const record = records.get(id);
    if (!record || record.ownerId !== ownerId) throw missionError('Project not found.', 404);
    return record;
  }
  function contextLimit(record) {
    if (record.instructions.length + record.files.reduce((total, file) => total + file.text.length, 0) > 400000) {
      throw missionError('Project files and instructions can contain at most 400000 characters.', 413);
    }
  }
  async function commit(record) {
    contextLimit(record);
    const serialized = JSON.stringify(record);
    const temporary = path.join(root, `${record.id}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, serialized, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      for (let attempt = 0; ; attempt++) {
        try { await rename(temporary, location(record.id)); break; }
        catch (error) {
          if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 5) throw error;
          await delay(25 * (2 ** attempt));
        }
      }
    } catch (error) {
      await unlink(temporary).catch(() => {});
      throw storageError(error);
    }
    const saved = JSON.parse(serialized);
    records.set(saved.id, saved);
    return publicProject(saved);
  }
  function revised(record) { return { ...clone(record), updatedAt: new Date().toISOString(), revision: record.revision + 1 }; }
  return {
    ready,
    async list(ownerId, { includeArchived = false } = {}) {
      return transaction(() => {
        owner(ownerId);
        return [...records.values()].filter((record) => record.ownerId === ownerId && (includeArchived || !record.archived))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(summary);
      });
    },
    async create(ownerId, input) {
      return transaction(async () => {
        owner(ownerId); onlyFields(input, ['name', 'description', 'instructions']);
        const name = text(input.name, 100, 'Project name', { required: true });
        const description = text(input.description ?? '', 2000, 'Project description');
        const instructions = text(input.instructions ?? '', 12000, 'Project instructions');
        if ([...records.values()].filter((record) => record.ownerId === ownerId && !record.archived).length >= maxActivePerOwner) {
          throw missionError('The active project limit has been reached. Archive a project to create another.', 429);
        }
        const now = new Date().toISOString();
        return commit({ version: 1, id: randomUUID(), ownerId, name, description, instructions, createdAt: now, updatedAt: now,
          archived: false, revision: 1, files: [], pins: [] });
      });
    },
    async get(id, ownerId) {
      return transaction(() => {
        owner(ownerId); location(id);
        const record = records.get(id);
        return record?.ownerId === ownerId ? publicProject(record) : null;
      });
    },
    async update(id, ownerId, patch) {
      return transaction(async () => {
        const current = owned(id, ownerId);
        onlyFields(patch, ['name', 'description', 'instructions', 'archived']);
        if (!Object.keys(patch).length) throw missionError('Supply at least one project field.');
        const next = revised(current);
        if (Object.hasOwn(patch, 'name')) next.name = text(patch.name, 100, 'Project name', { required: true });
        if (Object.hasOwn(patch, 'description')) next.description = text(patch.description, 2000, 'Project description');
        if (Object.hasOwn(patch, 'instructions')) next.instructions = text(patch.instructions, 12000, 'Project instructions');
        if (Object.hasOwn(patch, 'archived')) {
          if (typeof patch.archived !== 'boolean') throw missionError('Archived must be true or false.');
          if (current.archived && !patch.archived && [...records.values()].filter((record) => record.ownerId === ownerId && !record.archived).length >= maxActivePerOwner) {
            throw missionError('Archive another project before restoring this one.', 429);
          }
          next.archived = patch.archived;
        }
        return commit(next);
      });
    },
    async addFile(id, ownerId, input) {
      return transaction(async () => {
        const current = owned(id, ownerId);
        if (current.archived) throw missionError('Restore this project before adding files.', 409);
        onlyFields(input, ['name', 'text']);
        const name = fileName(input.name);
        const contents = text(input.text, 100000, 'File contents', { required: true, trim: false });
        if (current.files.length >= 10) throw missionError('A project can contain at most 10 files.', 429);
        if (current.files.some((file) => file.name.toLowerCase() === name.toLowerCase())) throw missionError('A file with this name is already in the project.', 409);
        const next = revised(current);
        next.files.push({ id: randomUUID(), name, text: contents, createdAt: new Date().toISOString() });
        return commit(next);
      });
    },
    async removeFile(id, ownerId, fileId) {
      return transaction(async () => {
        const current = owned(id, ownerId);
        if (!isMissionId(fileId)) throw missionError('Invalid file ID.');
        if (!current.files.some((file) => file.id === fileId)) throw missionError('Project file not found.', 404);
        const next = revised(current); next.files = next.files.filter((file) => file.id !== fileId);
        return commit(next);
      });
    },
    async pin(id, ownerId, input) {
      return transaction(async () => {
        const current = owned(id, ownerId);
        if (current.archived) throw missionError('Restore this project before pinning outputs.', 409);
        onlyFields(input, ['missionId', 'widgetId', 'widgetType', 'title']);
        if (!isMissionId(input.missionId)) throw missionError('Invalid mission ID.');
        const widgetId = text(input.widgetId, 240, 'Artifact ID', { required: true });
        const widgetType = text(input.widgetType, 80, 'Artifact type', { required: true });
        const title = text(input.title, 160, 'Artifact title', { required: true });
        if (current.pins.some((pin) => pin.missionId === input.missionId && pin.widgetId === widgetId)) return publicProject(current);
        if (current.pins.length >= 100) throw missionError('A project can contain at most 100 pinned outputs.', 429);
        const next = revised(current);
        next.pins.push({ id: randomUUID(), missionId: input.missionId, widgetId, widgetType, title, createdAt: new Date().toISOString() });
        return commit(next);
      });
    },
    async unpin(id, ownerId, pinId) {
      return transaction(async () => {
        const current = owned(id, ownerId);
        if (!isMissionId(pinId)) throw missionError('Invalid pin ID.');
        if (!current.pins.some((pin) => pin.id === pinId)) throw missionError('Pinned output not found.', 404);
        const next = revised(current); next.pins = next.pins.filter((pin) => pin.id !== pinId);
        return commit(next);
      });
    }
  };
}
