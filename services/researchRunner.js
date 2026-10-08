import { approvedPlanFromRequest, PLAN_LIMITS } from './missionPlan.js';

export const RESULTS_PER_QUERY = 4;

export class ResearchStageError extends Error {
  constructor(stage, message) {
    super(message);
    this.name = 'ResearchStageError';
    this.stage = stage;
  }
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  if (signal.reason?.name === 'AbortError') throw signal.reason;
  const error = new Error('Research was cancelled.');
  error.name = 'AbortError';
  throw error;
}

function cleanText(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanResult(result) {
  if (!result || typeof result.url !== 'string') return null;
  try {
    const url = new URL(result.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return {
      url: url.href,
      title: cleanText(result.title, 300) || url.hostname,
      snippet: cleanText(result.snippet, 1200)
    };
  } catch (_) {
    return null;
  }
}

// Runs only a supplied, user-approved plan. All network operations receive the run's abort signal.
export async function collectResearchSources({
  plan: rawPlan,
  topic = '',
  search,
  read,
  signal,
  onProgress = () => {}
}) {
  const plan = approvedPlanFromRequest(rawPlan, topic);
  if (!plan) throw new ResearchStageError('plan', 'Review and start a research plan before searching.');
  if (typeof search !== 'function' || typeof read !== 'function') {
    throw new TypeError('Research search and page-reading functions are required.');
  }
  throwIfAborted(signal);

  let completedQueries = 0;
  let searchFailures = 0;
  let resultCount = 0;
  onProgress({
    stage: 'search',
    message: `Searching 0 of ${plan.questions.length} approved queries…`,
    progress: 8,
    searchesCompleted: 0,
    searchesTotal: plan.questions.length,
    sources: 0
  });

  const searchBatches = await Promise.all(plan.questions.map(async (query) => {
    try {
      throwIfAborted(signal);
      const results = await search(query, RESULTS_PER_QUERY, { signal });
      const bounded = Array.isArray(results) ? results.slice(0, RESULTS_PER_QUERY) : [];
      resultCount += bounded.length;
      return bounded;
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') throw error;
      searchFailures += 1;
      return [];
    } finally {
      completedQueries += 1;
      onProgress({
        stage: 'search',
        message: `Searched ${completedQueries} of ${plan.questions.length} approved queries; ${resultCount} results found.`,
        progress: 8 + Math.floor((completedQueries / plan.questions.length) * 24),
        searchesCompleted: completedQueries,
        searchesTotal: plan.questions.length,
        searchesFailed: searchFailures,
        sources: resultCount
      });
    }
  }));
  throwIfAborted(signal);

  const seenUrls = new Set();
  const uniqueResults = [];
  for (const rawResult of searchBatches.flat()) {
    const result = cleanResult(rawResult);
    if (!result || seenUrls.has(result.url)) continue;
    seenUrls.add(result.url);
    uniqueResults.push(result);
  }
  if (uniqueResults.length === 0) {
    throw new ResearchStageError('search', 'The web search returned no usable sources. Try a more specific topic.');
  }

  const selected = uniqueResults.slice(0, Math.min(plan.maxPages, PLAN_LIMITS.maxPages));
  let completedPages = 0;
  let pagesRead = 0;
  let pagesFailed = 0;
  onProgress({
    stage: 'reading',
    message: `Found ${uniqueResults.length} sources. Reading up to ${selected.length} pages…`,
    progress: 35,
    sources: uniqueResults.length,
    pagesRead: 0,
    pagesTotal: selected.length
  });

  const sources = await Promise.all(selected.map(async (source) => {
    let page = null;
    try {
      throwIfAborted(signal);
      page = await read(source.url, { signal });
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') throw error;
      page = { success: false };
    } finally {
      completedPages += 1;
      if (page?.success) pagesRead += 1;
      else pagesFailed += 1;
      onProgress({
        stage: 'reading',
        message: `Read ${completedPages} of ${selected.length} pages; ${pagesRead} succeeded${pagesFailed ? `, ${pagesFailed} unavailable` : ''}.`,
        progress: 35 + Math.floor((completedPages / selected.length) * 25),
        sources: uniqueResults.length,
        pagesRead,
        pagesFailed,
        pagesTotal: selected.length
      });
    }
    throwIfAborted(signal);
    return {
      ...source,
      title: cleanText(page?.title, 300) || source.title,
      content: page?.success ? cleanText(page.content, 3500) : '',
      read: Boolean(page?.success)
    };
  }));
  throwIfAborted(signal);

  return { plan, sources, searchesFailed: searchFailures, pagesRead, pagesFailed };
}
