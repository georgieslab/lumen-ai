import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMissionSnapshot, controlMissionRun, createMissionRun, getMissionRun, isMissionActive, listMissionRuns, watchMissionRun } from '../src/services/missionRuns.js';
import { restoreConversationMessages } from '../src/services/conversationHistory.js';

const base = { id: 'run-one', title: 'Trip plan', status: 'running', replyText: 'Planning', widgets: [], toolsUsed: [], webSources: [], revision: 1, createdAt: 100, updatedAt: 200, checkpoint: { round: 0, toolCalls: 0 } };
const sse = events => new Response(new ReadableStream({ start(controller) {
  const data = events.map(event => `data: ${JSON.stringify(event)}\r\n\r\n`).join('');
  // Split UTF-8 and SSE framing across chunks to exercise recovery framing.
  const bytes = new TextEncoder().encode(data);
  for (let index = 0; index < bytes.length; index += 7) controller.enqueue(bytes.slice(index, index + 7));
  controller.close();
} }), { headers: { 'Content-Type': 'text/event-stream' } });

test('mission creation sends an owner credential and bounded artifact history with the same recovery ID', async () => {
  const requests = [];
  const payload = { requestId: 'stable-uuid', transcript: 'Plan my trip', history: [{ role: 'assistant', image: 'private-image', widgets: [{ widgetType: 'checklist', title: 'Packing', items: [{ text: 'Passport', completed: true }] }] }] };
  const fetchImpl = async (url, options) => { requests.push({ url, ...options }); return Response.json({ mission: base }); };
  await createMissionRun(payload, { fetchImpl });
  await createMissionRun(payload, { fetchImpl });
  assert.equal(requests[0].url, '/api/missions/session');
  assert.equal(requests[1].url, '/api/missions');
  assert.equal(requests[0].credentials, 'include');
  assert.equal(requests[1].body, requests[3].body, 'recovery uses identical input, never a new prompt ID');
  const sent = JSON.parse(requests[1].body);
  assert.equal(sent.requestId, 'stable-uuid');
  assert.match(sent.history[0].text, /Current artifact state/);
  assert.doesNotMatch(requests[1].body, /private-image/);
});

test('a failed owner-cookie handshake cannot start a mission', async () => {
  const calls = [];
  await assert.rejects(createMissionRun({ requestId: 'stable-uuid', transcript: 'Plan my trip' }, { fetchImpl: async (url) => {
    calls.push(url);
    return Response.json({ error: 'Session unavailable' }, { status: 503 });
  } }), /Session unavailable/);
  assert.deepEqual(calls, ['/api/missions/session']);
});

test('snapshot replacement survives repeated delivery and preserves local widget edits', () => {
  const widget = { widgetType: 'checklist', checklistId: 'trip', items: [{ text: 'Passport', completed: false }] };
  const message = { id: 'assistant', role: 'assistant', widgets: [{ ...widget, editedAt: 222, items: [{ text: 'Passport', completed: true }] }] };
  const first = applyMissionSnapshot(message, { ...base, widgets: [widget] });
  const second = applyMissionSnapshot(first, { ...base, replyText: 'Planning complete', revision: 2, status: 'completed', widgets: [widget] });
  const repeated = applyMissionSnapshot(second, second.serverMission);
  assert.equal(repeated.text, 'Planning complete');
  assert.equal(repeated.widgets.length, 1);
  assert.equal(repeated.widgets[0].items[0].completed, true);
  assert.equal(repeated.isStreaming, false);
  assert.equal(repeated.serverMissionId, 'run-one');
  assert.equal(applyMissionSnapshot(second, base), second, 'old revision cannot roll back progress');
  assert.equal(applyMissionSnapshot(second, { ...base, id: 'other' }), second, 'another run cannot overwrite this message');
});

test('completed activity accepts ISO timestamps and avoids persisting generated speech', () => {
  const message = applyMissionSnapshot({ id: 'assistant' }, { ...base, status: 'completed',
    createdAt: '2026-10-17T10:00:00.000Z', updatedAt: '2026-10-17T10:00:07.500Z',
    toolsUsed: [{ name: 'compute', status: 'success', summary: 'EUR 1200 total' }],
    audioBase64: 'temporary-polly-audio', voiceChanged: 'Joanna', memoryStatus: { saved: 1 }
  });
  assert.equal(message.activity.durationMs, 7500);
  assert.equal(message.activity.steps[0].meta.summary, 'EUR 1200 total');
  assert.equal(message.serverMission.voiceChanged, 'Joanna');
  assert.equal(message.serverMission.memoryStatus.saved, 1);
  assert.ok(!JSON.stringify(message).includes('temporary-polly-audio'));
});

