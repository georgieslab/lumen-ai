import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createWatchStore } from '../services/watchStore.js';
import { createWatchManager } from '../services/watchManager.js';

const request = (overrides = {}) => ({ ownerId: 'owner', requestId: randomUUID(), kind: 'url', target: 'https://example.com/updates', title: 'Product updates', intervalMs: 900000, ...overrides });
const observation = text => ({ text, title: 'Product updates', url: 'https://example.com/updates', sources: [{ title: 'Updates', url: 'https://example.com/updates' }] });
const deferred = () => { let resolve; const promise = new Promise(finish => { resolve = finish; }); return { promise, resolve }; };
async function setup(t, observe, options = {}) {
  await mkdir('scratch', { recursive: true });
  const directory = await mkdtemp(path.resolve('scratch/lumen-watches-'));
  let time = Date.UTC(2026, 9, 17, 12);
  const now = () => time;
  const store = createWatchStore({ directory, now });
  const manager = createWatchManager({ store, observe, now, pollIntervalMs: 0, ...options });
  await manager.ready;
  t.after(async () => { await manager.close(); await rm(directory, { recursive: true, force: true }); });
  return { manager, store, directory, now, advance: ms => { time += ms; } };
}
const check = (manager, id, ownerId = 'owner', requestId = randomUUID()) => manager.check(id, ownerId, { requestId });

test('baseline and unchanged checks stay quiet; only a confirmed text change creates an in-app notification', async t => {
  let text = 'Release one is available.';
  const { manager, store } = await setup(t, async () => observation(text));
  const created = await manager.create(request()); await manager.idle();
  let watch = await manager.get(created.id, 'owner');
  assert.equal(watch.baselineReady, true);
  assert.equal(watch.notificationChannel, 'in_app');
  assert.equal(watch.runsWhileServerOnline, true);
  assert.deepEqual(await manager.notifications('owner'), []);
  text = '  Release\n one  is available. ';
  await check(manager, created.id);
  assert.deepEqual(await manager.notifications('owner'), []);
  text = 'Release two is available.';
  watch = await check(manager, created.id);
  const notices = await manager.notifications('owner');
  assert.equal(notices.length, 1);
  assert.equal(notices[0].channel, 'in_app');
  assert.equal(notices[0].readAt, null);
  assert.match(watch.latestChange.before, /one/);
  assert.match(watch.latestChange.after, /two/);
  assert.equal(watch.lastChangedAt, notices[0].createdAt);
  assert.doesNotMatch(JSON.stringify(watch), /ownerId|inputHash|"hash"|"baseline"|requests/);
  assert.equal((await store.get(created.id, 'owner')).baseline.text, text);
  const acknowledged = await manager.acknowledge(notices[0].id, 'owner');
  assert.ok(acknowledged.readAt);
  await assert.rejects(manager.acknowledge(notices[0].id, 'other'), { status: 404 });
});

test('a failed or empty fetch retains its last good baseline, alerts nobody, and backs off', async t => {
  let failure = null;
  const { manager, store, now } = await setup(t, async () => { if (failure instanceof Error) throw failure; return observation(failure === 'empty' ? '' : 'Confirmed baseline'); });
  const created = await manager.create(request()); await manager.idle();
  const baseline = (await store.get(created.id, 'owner')).baseline;
  failure = new Error('The page could not be fetched');
  let watch = await check(manager, created.id);
  assert.match(watch.error, /could not be fetched/);
  assert.equal(Date.parse(watch.nextCheckAt), now() + 2 * 900000);
  assert.deepEqual((await store.get(created.id, 'owner')).baseline, baseline);
  failure = 'empty';
  watch = await check(manager, created.id);
  assert.match(watch.error, /no readable content/);
  assert.equal(Date.parse(watch.nextCheckAt), now() + 4 * 900000);
  assert.deepEqual((await store.get(created.id, 'owner')).baseline, baseline);
  assert.deepEqual(await manager.notifications('owner'), []);
  failure = null;
  watch = await check(manager, created.id);
  assert.equal(watch.error, null);
  assert.equal(Date.parse(watch.nextCheckAt), now() + 900000);
});

test('durable scheduling waits for the saved due time and runs overdue watches after restart', async t => {
  let executions = 0;
  const { manager, directory, now, advance } = await setup(t, async () => { executions++; return observation('Stable'); });
  const created = await manager.create(request()); await manager.idle();
  assert.equal(executions, 1);
  advance(899999); await manager.tick(); await manager.idle(); assert.equal(executions, 1);
  await manager.close(); advance(2);
  assert.equal(executions, 1, 'No process means no scheduled execution');
  const restarted = createWatchManager({ store: createWatchStore({ directory, now }), now, pollIntervalMs: 0,
    observe: async () => { executions++; return observation('Stable'); } });
  t.after(() => restarted.close());
  await restarted.ready; await restarted.idle();
  assert.equal(executions, 2);
  assert.equal((await restarted.get(created.id, 'owner')).baselineReady, true);
  assert.deepEqual(await restarted.notifications('owner'), []);
});

