import { missionError } from './missionStore.js';

const TERMINAL = new Set(['completed', 'cancelled']);
const RESUMABLE = new Set(['paused', 'failed']);
const clone = (value) => structuredClone(value);

function uniqueWidgets(widgets = []) {
  const found = new Set();
  return widgets.filter((widget) => {
    const id = widget.artifactId || widget.id || widget.checklistId || widget.scheduleId || widget.budgetId
      || widget.comparisonId || widget.briefId || widget.reportId || (widget.widgetType === 'pdf_document' ? widget.fileName : null);
    if (!id) return true;
    if (found.has(id)) return false;
    found.add(id);
    return true;
  });
}

function checkpointResult(checkpoint, previous = {}) {
  if (!checkpoint) return clone(previous);
  return { ...clone(previous), reply: checkpoint.reply || '', widgets: uniqueWidgets(checkpoint.widgets || []),
    tools: clone(checkpoint.calls || checkpoint.tools || []),
    webSources: clone(checkpoint.webSources || previous.webSources || []) };
}

// Deliberately excludes the request, provider context, tool arguments, and checkpoint history.
export function missionSnapshot(record, result = record.result || {}) {
  const value = {
    id: record.id, title: record.title, status: record.status, createdAt: record.createdAt, updatedAt: record.updatedAt,
    transcript: typeof record.input?.transcript === 'string' ? record.input.transcript : '',
    projectId: record.input?.projectId || null, actionKind: record.input?.actionKind || null,
    replyText: result.reply || '', widgets: uniqueWidgets(clone(result.widgets || [])),
    toolsUsed: (result.tools || []).map((tool) => ({ name: tool.name, toolUseId: tool.toolUseId,
      status: tool.status || 'running', summary: tool.resultSummary || tool.summary || '' })),
    webSources: clone(result.webSources?.length ? result.webSources : record.context?.webSources || []), error: record.error || null,
    recoveryReason: record.recoveryReason || null, canResume: RESUMABLE.has(record.status),
    checkpoint: { round: record.checkpoint?.round || 0, toolCalls: record.checkpoint?.calls?.length || 0 },
    revision: record.revision
  };
  for (const field of ['audioBase64', 'activeVoice', 'voiceChanged', 'provider', 'memoryStatus', 'briefSummary']) {
    if (Object.hasOwn(result, field)) value[field] = clone(result[field]);
  }
  return value;
}

