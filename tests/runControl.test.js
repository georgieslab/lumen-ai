import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { watchClient } from '../services/runControl.js';

function fakeResponse() {
  const res = new EventEmitter();
  res.writableFinished = false;
  return res;
}

test('a response that finishes normally is not treated as cancelled', () => {
  const res = fakeResponse();
  const run = watchClient(res);
  res.writableFinished = true;
  res.emit('close');
  assert.equal(run.cancelled, false);
  assert.doesNotThrow(() => run.throwIfCancelled());
});

test('a connection that closes before the response finished cancels the run', () => {
  const res = fakeResponse();
  const run = watchClient(res);
  assert.equal(run.cancelled, false);
  res.emit('close');
  assert.equal(run.cancelled, true);
  assert.equal(run.signal.aborted, true);
  assert.throws(() => run.throwIfCancelled(), (error) => error.name === 'AbortError');
});

test('the abort signal can be handed to fetch-style APIs', () => {
  const res = fakeResponse();
  const run = watchClient(res);
  let fired = 0;
  run.signal.addEventListener('abort', () => { fired += 1; });
  res.emit('close');
  res.emit('close');
  assert.equal(fired, 1);
});

test('a request deadline cancels in-flight work', async () => {
  const res = fakeResponse();
  const run = watchClient(res, { timeoutMs: 5 });
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(run.signal.aborted, true);
  assert.match(run.signal.reason.message, /deadline/);
});

test('finishing a response clears its deadline', async () => {
  const res = fakeResponse();
  const run = watchClient(res, { timeoutMs: 5 });
  res.writableFinished = true;
  res.emit('finish');
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(run.signal.aborted, false);
});