test('reloading durable work releases the browser controls without marking the server run stopped', () => {
  const [restored] = restoreConversationMessages([{ id: 'assistant', text: 'Planning', serverMissionId: base.id, serverMission: base, isStreaming: true, missionActionPending: true }]);
  assert.equal(restored.isStreaming, false);
  assert.equal(restored.missionActionPending, false);
  assert.equal(restored.serverMission.status, 'running');
  assert.equal(restored.isStopped, undefined);
  assert.match(restored.missionConnectionError, /Reconnecting/);
});

test('credentialed SSE reconnect replaces partial text and stops at a resumable checkpoint', async () => {
  const snapshots = [];
  let request;
  const paused = { ...base, status: 'paused', canResume: true, replyText: 'Saved so far', revision: 3 };
  const result = await watchMissionRun(base.id, snapshot => snapshots.push(snapshot), {
    fetchImpl: async (url, options) => { request = { url, ...options }; return sse([
      { type: 'snapshot', mission: base },
      { type: 'snapshot', mission: { ...base, replyText: 'Planning more', revision: 2 } },
      { type: 'snapshot', mission: paused }
    ]); }
  });
  assert.equal(request.credentials, 'include');
  assert.equal(request.headers.Accept, 'text/event-stream');
  assert.equal(snapshots.length, 3);
  assert.equal(result, snapshots[2]);
  assert.equal(result.status, 'paused');
  assert.equal(result.canResume, true);
});

test('an unexpectedly closed stream requests recovery without creating or cancelling a mission', async () => {
  const calls = [];
  await assert.rejects(watchMissionRun(base.id, () => {}, { fetchImpl: async (url, options) => {
    calls.push({ url, method: options.method || 'GET' });
    return sse([{ type: 'snapshot', mission: base }]);
  } }), /continues on the server/);
  assert.deepEqual(calls, [{ url: '/api/missions/run-one/events', method: 'GET' }]);
});

test('explicit resume uses the existing mission ID then watches the recovered run', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, ...options });
    if (url.endsWith('/events')) return sse([{ type: 'snapshot', mission: { ...base, revision: 5, status: 'completed', replyText: 'Done' } }]);
    return Response.json({ mission: { ...base, revision: 4 } });
  };
  const resumed = await controlMissionRun(base.id, 'resume', { fetchImpl });
  assert.equal(isMissionActive(resumed), true);
  const completed = await watchMissionRun(resumed.id, () => {}, { fetchImpl });
  assert.equal(completed.status, 'completed');
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].url, '/api/missions/run-one/resume');
  assert.ok(requests.every(request => request.credentials === 'include'));
  assert.equal(requests.filter(request => request.url === '/api/missions').length, 0);
});

test('pause and cancel require explicit POSTs while a disconnected viewer only aborts its fetch', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, ...options });
    return Response.json({ mission: { ...base, status: url.endsWith('/pause') ? 'paused' : 'cancelled' } });
  };
  await controlMissionRun(base.id, 'pause', { fetchImpl });
  await controlMissionRun(base.id, 'cancel', { fetchImpl });
  assert.deepEqual(requests.map(({ url, method }) => ({ url, method })), [
    { url: '/api/missions/run-one/pause', method: 'POST' },
    { url: '/api/missions/run-one/cancel', method: 'POST' }
  ]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(watchMissionRun(base.id, () => {}, { signal: controller.signal, fetchImpl: async (url, options) => {
    assert.equal(options.signal.aborted, true);
    assert.equal(options.method, undefined);
    throw new DOMException('Disconnected', 'AbortError');
  } }), { name: 'AbortError' });
});

test('list/read failures surface server messages and invalid actions make no request', async () => {
  const fetchImpl = async () => Response.json({ error: 'Saved mission is unavailable' }, { status: 404 });
  await assert.rejects(getMissionRun('missing', { fetchImpl }), /Saved mission is unavailable/);
  await assert.rejects(listMissionRuns({ fetchImpl }), /Saved mission is unavailable/);
  await assert.rejects(controlMissionRun('id', 'delete', { fetchImpl: () => assert.fail('must not call') }), /Unknown mission action/);
});