/** Owns background runs independently of any HTTP connection. One process per storage directory. */
export function createMissionManager({ store, execute, maxConcurrent = 2, maxPerOwner = 1, timeoutMs = 120000 } = {}) {
  if (!store || typeof execute !== 'function') throw new TypeError('A store and execute function are required.');
  const records = new Map();
  const unsavedFailures = new Map();
  const live = new Map();
  const active = new Map();
  const listeners = new Map();
  const revisions = new Map();
  const commands = new Map();
  const transitioning = new Set();
  let draining = false;
  let closing = false;
  let ready;

  function stamp(record) {
    let value = revisions.get(record.id);
    if (!value || value.persisted !== record.revision) {
      value = { persisted: record.revision, sequence: 0 };
      revisions.set(record.id, value);
    }
    return value;
  }
  function snapshot(record) {
    const value = stamp(record);
    return { ...missionSnapshot(record, live.get(record.id) || record.result), revision: record.revision * 1000000 + value.sequence };
  }
  function publish(record) {
    records.set(record.id, record);
    stamp(record).sequence++;
    const value = snapshot(record);
    for (const listener of listeners.get(record.id) || []) {
      try { listener(clone(value)); } catch { /* A disconnected observer cannot fail the run. */ }
    }
    return value;
  }
  async function save(id, mutate) {
    const record = await store.update(id, mutate);
    unsavedFailures.delete(id);
    publish(record);
    return record;
  }
  async function owned(id, ownerId) {
    await ready;
    const saved = await store.get(id, ownerId);
    if (!saved) throw missionError('Mission not found.', 404);
    const failure = unsavedFailures.get(id);
    const record = failure && failure.revision >= saved.revision ? failure : saved;
    records.set(id, record);
    return record;
  }
  async function command(id, ownerId, operation) {
    const previous = commands.get(id) || Promise.resolve();
    const pending = previous.catch(() => {}).then(async () => {
      const record = await owned(id, ownerId);
      transitioning.add(id);
      try { return await operation(record); }
      finally { transitioning.delete(id); void drain(); }
    });
    commands.set(id, pending);
    try { return await pending; }
    finally { if (commands.get(id) === pending) commands.delete(id); }
  }
  function emit(id, event) {
    const record = records.get(id);
    if (!record || !['running', 'pausing'].includes(record.status)) return;
    const result = live.get(id) || clone(record.result);
    if (event.type === 'token') result.reply = (result.reply || '') + String(event.token || '');
    if (event.type === 'widget' && event.widget) result.widgets = uniqueWidgets([...(result.widgets || []), event.widget]);
    if (event.type === 'tool_start') result.tools = [...(result.tools || []).filter((tool) => tool.toolUseId !== event.toolUseId),
      { name: event.name, toolUseId: event.toolUseId, status: 'running' }];
    if (event.type === 'tool_result') {
      const tools = result.tools || [];
      const previous = tools.find((tool) => tool.toolUseId === event.toolUseId);
      const next = { ...previous, name: event.name, toolUseId: event.toolUseId, status: event.status, resultSummary: event.summary };
      result.tools = previous ? tools.map((tool) => tool.toolUseId === event.toolUseId ? next : tool) : [...tools, next];
    }
    if (event.type === 'sources' && Array.isArray(event.sources)) result.webSources = event.sources;
    live.set(id, result);
    publish(record);
  }

  async function run(id, control) {
    let timer;
    try {
      let record = await save(id, (draft) => {
        draft.status = 'running'; draft.error = null; draft.recoveryReason = null;
        draft.result = checkpointResult(draft.checkpoint, draft.result);
      });
      live.set(id, clone(record.result));
      if (control.intent) control.controller.abort();
      if (timeoutMs > 0) {
        timer = setTimeout(() => { control.intent = control.intent || 'timeout'; control.controller.abort(); }, timeoutMs);
        timer.unref?.();
      }
      const result = record.checkpoint?.phase === 'complete' ? checkpointResult(record.checkpoint, record.result) : await execute(clone(record), {
        signal: control.controller.signal,
        onEvent: (event) => emit(id, event),
        async onContext(context) {
          record = await save(id, (draft) => {
            draft.context = clone(context);
            if (Array.isArray(context?.webSources)) draft.result.webSources = clone(context.webSources);
          });
        },
        async onCheckpoint(checkpoint) {
          record = await store.update(id, (draft) => {
            draft.checkpoint = clone(checkpoint);
            draft.result = checkpointResult(checkpoint, draft.result);
          });
          unsavedFailures.delete(id);
          // A checkpoint replaces speculative output from a model round interrupted before completion.
          live.set(id, clone(record.result));
          publish(record);
        }
      });
      live.delete(id);
      await save(id, (draft) => {
        const completed = draft.checkpoint?.phase === 'complete';
        draft.status = control.intent === 'cancel' ? 'cancelled' : completed || !control.intent ? 'completed' : 'paused';
        draft.result = completed || !control.intent ? {
          ...draft.result, ...result, reply: result?.reply || result?.replyText || draft.result.reply || '',
          tools: result?.tools || result?.toolsUsed || draft.result.tools || [], widgets: uniqueWidgets(result?.widgets || draft.result.widgets || [])
        } : checkpointResult(draft.checkpoint, draft.result);
        draft.error = control.intent === 'timeout' && !completed ? 'This run reached its time limit. Resume to continue from its checkpoint.' : null;
      });
    } catch (error) {
      live.delete(id);
      await save(id, (draft) => {
        if (error.checkpoint) draft.checkpoint = clone(error.checkpoint);
        draft.result = draft.checkpoint ? checkpointResult(draft.checkpoint, draft.result) : error.partialResult || draft.result;
        draft.status = control.intent === 'cancel' ? 'cancelled' : control.intent ? 'paused' : 'failed';
        draft.error = control.intent === 'cancel' || control.intent === 'pause' || control.intent === 'close' ? null
          : control.intent === 'timeout' ? 'This run reached its time limit. Resume to continue from its checkpoint.'
            : String(error.message || 'The mission failed.').slice(0, 500);
      }).catch(() => {
        // Retain a visible failure if persistence itself is unavailable; never leave a promise unhandled.
        const record = records.get(id);
        if (record) {
          const failed = { ...record, status: 'failed', error: 'Unable to save mission progress. Resume when storage is available.' };
          unsavedFailures.set(id, failed);
          publish(failed);
        }
      });
    } finally {
      if (timer) clearTimeout(timer);
      active.delete(id);
      control.resolve();
      void drain();
    }
  }

  async function drain() {
    if (draining || closing) return;
    draining = true;
    try {
      for (const record of records.values()) {
        if (active.size >= maxConcurrent) break;
        if (record.status !== 'queued' || active.has(record.id) || transitioning.has(record.id)) continue;
        if ([...active.values()].filter((control) => control.ownerId === record.ownerId).length >= maxPerOwner) continue;
        let resolve;
        const done = new Promise((finish) => { resolve = finish; });
        const control = { controller: new AbortController(), ownerId: record.ownerId, intent: null, done, resolve };
        active.set(record.id, control);
        void run(record.id, control);
      }
    } finally { draining = false; }
  }

  ready = (async () => {
    for (const record of await store.recover()) records.set(record.id, record);
    void drain();
  })();

  return {
    ready,
    async start() { await ready; void drain(); },
    async create(params) {
      await ready;
      if (closing) throw missionError('The mission worker is shutting down.', 503);
      const saved = await store.create(params);
      const record = unsavedFailures.get(saved.id) || saved;
      records.set(record.id, record);
      publish(record);
      void drain();
      return snapshot(record);
    },
    async get(id, ownerId) { return snapshot(await owned(id, ownerId)); },
    async getRecord(id, ownerId) { return owned(id, ownerId); },
    async list(ownerId) {
      await ready;
      return (await store.list(ownerId)).map((record) => snapshot(unsavedFailures.get(record.id) || record));
    },
    async pause(id, ownerId) {
      return command(id, ownerId, async (record) => {
        if (TERMINAL.has(record.status) || RESUMABLE.has(record.status)) return snapshot(record);
        const control = active.get(id);
        if (control) {
          control.intent = control.intent === 'cancel' ? 'cancel' : 'pause';
          await save(id, (draft) => { if (!TERMINAL.has(draft.status)) draft.status = 'pausing'; });
          control.controller.abort();
          await control.done;
        } else await save(id, (draft) => { draft.status = 'paused'; });
        return snapshot(await owned(id, ownerId));
      });
    },
    async resume(id, ownerId) {
      return command(id, ownerId, async (record) => {
        if (closing) throw missionError('The mission worker is shutting down.', 503);
        if (TERMINAL.has(record.status)) throw missionError('This mission has already ended.', 409);
        if (!RESUMABLE.has(record.status)) return snapshot(record);
        live.delete(id);
        const next = await save(id, (draft) => {
          draft.status = 'queued'; draft.error = null; draft.recoveryReason = null;
          draft.result = checkpointResult(draft.checkpoint, draft.result);
        });
        void drain();
        return snapshot(next);
      });
    },
    async cancel(id, ownerId) {
      return command(id, ownerId, async (record) => {
        if (TERMINAL.has(record.status)) return snapshot(record);
        const control = active.get(id);
        if (control) {
          control.intent = 'cancel'; control.controller.abort();
          await control.done;
        } else await save(id, (draft) => { draft.status = 'cancelled'; draft.error = null; });
        return snapshot(await owned(id, ownerId));
      });
    },
    async subscribe(id, ownerId, listener) {
      const record = await owned(id, ownerId);
      let collection = listeners.get(id);
      if (!collection) { collection = new Set(); listeners.set(id, collection); }
      collection.add(listener);
      listener(snapshot(record));
      return () => { collection.delete(listener); if (!collection.size) listeners.delete(id); };
    },
    async close() {
      await ready;
      closing = true;
      for (const control of active.values()) { control.intent = control.intent || 'close'; control.controller.abort(); }
      await Promise.all([...active.values()].map((control) => control.done));
    }
  };
}
