import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createMissionStore, isMissionId } from '../services/missionStore.js';

async function setup(t, options = {}) {
  const scratch = path.resolve('scratch');
  await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(path.join(scratch, 'lumen-missions-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, store: createMissionStore({ directory, ...options }) };
}
const request = (overrides = {}) => ({ ownerId: 'owner', requestId: randomUUID(), input: { transcript: 'Plan a conference trip.' }, ...overrides });
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

test('mission records persist across stores with atomic files and revisions', async (t) => {
  const { directory, store } = await setup(t);
  const created = await store.create(request());
  assert.equal(isMissionId(created.id), true);
  assert.equal(created.revision, 1);
  const updated = await store.update(created.id, (record) => { record.status = 'paused'; record.title = 'Conference'; });
  assert.equal(updated.revision, 2);
  assert.equal(created.status, 'queued');
  const restored = await createMissionStore({ directory }).get(created.id, 'owner');
  assert.deepEqual(restored, updated);
  assert.deepEqual(await readdir(directory), [`${created.id}.json`]);
  assert.equal(JSON.parse(await readFile(path.join(directory, `${created.id}.json`), 'utf8')).title, 'Conference');
});

test('request deduplication is atomic and compares canonical input without charging another slot', async (t) => {
  const { store } = await setup(t, { maxPerOwner: 1 });
  const requestId = randomUUID();
  const [first, second] = await Promise.all([
    store.create(request({ requestId, input: { transcript: 'Same', options: { a: 1, b: 2 } } })),
    store.create(request({ requestId, input: { options: { b: 2, a: 1 }, transcript: 'Same' } }))
  ]);
  assert.equal(first.id, second.id);
  await assert.rejects(store.create(request({ requestId, input: { transcript: 'Changed' } })), { status: 409 });
  await assert.rejects(store.create(request()), { status: 429 });
  const anotherOwner = await store.create(request({ ownerId: 'another', requestId }));
  assert.notEqual(anotherOwner.id, first.id);
});

test('missions are owner scoped and IDs never become arbitrary paths', async (t) => {
  const { store } = await setup(t);
  const created = await store.create(request());
  assert.equal(await store.get(created.id, 'stranger'), null);
  assert.deepEqual(await store.list('stranger'), []);
  for (const id of ['../outside', '../../secret.json', `${created.id}/../../anything`, '', null]) {
    await assert.rejects(store.get(id, 'owner'), { status: 400 });
    await assert.rejects(store.update(id, () => {}), { status: 400 });
  }
  const result = await store.get(created.id, 'owner');
  result.input.transcript = 'Changed outside the store';
  assert.equal((await store.get(created.id, 'owner')).input.transcript, 'Plan a conference trip.');
});

test('concurrent updates preserve checkpoints and protect immutable ownership', async (t) => {
  const { store } = await setup(t);
  const created = await store.create(request());
  await Promise.all(Array.from({ length: 8 }, () => store.update(created.id, (record) => {
    record.ownerId = 'attacker'; record.id = randomUUID(); record.createdAt = 'yesterday';
    record.count = (record.count || 0) + 1;
  })));
  const result = await store.get(created.id, 'owner');
  assert.equal(result.count, 8);
  assert.equal(result.revision, 9);
  assert.equal(result.createdAt, created.createdAt);
  assert.equal(await store.get(created.id, 'attacker'), null);
});

test('oversized input/checkpoints are rejected without corrupting the previous record', async (t) => {
  const { store, directory } = await setup(t, { maxInputBytes: 100, maxRecordBytes: 2048 });
  await assert.rejects(store.create(request({ input: { transcript: 'x'.repeat(200) } })), { status: 413 });
  const created = await store.create(request());
  await assert.rejects(store.update(created.id, (record) => { record.checkpoint = { text: 'x'.repeat(3000) }; }), { status: 413 });
  assert.equal((await store.get(created.id, 'owner')).revision, 1);
  assert.deepEqual(await readdir(directory), [`${created.id}.json`]);
});

test('restart recovery pauses unfinished work and retains complete checkpoints', async (t) => {
  const { store, directory } = await setup(t);
  const pending = await store.create(request());
  const finished = await store.create(request());
  await store.update(pending.id, (record) => { record.status = 'pausing'; record.checkpoint = savedCheckpoint({ round: 2 }); });
  await store.update(finished.id, (record) => {
    record.status = 'running'; record.checkpoint = savedCheckpoint({ phase: 'complete', round: 1, reply: 'Done', widgets: [{ id: 'a' }] });
  });
  const recoveredStore = createMissionStore({ directory });
  const recovered = await recoveredStore.recover();
  const incomplete = recovered.find((record) => record.id === pending.id);
  assert.equal(incomplete.status, 'paused');
  assert.match(incomplete.recoveryReason, /server restarted/);
  assert.equal(incomplete.checkpoint.round, 2);
  const complete = recovered.find((record) => record.id === finished.id);
  assert.equal(complete.status, 'completed');
  assert.equal(complete.result.reply, 'Done');
  assert.deepEqual(complete.result.widgets, [{ id: 'a' }]);
});

test('unrelated corrupt files cannot prevent loading valid missions', async (t) => {
  const { directory, store } = await setup(t);
  const created = await store.create(request());
  await writeFile(path.join(directory, `${randomUUID()}.json`), '{broken');
  await writeFile(path.join(directory, 'unrelated.json'), '{}');
  assert.equal((await createMissionStore({ directory }).list('owner')).length, 1);
  assert.equal((await createMissionStore({ directory }).get(created.id, 'owner')).id, created.id);
});

test('valid JSON with invalid metadata, result shapes, or forged complete checkpoints is skipped', async (t) => {
  const { directory, store } = await setup(t);
  const healthy = await store.create(request());
  const invalidRecords = [
    { version: 1, ownerId: 'owner', status: 'queued' },
    { ...healthy, result: { ...healthy.result, widgets: 'not an array' } },
    { ...healthy, result: { ...healthy.result, tools: [null] } },
    { ...healthy, revision: '1' },
    { ...healthy, createdAt: null },
    { ...healthy, status: 'running', checkpoint: { phase: 'complete' } },
    { ...healthy, status: 'running', checkpoint: { ...savedCheckpoint({ phase: 'complete' }), calls: [{ name: 'compute' }] } }
  ];
  const badIds = [];
  for (const bad of invalidRecords) {
    bad.id = randomUUID(); bad.requestId = randomUUID(); badIds.push(bad.id);
    await writeFile(path.join(directory, `${bad.id}.json`), JSON.stringify(bad));
  }
  const restored = createMissionStore({ directory });
  assert.deepEqual((await restored.list('owner')).map((record) => record.id), [healthy.id]);
  for (const id of badIds) assert.equal(await restored.get(id, 'owner'), null);
  assert.equal((await restored.recover()).length, 1);
});
