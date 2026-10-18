import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createMissionStore } from '../services/missionStore.js';
import { createMissionManager } from '../services/missionManager.js';

const deferred = () => { let resolve; const promise = new Promise((finish) => { resolve = finish; }); return { promise, resolve }; };
const request = (overrides = {}) => ({ ownerId: 'owner', requestId: randomUUID(), input: { transcript: 'Do useful work', history: [{ secret: 'private history' }] }, ...overrides });
const abortable = (signal) => new Promise((resolve, reject) => {
  const abort = () => { const error = new Error('Stopped'); error.name = 'AbortError'; reject(error); };
  if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
});
function savedCheckpoint({ phase = 'model', round = 0, reply = '', widgets = [] } = {}) {
  const history = [{ role: 'user', content: [{ text: 'Work' }] }];
  const calls = [];
  for (let i = 0; i < round; i++) {
    const tool = { name: 'compute', toolUseId: `call-${i}`, input: { expression: '1+1' } };
    history.push({ role: 'assistant', content: [{ toolUse: tool }] },
      { role: 'user', content: [{ toolResult: { toolUseId: tool.toolUseId, status: 'success', content: [{ json: { value: 2 } }] } }] });
    calls.push({ ...tool, status: 'success', resultSummary: '2' });
  }
  if (phase === 'complete') history.push({ role: 'assistant', content: [{ text: reply || 'Done' }] });
  return { version: 1, phase, history, initialHistoryLength: 1, round, calls, widgets, reply,
    limits: { maxToolRounds: 6, maxToolCalls: 12 }, pending: null, ...(phase === 'complete' ? { stopReason: 'end_turn' } : {}) };
}
async function setup(t, execute, options = {}) {
  const scratch = path.resolve('scratch');
  await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(path.join(scratch, 'lumen-mission-manager-'));
  const store = createMissionStore({ directory });
  const manager = createMissionManager({ store, execute, ...options });
  t.after(async () => { await manager.close(); await rm(directory, { recursive: true, force: true }); });
  await manager.ready;
  return { manager, store, directory };
}
async function settled(manager, id, ownerId = 'owner') {
  const current = await manager.get(id, ownerId);
  if (!['queued', 'running', 'pausing'].includes(current.status)) return current;
  return new Promise((resolve, reject) => {
    let unsubscribe;
    let ended = false;
    const timeout = setTimeout(() => { unsubscribe?.(); reject(new Error('Mission did not settle')); }, 3000);
    manager.subscribe(id, ownerId, (snapshot) => {
      if (['queued', 'running', 'pausing'].includes(snapshot.status)) return;
      ended = true; clearTimeout(timeout); unsubscribe?.(); resolve(snapshot);
    }).then((stop) => { unsubscribe = stop; if (ended) stop(); }).catch(reject);
  });
}

test('background execution streams safe snapshots and saves complete outputs without an observer', async (t) => {
  const started = deferred();
  const finish = deferred();
  const { manager, store } = await setup(t, async (record, { onContext, onEvent, onCheckpoint }) => {
    await onContext({ systemPrompt: 'PRIVATE SYSTEM', messages: [{ text: 'PRIVATE HISTORY' }] });
    started.resolve(); await finish.promise;
    onEvent({ type: 'token', token: 'Useful output' });
    onEvent({ type: 'tool_start', toolUseId: 'call', name: 'compute', input: { secret: 'PRIVATE TOOL' } });
    await onCheckpoint({ round: 1, phase: 'complete', reply: 'Useful output', widgets: [{ artifactId: 'a', title: 'Plan' }, { artifactId: 'a', title: 'Duplicate' }],
      calls: [{ name: 'compute', toolUseId: 'call', input: { secret: 'PRIVATE TOOL' }, status: 'success', resultSummary: '42' }] });
    return { reply: 'Useful output', widgets: [{ artifactId: 'a', title: 'Plan' }], tools: [{ name: 'compute', status: 'success', resultSummary: '42' }] };
  });
  const created = await manager.create(request());
  await started.promise;
  const seen = [];
  const stop = await manager.subscribe(created.id, 'owner', (value) => seen.push(value));
  stop(); finish.resolve();
  const complete = await settled(manager, created.id);
  assert.equal(complete.status, 'completed');
  assert.equal(complete.replyText, 'Useful output');
  assert.equal(complete.widgets.length, 1);
  assert.equal(complete.transcript, 'Do useful work');
  assert.equal(complete.canResume, false);
  assert.doesNotMatch(JSON.stringify(complete), /PRIVATE|private history|systemPrompt|ownerId|input/);
  assert.equal((await store.get(created.id, 'owner')).context.systemPrompt, 'PRIVATE SYSTEM');
  assert.ok(seen.length);
  await assert.rejects(manager.get(created.id, 'other'), { status: 404 });
  await assert.rejects(manager.resume(created.id, 'owner'), { status: 409 });
});