test('UUID manual checks are single-flight and remain deduplicated after completion and restart', async t => {
  let executions = 0;
  let blocker = null;
  const { manager, directory, now } = await setup(t, async () => { executions++; if (blocker) await blocker.promise; return observation('Stable'); });
  const created = await manager.create(request()); await manager.idle();
  blocker = deferred();
  const requestId = randomUUID();
  const a = check(manager, created.id, 'owner', requestId);
  const b = check(manager, created.id, 'owner', requestId);
  while (executions < 2) await new Promise(resolve => setImmediate(resolve));
  blocker.resolve(); await Promise.all([a, b]);
  assert.equal(executions, 2);
  await check(manager, created.id, 'owner', requestId); assert.equal(executions, 2);
  await manager.close();
  const restarted = createWatchManager({ store: createWatchStore({ directory, now }), now, pollIntervalMs: 0, observe: async () => { executions++; return observation('Stable'); } });
  t.after(() => restarted.close()); await restarted.ready;
  await check(restarted, created.id, 'owner', requestId); assert.equal(executions, 2);
});

test('pause, manual check, baseline reset, interval edits, resume, and archive have distinct behavior', async t => {
  let text = 'Initial'; let executions = 0;
  const { manager, now, advance } = await setup(t, async () => { executions++; return observation(text); });
  const created = await manager.create(request()); await manager.idle();
  let watch = await manager.pause(created.id, 'owner');
  assert.equal(watch.status, 'paused'); assert.equal(watch.nextCheckAt, null);
  advance(900000); await manager.tick(); await manager.idle(); assert.equal(executions, 1);
  await check(manager, created.id); assert.equal(executions, 2);
  watch = await manager.update(created.id, 'owner', { title: 'Renamed', intervalMs: 3600000, resetBaseline: true });
  assert.equal(watch.baselineReady, false);
  assert.equal(watch.nextCheckAt, null);
  text = 'Reset baseline'; await check(manager, created.id);
  assert.deepEqual(await manager.notifications('owner'), []);
  await manager.resume(created.id, 'owner'); await manager.idle();
  watch = await manager.get(created.id, 'owner');
  assert.equal(watch.intervalMs, 3600000);
  assert.equal(Date.parse(watch.nextCheckAt), now() + 3600000);
  await assert.rejects(manager.update(created.id, 'owner', { target: 'https://other.example' }), { status: 400 });
  watch = await manager.archive(created.id, 'owner');
  assert.equal(watch.status, 'archived');
  await assert.rejects(manager.resume(created.id, 'owner'), { status: 409 });
  await assert.rejects(check(manager, created.id), { status: 409 });
});

test('only two observations run concurrently and each watch has one in-flight check', async t => {
  const release = deferred();
  let active = 0; let maximum = 0; let starts = 0;
  const { manager, store } = await setup(t, async () => { starts++; active++; maximum = Math.max(maximum, active); await release.promise; active--; return observation('Stable'); });
  const watches = await Promise.all([manager.create(request()), manager.create(request()), manager.create(request())]);
  while (starts < 2) await new Promise(resolve => setImmediate(resolve));
  assert.equal(starts, 2);
  const manual = check(manager, watches[0].id);
  while (!(await store.get(watches[0].id, 'owner')).requests.length) await new Promise(resolve => setImmediate(resolve));
  release.resolve(); await manual; await manager.idle();
  assert.equal(starts, 3);
  assert.equal(maximum, 2);
});

test('watch ownership applies to every control and notification access', async t => {
  let text = 'Before';
  const { manager } = await setup(t, async () => observation(text));
  const created = await manager.create(request()); await manager.idle();
  assert.deepEqual(await manager.list('other'), []);
  await assert.rejects(manager.get(created.id, 'other'), { status: 404 });
  await assert.rejects(manager.pause(created.id, 'other'), { status: 404 });
  await assert.rejects(manager.update(created.id, 'other', { title: 'Stolen' }), { status: 404 });
  await assert.rejects(check(manager, created.id, 'other'), { status: 404 });
  text = 'After'; await check(manager, created.id);
  assert.equal((await manager.notifications('owner')).length, 1);
  assert.deepEqual(await manager.notifications('other'), []);
});

test('shutdown prevents a scheduler read already in flight from starting an observation afterward', async t => {
  const { manager, store } = await setup(t, async () => observation('Unused'));
  await manager.close();
  await store.create(request());
  const reading = deferred(); const release = deferred();
  const originalAll = store.all;
  store.all = async () => { reading.resolve(); await release.promise; return originalAll(); };
  let observations = 0;
  const restarted = createWatchManager({ store, pollIntervalMs: 0, observe: async () => { observations++; return observation('Must not run'); } });
  await restarted.ready; await reading.promise;
  await restarted.close(); release.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(observations, 0);
});
