import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { createWatchStore } from '../services/watchStore.js';
import { createWatchManager } from '../services/watchManager.js';
import { createWatchRouter } from '../services/watchRoutes.js';

const cookie = `lumen_mission_owner=${'a'.repeat(43)}`;
async function fixture(t) {
  await mkdir('scratch', { recursive: true });
  const directory = await mkdtemp(path.resolve('scratch/lumen-watch-routes-'));
  let content = 'Before'; let limits = 0;
  const manager = createWatchManager({ store: createWatchStore({ directory }), pollIntervalMs: 0,
    observe: async () => ({ text: content, title: 'Updates', url: 'https://example.com/updates' }) });
  await manager.ready;
  const app = express(); app.use(express.json());
  app.use('/api/missions', createWatchRouter({ manager, watchLimit: (_req, _res, next) => { limits++; next(); } }));
  app.get('/api/missions/ordinary-mission', (_req, res) => res.json({ ordinary: true }));
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const call = (route, { method = 'GET', body, identity = cookie, trusted = true } = {}) => fetch(`${origin}/api/missions${route}`, {
    method, headers: { ...(identity ? { Cookie: identity } : {}), ...(trusted ? { Origin: origin } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await manager.close(); await rm(directory, { recursive: true, force: true }); });
  return { call, manager, limits: () => limits, change: value => { content = value; } };
}
const input = () => ({ requestId: randomUUID(), kind: 'url', target: 'https://example.com/updates', title: 'Updates', intervalMs: 900000 });

test('watch routes use an existing owner cookie and enforce origin checks without minting another identity', async t => {
  const { call } = await fixture(t);
  const missing = await call('/watches', { method: 'POST', body: input(), identity: null });
  assert.equal(missing.status, 404); assert.equal(missing.headers.get('set-cookie'), null);
  const untrusted = await call('/watches', { method: 'POST', body: input(), trusted: false });
  assert.equal(untrusted.status, 403);
  assert.deepEqual(await (await call('/watches', { identity: null })).json(), { watches: [] });
  assert.deepEqual(await (await call('/notifications', { identity: null })).json(), { notifications: [] });
  assert.deepEqual(await (await call('/ordinary-mission')).json(), { ordinary: true });
});

test('owner-scoped CRUD, UUID check retries, and notifications work through the HTTP contract', async t => {
  const { call, manager, change, limits } = await fixture(t);
  const response = await call('/watches', { method: 'POST', body: input() });
  assert.equal(response.status, 202);
  const { watch } = await response.json(); await manager.idle();
  assert.equal((await (await call('/watches')).json()).watches.length, 1);
  assert.equal((await call(`/watches/${watch.id}`, { identity: `lumen_mission_owner=${'b'.repeat(43)}` })).status, 404);
  assert.equal((await call(`/watches/${watch.id}/check`, { method: 'POST', body: {} })).status, 400);
  change('After');
  const requestId = randomUUID();
  assert.equal((await call(`/watches/${watch.id}/check`, { method: 'POST', body: { requestId } })).status, 200);
  assert.equal((await call(`/watches/${watch.id}/check`, { method: 'POST', body: { requestId } })).status, 200);
  const { notifications } = await (await call('/notifications')).json();
  assert.equal(notifications.length, 1); assert.equal(notifications[0].channel, 'in_app');
  const acknowledged = await (await call(`/notifications/${notifications[0].id}/read`, { method: 'POST' })).json();
  assert.ok(acknowledged.notification.readAt);
  assert.equal((await call(`/notifications/${notifications[0].id}/read`, { method: 'POST', identity: `lumen_mission_owner=${'b'.repeat(43)}` })).status, 404);
  assert.equal((await (await call(`/watches/${watch.id}/pause`, { method: 'POST' })).json()).watch.status, 'paused');
  const edited = await (await call(`/watches/${watch.id}`, { method: 'PATCH', body: { title: 'New name', intervalMs: 3600000 } })).json();
  assert.equal(edited.watch.title, 'New name');
  assert.equal((await (await call(`/watches/${watch.id}`, { method: 'PATCH', body: { status: 'archived' } })).json()).watch.status, 'archived');
  assert.equal((await call(`/watches/${watch.id}/resume`, { method: 'POST' })).status, 409);
  assert.ok(limits() >= 5);
});