test('pause/resume retains checkpoint budgets and clears speculative text before the next run', async (t) => {
  const started = deferred();
  let executions = 0;
  const checkpoint = { version: 1, phase: 'model', round: 2, calls: [{ name: 'compute', status: 'success' }], widgets: [{ artifactId: 'plan' }], reply: 'Committed.' };
  const { manager } = await setup(t, async (record, { signal, onCheckpoint, onEvent }) => {
    executions++;
    if (executions === 1) {
      await onCheckpoint(checkpoint);
      onEvent({ type: 'token', token: ' Partial thought never committed.' });
      started.resolve();
      return abortable(signal);
    }
    assert.deepEqual(record.checkpoint, checkpoint);
    assert.equal(record.result.reply, 'Committed.');
    return { reply: 'Committed. Finished.', widgets: checkpoint.widgets, tools: checkpoint.calls };
  });
  const created = await manager.create(request());
  await started.promise;
  assert.match((await manager.get(created.id, 'owner')).replyText, /Partial/);
  const paused = await manager.pause(created.id, 'owner');
  assert.equal(paused.status, 'paused');
  assert.equal(paused.replyText, 'Committed.');
  assert.equal(paused.checkpoint.toolCalls, 1);
  assert.equal(paused.checkpoint.round, 2);
  assert.equal(paused.canResume, true);
  await manager.resume(created.id, 'owner');
  assert.equal((await settled(manager, created.id)).replyText, 'Committed. Finished.');
  assert.equal(executions, 2);
});

test('failure keeps completed checkpoints and can resume; cancellation is terminal', async (t) => {
  let first = true;
  const { manager } = await setup(t, async (record, { signal, onCheckpoint }) => {
    if (record.input.transcript === 'Cancel') return abortable(signal);
    if (first) {
      first = false;
      await onCheckpoint({ round: 1, phase: 'model', reply: 'Saved', calls: [{ name: 'compute' }], widgets: [] });
      throw new Error('Provider unavailable');
    }
    return { reply: 'Recovered' };
  });
  const failed = await manager.create(request());
  const failure = await settled(manager, failed.id);
  assert.equal(failure.status, 'failed');
  assert.equal(failure.replyText, 'Saved');
  assert.match(failure.error, /Provider unavailable/);
  assert.equal(failure.canResume, true);
  await manager.resume(failed.id, 'owner');
  assert.equal((await settled(manager, failed.id)).status, 'completed');
  const cancelled = await manager.create(request({ input: { transcript: 'Cancel' } }));
  assert.equal((await manager.cancel(cancelled.id, 'owner')).status, 'cancelled');
  await assert.rejects(manager.resume(cancelled.id, 'owner'), { status: 409 });
});

test('a global limit and per-owner limit queue work fairly without duplicate runs', async (t) => {
  const releases = new Map();
  const starts = [];
  const { manager } = await setup(t, async (record) => {
    starts.push(record.id);
    const release = deferred(); releases.set(record.id, release);
    await release.promise;
    return { reply: 'Done' };
  });
  const firstRequest = request();
  const a = await manager.create(firstRequest);
  const b = await manager.create(request());
  const c = await manager.create(request({ ownerId: 'other' }));
  const d = await manager.create(request({ ownerId: 'third' }));
  assert.equal((await manager.create(firstRequest)).id, a.id);
  while (starts.length < 2) await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(starts, [a.id, c.id]);
  assert.equal((await manager.get(b.id, 'owner')).status, 'queued');
  assert.equal((await manager.get(d.id, 'third')).status, 'queued');
  releases.get(a.id).resolve();
  await settled(manager, a.id);
  while (starts.length < 3) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(starts[2], b.id);
  releases.get(c.id).resolve();
  await settled(manager, c.id, 'other');
  while (starts.length < 4) await new Promise((resolve) => setImmediate(resolve));
  releases.get(b.id).resolve(); releases.get(d.id).resolve();
  await Promise.all([settled(manager, b.id), settled(manager, d.id, 'third')]);
  assert.equal(starts.length, 4);
});

test('queued missions can pause and cancel before execution', async (t) => {
  const started = deferred();
  let executions = 0;
  const { manager } = await setup(t, async (record, { signal }) => { executions++; started.resolve(); return abortable(signal); });
  const running = await manager.create(request()); await started.promise;
  const queued = await manager.create(request());
  assert.equal((await manager.pause(queued.id, 'owner')).status, 'paused');
  assert.equal((await manager.cancel(queued.id, 'owner')).status, 'cancelled');
  await manager.cancel(running.id, 'owner');
  assert.equal(executions, 1);
});

