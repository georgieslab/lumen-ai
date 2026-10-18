import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createWatchStore, normalizeWatchRequest } from '../services/watchStore.js';

const request = (overrides = {}) => ({ ownerId: 'owner', requestId: randomUUID(), kind: 'topic', target: 'Public product releases', intervalMs: 900000, ...overrides });
const hash = value => createHash('sha256').update(value).digest('hex');
const baseline = text => ({ text, hash: hash(text), title: 'Evidence', url: 'https://example.com', sources: [] });
async function setup(t, options = {}) {
  await mkdir('scratch', { recursive: true });
  const directory = await mkdtemp(path.resolve('scratch/lumen-watch-store-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, store: createWatchStore({ directory, ...options }) };
}

test('watch input is bounded and restricted to explicit URL/topic targets and supported intervals', () => {
  const value = normalizeWatchRequest(request({ kind: 'url', target: 'https://example.com/path#section' }));
  assert.equal(value.target, 'https://example.com/path');
  for (const invalid of [
    request({ requestId: 'retry' }), request({ kind: 'email' }), request({ kind: 'url', target: 'javascript:alert(1)' }),
    request({ kind: 'url', target: 'https://user:secret@example.com/' }), request({ target: 'x'.repeat(501) }),
    request({ intervalMs: 1000 }), request({ title: 'x'.repeat(161) })
  ]) assert.throws(() => normalizeWatchRequest(invalid), { status: 400 });
});

test('creation is atomic, owner scoped, deduplicated, and limited to twenty nonarchived watches', async t => {
  const { store, directory } = await setup(t);
  const initial = request();
  const created = await store.create(initial);
  assert.equal((await store.create(initial)).id, created.id);
  await assert.rejects(store.create({ ...initial, target: 'Different topic' }), { status: 409 });
  const attempts = await Promise.allSettled(Array.from({ length: 20 }, () => store.create(request())));
  assert.equal(attempts.filter(value => value.status === 'fulfilled').length, 19);
  assert.equal(attempts.filter(value => value.status === 'rejected')[0].reason.status, 429);
  await store.update(created.id, 'owner', watch => { watch.status = 'archived'; watch.nextCheckAt = null; });
  await store.create(request());
  assert.equal((await store.list('owner')).length, 21);
  assert.equal(await store.get(created.id, 'other'), null);
  await assert.rejects(store.update(created.id, 'other', () => {}), { status: 404 });
  const other = await store.create(request({ ownerId: 'other' }));
  assert.equal((await store.list('other')).length, 1);
  assert.equal((await createWatchStore({ directory }).get(other.id, 'other')).target, other.target);
  assert.ok((await readdir(directory)).every(filename => /^[0-9a-f]{64}\.json$/.test(filename)));
});

test('restart recovery retains confirmed baseline and marks unfinished manual requests interrupted', async t => {
  const { store, directory } = await setup(t);
  const created = await store.create(request());
  const requestId = randomUUID();
  await store.update(created.id, 'owner', watch => {
    watch.baseline = baseline('Confirmed content'); watch.status = 'paused'; watch.nextCheckAt = null;
    watch.inFlight = { startedAt: new Date().toISOString(), manual: true };
    watch.requests.push({ id: requestId, requestedAt: new Date().toISOString(), status: 'running' });
  });
  const restarted = createWatchStore({ directory }); await restarted.recover();
  const recovered = await restarted.get(created.id, 'owner');
  assert.equal(recovered.status, 'paused'); assert.equal(recovered.inFlight, null);
  assert.equal(recovered.baseline.text, 'Confirmed content');
  assert.equal(recovered.requests[0].status, 'interrupted');
  assert.match(recovered.error, /server restarted/);
});

test('notification retention is bounded to fifty per owner and acknowledgment survives restart', async t => {
  const { store, directory } = await setup(t);
  const created = await store.create(request());
  const ids = [];
  for (let index = 0; index < 55; index++) {
    const id = randomUUID(); ids.push(id);
    await store.update(created.id, 'owner', (_watch, notifications) => notifications.push({
      id, kind: 'watch_change', channel: 'in_app', watchId: created.id, watchTitle: 'Updates',
      createdAt: new Date().toISOString(), readAt: null, summary: 'Changed', before: 'Before', after: `After ${index}`, url: 'https://example.com', sources: []
    }));
  }
  const notifications = await store.notifications('owner');
  assert.equal(notifications.length, 50);
  assert.equal(notifications[0].id, ids.at(-1));
  await store.acknowledge(ids.at(-1), 'owner');
  assert.ok((await createWatchStore({ directory }).notifications('owner'))[0].readAt);
  assert.deepEqual(await store.notifications('other'), []);
  await assert.rejects(store.acknowledge(ids.at(-1), 'other'), { status: 404 });
});

test('corrupt records and unsafe notification sources do not hide healthy watches', async t => {
  const { store, directory } = await setup(t);
  const healthy = await store.create(request());
  const filename = path.join(directory, `${hash('owner')}.json`);
  const data = JSON.parse(await readFile(filename, 'utf8'));
  data.watches.push({ ...healthy, id: randomUUID(), intervalMs: 1 });
  data.watches.push({ ...healthy, id: randomUUID(), baseline: { ...baseline('Original'), hash: hash('Corrupted') } });
  data.watches.push({ ...healthy, id: randomUUID(), nextCheckAt: null });
  data.notifications.push({ id: randomUUID(), watchId: healthy.id, kind: 'watch_change', channel: 'in_app', createdAt: new Date().toISOString(), readAt: null,
    watchTitle: 'Unsafe', summary: 'Changed', before: 'A', after: 'B', url: 'javascript:alert(1)', sources: [] });
  await writeFile(filename, JSON.stringify(data));
  await writeFile(path.join(directory, `${'a'.repeat(64)}.json`), '{bad JSON');
  const restarted = createWatchStore({ directory });
  assert.deepEqual((await restarted.list('owner')).map(watch => watch.id), [healthy.id]);
  assert.deepEqual(await restarted.notifications('owner'), []);
});

test('invalid or oversized updates leave the durable previous watch intact', async t => {
  const { store, directory } = await setup(t, { maxOwnerBytes: 1500 });
  const created = await store.create(request());
  await assert.rejects(store.update(created.id, 'owner', watch => { watch.baseline = baseline('x'.repeat(2000)); }), { status: 413 });
  const stored = await store.get(created.id, 'owner');
  assert.equal(stored.baseline, null); assert.equal(stored.revision, 1);
  await store.update(created.id, 'owner', watch => { watch.target = 'Attempted edit'; watch.ownerId = 'other'; watch.title = 'Allowed title'; });
  const restored = await createWatchStore({ directory, maxOwnerBytes: 1500 }).get(created.id, 'owner');
  assert.equal(restored.target, created.target); assert.equal(restored.ownerId, 'owner');
  assert.equal(restored.title, 'Allowed title');
  assert.ok((await readdir(directory)).every(filename => filename.endsWith('.json')));
});
