import test from 'node:test';
import assert from 'node:assert/strict';
import { collectResearchSources, RESULTS_PER_QUERY } from '../services/researchRunner.js';
import { PLAN_LIMITS } from '../services/missionPlan.js';

const source = (id) => ({
  title: `Source ${id}`,
  snippet: `Snippet ${id}`,
  url: `https://example${id}.com/article`
});

test('searches only approved, sanitized queries and reads no more than the plan limit', async () => {
  const calls = { searches: [], reads: [] };
  const signal = new AbortController().signal;
  const plan = {
    questions: Array.from({ length: 7 }, (_, index) => `query ${index + 1}`),
    maxPages: 99
  };
  const result = await collectResearchSources({
    plan,
    signal,
    search: async (query, limit, { signal }) => {
      calls.searches.push({ query, limit, signal });
      return Array.from({ length: 6 }, (_, index) => source(`${query.slice(-1)}-${index}`));
    },
    read: async (url, { signal }) => {
      calls.reads.push({ url, signal });
      return { success: true, title: 'Read source', content: 'Readable source content.' };
    }
  });

  assert.equal(result.plan.questions.length, PLAN_LIMITS.maxQuestions);
  assert.equal(result.plan.maxPages, PLAN_LIMITS.maxPages);
  assert.equal(calls.searches.length, PLAN_LIMITS.maxQuestions);
  assert.ok(calls.searches.every((call) => call.limit === RESULTS_PER_QUERY && call.signal === signal));
  assert.equal(calls.reads.length, PLAN_LIMITS.maxPages);
  assert.ok(calls.reads.every((call) => call.signal === signal));
  assert.equal(result.sources.length, PLAN_LIMITS.maxPages);
});

test('reports partial search and page-read failures while keeping successful sources', async () => {
  const result = await collectResearchSources({
    plan: { questions: ['first query', 'second query'], maxPages: 3 },
    search: async (query) => {
      if (query === 'first query') throw new Error('provider unavailable');
      return [source('readable'), source('unavailable')];
    },
    read: async (url) => {
      if (url.includes('unavailable')) throw new Error('page unavailable');
      return { success: true, title: 'Readable', content: 'Source text.' };
    }
  });

  assert.equal(result.searchesFailed, 1);
  assert.equal(result.pagesRead, 1);
  assert.equal(result.pagesFailed, 1);
  assert.deepEqual(result.sources.map(({ read }) => read), [true, false]);
});

test('rejects a missing approved plan before calling search', async () => {
  let searched = false;
  await assert.rejects(
    collectResearchSources({
      plan: null,
      search: async () => { searched = true; return []; },
      read: async () => ({ success: false })
    }),
    (error) => error.stage === 'plan'
  );
  assert.equal(searched, false);
});

test('aborting a run reaches an in-flight search and stops the runner', async () => {
  const controller = new AbortController();
  let receivedSignal;
  const run = collectResearchSources({
    plan: { questions: ['one query'] },
    signal: controller.signal,
    search: (_query, _limit, { signal }) => {
      receivedSignal = signal;
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true }));
    },
    read: async () => ({ success: false })
  });
  controller.abort();

  assert.equal(receivedSignal, controller.signal);
  await assert.rejects(run, (error) => error.name === 'AbortError');
});