test('execution time limits pause resumably with a visible reason', async (t) => {
  const { manager } = await setup(t, (record, { signal }) => abortable(signal), { timeoutMs: 20 });
  const created = await manager.create(request());
  const paused = await settled(manager, created.id);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.canResume, true);
  assert.match(paused.error, /time limit/);
});

test('restart recovery pauses running work and resumes from stored context/checkpoint', async (t) => {
  const { manager, store, directory } = await setup(t, async (record) => ({ reply: 'unused' }));
  await manager.close();
  const record = await store.create(request());
  await store.update(record.id, (draft) => {
    draft.status = 'running'; draft.context = { systemPrompt: 'Private retained context' };
    draft.checkpoint = savedCheckpoint({ round: 3, reply: 'Previous' });
  });
  const previousRevision = (await manager.get(record.id, 'owner')).revision;
  const restarted = createMissionManager({ store: createMissionStore({ directory }), execute: async (raw) => {
    assert.equal(raw.context.systemPrompt, 'Private retained context');
    assert.equal(raw.checkpoint.round, 3);
    return { reply: 'Recovered after restart' };
  } });
  t.after(() => restarted.close());
  const paused = await restarted.get(record.id, 'owner');
  assert.ok(paused.revision > previousRevision);
  assert.equal(paused.status, 'paused');
  assert.match(paused.recoveryReason, /server restarted/);
  await restarted.resume(record.id, 'owner');
  assert.equal((await settled(restarted, record.id)).replyText, 'Recovered after restart');
});

test('the owner receives completed audio and provider metadata without provider context', async (t) => {
  const metadata = { audioBase64: 'audio', activeVoice: 'Amy', voiceChanged: true, provider: 'bedrock', memoryStatus: 'saved', briefSummary: 'Useful summary' };
  const { manager } = await setup(t, async () => ({ reply: 'Done', ...metadata }));
  const record = await manager.create(request());
  const result = await settled(manager, record.id);
  for (const [key, value] of Object.entries(metadata)) assert.equal(result[key], value);
  assert.equal(result.context, undefined);
});

test('simultaneous pause and cancel serialize and leave a cancelled mission terminal', async (t) => {
  const started = deferred();
  let executions = 0;
  const { manager } = await setup(t, (record, { signal }) => { executions++; started.resolve(); return abortable(signal); });
  const record = await manager.create(request());
  await started.promise;
  await Promise.all([manager.pause(record.id, 'owner'), manager.cancel(record.id, 'owner')]);
  assert.equal((await manager.get(record.id, 'owner')).status, 'cancelled');
  assert.equal(executions, 1);
  await assert.rejects(manager.resume(record.id, 'owner'), { status: 409 });
});

test('shutdown preserves a cancellation already waiting for the active execution to stop', async (t) => {
  const started = deferred();
  const cancellationSeen = deferred();
  const releaseAbort = deferred();
  const { manager } = await setup(t, (record, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => {
      cancellationSeen.resolve();
      releaseAbort.promise.then(() => { const error = new Error('Stopped'); error.name = 'AbortError'; reject(error); });
    }, { once: true });
    started.resolve();
  }));
  const record = await manager.create(request());
  await started.promise;
  const cancelling = manager.cancel(record.id, 'owner');
  await cancellationSeen.promise;
  const closing = manager.close();
  await Promise.resolve();
  releaseAbort.resolve();
  await Promise.all([cancelling, closing]);
  const result = await manager.get(record.id, 'owner');
  assert.equal(result.status, 'cancelled');
  assert.equal(result.canResume, false);
});

test('a pending queued pause cannot be overtaken by the worker draining another completed mission', async (t) => {
  const firstStarted = deferred();
  const finishFirst = deferred();
  let executions = 0;
  const { manager, store } = await setup(t, async () => { executions++; firstStarted.resolve(); await finishFirst.promise; return { reply: 'Done' }; });
  const first = await manager.create(request());
  await firstStarted.promise;
  const queued = await manager.create(request());
  const originalUpdate = store.update;
  const pauseEntered = deferred();
  const allowPauseSave = deferred();
  let intercept = true;
  store.update = async (id, mutator) => {
    if (id === queued.id && intercept) {
      const draft = await store.get(id, 'owner');
      await mutator(draft);
      if (draft.status === 'paused') { intercept = false; pauseEntered.resolve(); await allowPauseSave.promise; }
    }
    return originalUpdate(id, mutator);
  };
  const pausing = manager.pause(queued.id, 'owner');
  await pauseEntered.promise;
  finishFirst.resolve();
  await settled(manager, first.id);
  assert.equal(executions, 1);
  allowPauseSave.resolve();
  assert.equal((await pausing).status, 'paused');
  assert.equal(executions, 1);
});

