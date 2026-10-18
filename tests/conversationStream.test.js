import test from 'node:test';
import assert from 'node:assert/strict';
import { converseWithLumenStream } from '../src/services/api.js';
import { consumeJsonEventStream } from '../src/services/eventStream.js';

const sse = (...events) => events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('');
const response = (text) => new Response(text, { headers: { 'Content-Type': 'text/event-stream' } });

test('SSE framing handles split UTF-8, CRLF, multiline data, comments and a final unterminated event', async () => {
  const bytes = new TextEncoder().encode(': keepalive\r\ndata: {"type":"token",\r\ndata: "token":"Héllo 🌍"}\r\n\r\ndata: {"type":"done"}');
  const stream = new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); } });
  const events = [];
  await consumeJsonEventStream(stream, event => events.push(event));
  assert.deepEqual(events, [{ type: 'token', token: 'Héllo 🌍' }, { type: 'done' }]);
});

test('chat forwards tool results, including a final event without a newline', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => response(sse({ type: 'tool_start', toolUseId: 't1', name: 'create_checklist' }) + 'data: {"type":"tool_result","toolUseId":"t1","status":"success","summary":"Created 3 tasks"}\n\ndata: {"type":"done","replyText":"Done"}'));
  const events = [];
  await converseWithLumenStream({ transcript: 'Make a plan', onToolStart: event => events.push(event), onToolResult: event => events.push(event), onDone: event => events.push(event) });
  assert.deepEqual(events.map(event => event.type), ['tool_start', 'tool_result', 'done']);
  assert.equal(events[1].summary, 'Created 3 tasks');
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('a done event releases a stream even when the server leaves the connection open', async (t) => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode(sse({ type: 'done', replyText: 'Complete' }))); },
    cancel() { cancelled = true; }
  });
  t.mock.method(globalThis, 'fetch', async () => new Response(stream));
  await converseWithLumenStream({ transcript: 'Hello' });
  assert.equal(cancelled, true);
});

test('a connection closing after tool execution fails without retrying or faking completion', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => response(sse({ type: 'tool_start', name: 'create_pdf_document' }, { type: 'widget', widget: { widgetType: 'pdf_document' } })));
  const errors = [];
  let completed = false;
  await assert.rejects(converseWithLumenStream({ transcript: 'Create a PDF', onDone: () => { completed = true; }, onError: error => errors.push(error) }), /connection ended/i);
  assert.equal(globalThis.fetch.mock.callCount(), 1);
  assert.equal(completed, false);
  assert.equal(errors.length, 1);
});

test('explicit server failures propagate without retrying even before output', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => response(sse({ type: 'error', error: 'Tool budget exhausted', stage: 'tools' })));
  await assert.rejects(converseWithLumenStream({ transcript: 'Run a mission' }), error => error.message === 'Tool budget exhausted' && error.stage === 'tools');
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('an accepted stream that ends without any completion is not rerun', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => response(''));
  await assert.rejects(converseWithLumenStream({ transcript: 'Run a mission' }), /connection ended/i);
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('an unavailable stream falls back with page context and artifact state intact', async (t) => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, payload: JSON.parse(options.body) });
    if (requests.length === 1) return new Response('', { status: 404 });
    return Response.json({ replyText: 'Done', widgets: [] });
  });
  let result;
  const pageContext = { url: 'https://example.com', text: 'Page excerpt' };
  await converseWithLumenStream({
    transcript: 'Compare with my plan', pageContext,
    history: [{ role: 'assistant', widgets: [{ widgetType: 'checklist', items: [{ id: '1', text: 'Reviewed', completed: true }] }] }],
    onDone: data => { result = data; }
  });
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1].payload.pageContext, pageContext);
  assert.match(requests[1].payload.history[0].text, /"completed":true/);
  assert.equal(result.replyText, 'Done');
});

test('fallback failure rejects and reports one terminal error', async (t) => {
  const errors = [];
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network unavailable'); });
  await assert.rejects(converseWithLumenStream({ transcript: 'Hello', onError: error => errors.push(error) }), /Network unavailable/);
  assert.equal(globalThis.fetch.mock.callCount(), 2);
  assert.equal(errors.length, 1);
});

test('a failed non-stream fallback retains partial artifacts and tools once without completing successfully', async (t) => {
  const tool = { toolUseId: 'list-1', name: 'create_checklist', input: { title: 'Trip' }, status: 'success', resultSummary: 'Created 3 tasks' };
  const widget = { widgetType: 'checklist', checklistId: 'trip', title: 'Trip', items: [{ id: 'pack', text: 'Pack', completed: false }] };
  const partial = { reply: 'Here is the checklist so far.', tools: [tool, tool], widgets: [widget] };
  t.mock.method(globalThis, 'fetch', async (url) => url.endsWith('/stream')
    ? new Response('', { status: 404 })
    : Response.json({ error: 'The model could not finish the plan', partialResult: partial }, { status: 503 }));
  const tokens = [], starts = [], results = [], widgets = [], errors = [];
  let completions = 0;
  await assert.rejects(converseWithLumenStream({
    transcript: 'Make a trip plan',
    onToolStart: event => starts.push(event), onToolResult: event => results.push(event),
    onToken: token => tokens.push(token), onWidget: output => widgets.push(output),
    onError: error => errors.push(error), onDone: () => { completions++; }
  }), error => error.message === 'The model could not finish the plan' && error.partialResult.reply === partial.reply);
  assert.deepEqual(tokens, [partial.reply]);
  assert.equal(starts.length, 1);
  assert.equal(results.length, 1);
  assert.equal(results[0].status, 'success');
  assert.equal(results[0].summary, 'Created 3 tasks');
  assert.deepEqual(widgets, [widget]);
  assert.equal(errors.length, 1);
  assert.equal(completions, 0);
  assert.equal(globalThis.fetch.mock.callCount(), 2);
});

test('quota and validation errors do not retry through the fallback endpoint', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Please wait before trying again' }, { status: 429 }));
  await assert.rejects(converseWithLumenStream({ transcript: 'Hello' }), /Please wait/);
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('Stop ends quietly and never falls back', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('Stopped', 'AbortError'); });
  let aborted = false;
  await converseWithLumenStream({ transcript: 'Hello', onAbort: () => { aborted = true; } });
  assert.equal(aborted, true);
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('malformed events and callback failures after output cannot be swallowed or retried', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => response(sse({ type: 'token', token: 'Partial answer' }) + 'data: {invalid}\n\n'));
  await assert.rejects(converseWithLumenStream({ transcript: 'Hello' }), SyntaxError);
  assert.equal(globalThis.fetch.mock.callCount(), 1);
  globalThis.fetch.mock.mockImplementation(async () => response(sse({ type: 'token', token: 'Hello' })));
  await assert.rejects(converseWithLumenStream({ transcript: 'Hello', onToken: () => { throw new Error('Render failed'); } }), /Render failed/);
  assert.equal(globalThis.fetch.mock.callCount(), 2);
});
