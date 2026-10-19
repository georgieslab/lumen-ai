import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { missionOwner, normalizeMissionRequest, createMissionRouter } from '../services/missionRoutes.js';
import { setSessionCookie } from '../services/authSession.js';
import { createMissionStore } from '../services/missionStore.js';
import { createMissionManager } from '../services/missionManager.js';
import { runToolLoop } from '../services/agentRunner.js';

const payload = () => ({ requestId: randomUUID(), transcript: 'Make a useful plan', timeZone: 'Europe/Vienna' });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const abortable = signal => new Promise((_resolve, reject) => {
  const abort = () => reject(Object.assign(new Error('Paused'), { name: 'AbortError' }));
  if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
});

async function fixture(t, execute = async () => ({ reply: 'Done', tools: [], widgets: [] }), projects) {
  const scratch = path.resolve('scratch');
  await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(path.join(scratch, 'lumen-mission-routes-'));
  const manager = createMissionManager({ store: createMissionStore({ directory }), execute });
  await manager.ready;
  const app = express();
  app.use(express.json());
  app.use('/api/missions', createMissionRouter({ manager, projects }));
  const server = createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await manager.close();
    // mkdtemp returns an absolute child of this workspace's ignored scratch directory.
    assert.equal(path.dirname(directory), scratch);
    await rm(directory, { recursive: true, force: true });
  });
  const request = (route, { cookie, method = 'GET', body, requestOrigin = origin, ...options } = {}) => fetch(`${origin}/api/missions${route}`, {
    ...options, method, headers: { Origin: requestOrigin, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const session = async () => {
    const response = await request('/session', { method: 'POST' });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  };
  return { manager, request, session };
}

test('mission input is bounded and validates history, recovery IDs, attachments and time zones', () => {
  const input = normalizeMissionRequest(payload());
  assert.equal(input.input.timeZone, 'Europe/Vienna');
  assert.equal(input.input.webMode, 'auto');
  for (const change of [{ requestId: 'unsafe' }, { transcript: '' }, { transcript: 'a'.repeat(10001) },
    { history: Array(9).fill({ role: 'user', text: 'x' }) }, { history: [{ role: 'system', text: 'x' }] },
    { timeZone: 'Made/Up' }, { file: { type: 'pdf' } }, { webMode: 'unsafe' }]) {
    assert.throws(() => normalizeMissionRequest({ ...payload(), ...change }), { status: 400 });
  }
});

test('saved missions preserve the normalized reply mode for execution and resume', () => {
  for (const [supplied, expected] of [['concise', 'concise'], ['balanced', 'balanced'], ['deep', 'deep'], ['bullets', 'bullets'], ['detailed', 'deep'], ['narrative', 'balanced'], ['unknown', 'concise']]) {
    const normalized = normalizeMissionRequest({ ...payload(), responseStyle: supplied });
    assert.equal(JSON.parse(JSON.stringify(normalized)).input.responseStyle, expected);
  }
  assert.throws(() => normalizeMissionRequest({ ...payload(), responseStyle: 'x'.repeat(31) }), { status: 400 });
});

test('new project missions require an active owned project and researched actions require web access', async t => {
  const projectId = randomUUID(); let projectOwner; let archived = false;
  const { request, session, manager } = await fixture(t, undefined, { get: async (id, owner) => id === projectId && owner === projectOwner ? { id, archived } : null });
  const cookie = await session();
  projectOwner = missionOwner({ headers: { cookie } }, { append() {} });
  const create = changes => request('', { method: 'POST', cookie, body: { ...payload(), projectId, ...changes } });
  const result = await create({}); assert.equal(result.status, 202);
  const mission = (await result.json()).mission;
  assert.equal(mission.projectId, projectId);
  assert.equal((await manager.getRecord(mission.id, projectOwner)).input.projectId, projectId);
  assert.equal((await create({ projectId: randomUUID() })).status, 404);
  archived = true; assert.equal((await create({})).status, 404); archived = false;
  const foreignCookie = await session();
  assert.equal((await request('', { method: 'POST', cookie: foreignCookie, body: { ...payload(), projectId } })).status, 404);
  assert.equal((await create({ actionKind: 'verify', actionData: { content: 'A claim' }, webMode: 'off' })).status, 400);
});

test('anonymous ownership uses an HttpOnly cookie and signed-in ownership takes precedence', () => {
  const values = [];
  const res = { append: (_key, value) => values.push(value) };
  assert.equal(missionOwner({ headers: {} }, res), null);
  const guest = missionOwner({ headers: {} }, res, { create: true });
  assert.match(guest, /^guest:[A-Za-z0-9_-]{43}$/);
  assert.match(values[0], /HttpOnly; SameSite=/);
  const cookie = values[0].split(';')[0];
  assert.equal(missionOwner({ headers: { cookie } }, res), guest);
  const previousSecret = process.env.LUMEN_SESSION_SECRET;
  try {
    process.env.LUMEN_SESSION_SECRET = 'route-test-secret-with-at-least-32-characters';
    setSessionCookie(res, { provider: 'github', id: '123', name: 'Tester' });
    const signed = values.at(-1).split(';')[0];
    assert.equal(missionOwner({ headers: { cookie: `${cookie}; ${signed}` } }, res), 'github:123');
  } finally {
    if (previousSecret === undefined) delete process.env.LUMEN_SESSION_SECRET;
    else process.env.LUMEN_SESSION_SECRET = previousSecret;
  }
});

test('HTTP missions require confirmed ownership and trusted origin; replay creates exactly one private run', async t => {
  const { request, session } = await fixture(t);
  const body = payload();
  assert.equal((await request('', { method: 'POST', body })).status, 428);
  assert.equal((await request('/session', { method: 'POST', requestOrigin: 'https://untrusted.example' })).status, 403);
  const cookie = await session();
  const createdResponse = await request('', { cookie, method: 'POST', body });
  assert.equal(createdResponse.status, 202);
  const { mission } = await createdResponse.json();
  const replay = await request('', { cookie, method: 'POST', body });
  assert.equal((await replay.json()).mission.id, mission.id);
  assert.equal((await request('', { cookie, method: 'POST', body: { ...body, transcript: 'Changed' } })).status, 409);
  const listed = await (await request('', { cookie })).json();
  assert.equal(listed.missions.length, 1);
  assert.equal(listed.missions[0].replyText, undefined, 'list omits bulky outputs');
  const other = await session();
  for (const route of [`/${mission.id}`, `/${mission.id}/events`]) {
    assert.equal((await request(route, { cookie: other })).status, 404);
  }
  for (const action of ['pause', 'resume', 'cancel']) {
    assert.equal((await request(`/${mission.id}/${action}`, { cookie: other, method: 'POST' })).status, 404);
    assert.equal((await request(`/${mission.id}/${action}`, { cookie, method: 'POST', requestOrigin: 'https://untrusted.example' })).status, 403);
  }
  assert.deepEqual(await (await request('')).json(), { missions: [] });
});

test('closing an HTTP event stream detaches its observer while background work completes', async t => {
  const started = deferred();
  const finish = deferred();
  let aborted = false;
  const { request, session } = await fixture(t, async (_record, { signal }) => {
    signal.addEventListener('abort', () => { aborted = true; });
    started.resolve();
    await finish.promise;
    return { reply: 'Completed after disconnect', tools: [], widgets: [] };
  });
  const cookie = await session();
  const { mission } = await (await request('', { cookie, method: 'POST', body: payload() })).json();
  await started.promise;
  const response = await request(`/${mission.id}/events`, { cookie });
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader();
  const { value } = await reader.read();
  assert.match(new TextDecoder().decode(value), /"type":"snapshot"/);
  await reader.cancel();
  finish.resolve();
  for (let attempt = 0; attempt < 50; attempt++) {
    const current = await (await request(`/${mission.id}`, { cookie })).json();
    if (current.mission.status === 'completed') {
      assert.equal(current.mission.replyText, 'Completed after disconnect');
      assert.equal(aborted, false);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('background mission did not complete');
});

test('HTTP pause/resume integrates durable runner checkpoints without repeating completed tools', async t => {
  const waitingForSynthesis = deferred();
  let modelCalls = 0;
  let toolCalls = 0;
  const { request, session } = await fixture(t, (record, { signal, onEvent, onCheckpoint }) => runToolLoop({
    messages: [{ role: 'user', content: [{ text: record.input.transcript }] }], checkpoint: record.checkpoint,
    signal, onEvent, onCheckpoint, tools: [{ toolSpec: { name: 'compute' } }],
    async executeTool() { toolCalls++; return { formatted: '42' }; },
    async callModel() {
      modelCalls++;
      if (modelCalls === 1) return { stopReason: 'tool_use', message: { role: 'assistant', content: [{ toolUse: { name: 'compute', toolUseId: 'once', input: {} } }] } };
      if (modelCalls === 2) { waitingForSynthesis.resolve(); return abortable(signal); }
      return { stopReason: 'end_turn', message: { role: 'assistant', content: [{ text: 'The saved result is 42.' }] } };
    }
  }));
  const cookie = await session();
  const { mission } = await (await request('', { cookie, method: 'POST', body: payload() })).json();
  await waitingForSynthesis.promise;
  const paused = await (await request(`/${mission.id}/pause`, { cookie, method: 'POST' })).json();
  assert.equal(paused.mission.status, 'paused');
  assert.equal(paused.mission.checkpoint.toolCalls, 1);
  assert.equal(paused.mission.toolsUsed[0].status, 'success');
  await request(`/${mission.id}/resume`, { cookie, method: 'POST' });
  const response = await request(`/${mission.id}/events`, { cookie });
  const stream = await response.text();
  assert.match(stream, /"status":"completed"/);
  const complete = await (await request(`/${mission.id}`, { cookie })).json();
  assert.equal(complete.mission.replyText, 'The saved result is 42.');
  assert.equal(complete.mission.checkpoint.toolCalls, 1);
  assert.equal(toolCalls, 1);
  assert.equal(modelCalls, 3);
});