test('a complete durable checkpoint recovers its result without executing another model round', async (t) => {
  const { manager, store, directory } = await setup(t, () => { throw new Error('Must not execute'); });
  await manager.close();
  const record = await store.create(request());
  await store.update(record.id, (draft) => {
    draft.status = 'running';
    draft.checkpoint = savedCheckpoint({ phase: 'complete', round: 2, reply: 'Already complete', widgets: [{ checklistId: 'saved' }] });
  });
  let executions = 0;
  const restarted = createMissionManager({ store: createMissionStore({ directory }), execute() { executions++; throw new Error('Must not execute'); } });
  t.after(() => restarted.close());
  const result = await restarted.get(record.id, 'owner');
  assert.equal(result.status, 'completed');
  assert.equal(result.replyText, 'Already complete');
  assert.deepEqual(result.widgets, [{ checklistId: 'saved' }]);
  assert.equal(executions, 0);
});

test('storage failures stay visibly failed and resumable until a durable write succeeds', async (t) => {
  const started = deferred();
  const proceed = deferred();
  let executions = 0;
  const { manager, store } = await setup(t, async (record, { onCheckpoint }) => {
    executions++;
    if (executions === 1) {
      started.resolve(); await proceed.promise;
      await onCheckpoint({ round: 1, phase: 'complete', calls: [], widgets: [], reply: 'Unsaved result' });
    }
    return { reply: 'Saved result' };
  });
  const requestParams = request();
  const record = await manager.create(requestParams);
  await started.promise;
  const originalUpdate = store.update;
  store.update = async () => { throw new Error('EIO C:/PRIVATE/PATH/mission.json'); };
  proceed.resolve();
  const result = await settled(manager, record.id);
  assert.equal(result.status, 'failed');
  assert.equal(result.canResume, true);
  assert.doesNotMatch(result.error, /PRIVATE|mission.json/);
  assert.equal((await manager.get(record.id, 'owner')).status, 'failed');
  assert.equal((await manager.list('owner'))[0].status, 'failed');
  assert.equal((await manager.create(requestParams)).status, 'failed');
  store.update = originalUpdate;
  await manager.resume(record.id, 'owner');
  assert.equal((await settled(manager, record.id)).replyText, 'Saved result');
  assert.equal(executions, 2);
});

test('live chunks, checkpoints, and terminal snapshots have strictly increasing revisions', async (t) => {
  const started = deferred();
  const release = deferred();
  const { manager } = await setup(t, async (record, { onEvent, onCheckpoint }) => {
    started.resolve(); await release.promise;
    onEvent({ type: 'token', token: 'First ' });
    onEvent({ type: 'token', token: 'second' });
    await onCheckpoint({ round: 1, phase: 'complete', reply: 'First second', calls: [], widgets: [] });
    return { reply: 'First second' };
  });
  const record = await manager.create(request());
  await started.promise;
  const revisions = [];
  const stop = await manager.subscribe(record.id, 'owner', (snapshot) => revisions.push(snapshot.revision));
  release.resolve();
  await settled(manager, record.id);
  stop();
  assert.ok(revisions.length >= 5);
  for (let i = 1; i < revisions.length; i++) assert.ok(revisions[i] > revisions[i - 1], `Revision ${revisions[i]} must exceed ${revisions[i - 1]}`);
});

test('checkpoint and following widget events deduplicate every real artifact identifier', async (t) => {
  const started = deferred();
  const finish = deferred();
  const widgets = [
    { checklistId: 'checklist' }, { scheduleId: 'schedule' }, { budgetId: 'budget' },
    { comparisonId: 'comparison' }, { briefId: 'brief' }, { widgetType: 'pdf_document', fileName: 'report.pdf' }
  ];
  const { manager } = await setup(t, async (record, { onEvent, onCheckpoint }) => {
    await onCheckpoint({ round: 1, phase: 'model', reply: 'Saved', calls: [], widgets });
    for (const widget of widgets) onEvent({ type: 'widget', widget });
    started.resolve(); await finish.promise;
    return { reply: 'Done', widgets: [...widgets, ...widgets] };
  });
  const record = await manager.create(request());
  await started.promise;
  assert.equal((await manager.get(record.id, 'owner')).widgets.length, widgets.length);
  finish.resolve();
  assert.equal((await settled(manager, record.id)).widgets.length, widgets.length);
});
