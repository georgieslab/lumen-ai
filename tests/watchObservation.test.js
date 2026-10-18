import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatchObserver } from '../services/watchObservation.js';

test('topic observations ignore ranking, snippets and tracking parameters', async () => {
  const results = [{ url: 'https://example.com/a?utm_source=x#top', title: 'Source A', snippet: 'Fluctuating text' }, { url: 'https://example.com/b', title: 'Source B' }];
  let count = 0;
  const observe = createWatchObserver({ search: async () => count++ ? [...results].reverse().map(item => ({ ...item, snippet: 'Updated snippet' })) : results });
  const watch = { kind: 'topic', target: 'A topic', title: 'Topic' };
  assert.equal((await observe(watch)).text, (await observe(watch)).text);
  assert.ok(!(await observe(watch)).text.includes('utm_source'));
});

test('unreadable pages and empty topic searches cannot erase a good baseline', async () => {
  const observe = createWatchObserver({ fetchPage: async () => ({ success: false }), search: async () => [] });
  await assert.rejects(observe({ kind: 'url', target: 'https://example.com' }), /previous baseline/);
  await assert.rejects(observe({ kind: 'topic', target: 'Example' }), /previous baseline/);
});

test('URL observations forward cancellation and extraction limits to the guarded fetcher', async () => {
  const controller = new AbortController();
  const observe = createWatchObserver({ fetchPage: async (url, options) => {
    assert.equal(url, 'https://example.com'); assert.equal(options.signal, controller.signal); assert.equal(options.maxContentLength, 40000);
    return { success: true, content: 'Public text', title: 'Example', url };
  } });
  const result = await observe({ kind: 'url', target: 'https://example.com' }, { signal: controller.signal });
  assert.equal(result.text, 'Public text');
  assert.equal(result.sources[0].url, 'https://example.com');
});
