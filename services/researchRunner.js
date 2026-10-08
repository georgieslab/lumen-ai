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
  planFollowUp,
  signal,
  onProgress = () => {}
}) {
  const plan = approvedPlanFromRequest(rawPlan, topic);
  if (!plan) throw new ResearchStageError('plan', 'Review and start a research plan before searching.');
  if (typeof search !== 'function' || typeof read !== 'function') {
    throw new TypeError('Research search and page-reading functions are required.');
  }
  throwIfAborted(signal);
  const adaptiveFollowUpEnabled = plan.adaptiveFollowUp && typeof planFollowUp === 'function';

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

  // Reserve one page from the user's approved total for a possible targeted follow-up read.
  const totalPageLimit = Math.min(plan.maxPages, PLAN_LIMITS.maxPages);
  const initialPageLimit = Math.max(1, totalPageLimit - (adaptiveFollowUpEnabled ? 1 : 0));
  const selected = uniqueResults.slice(0, initialPageLimit);
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

  let followUpQuestion = null;
  let followUpStatus = adaptiveFollowUpEnabled ? 'checking' : 'disabled';
  let allSources = [...sources];
  let totalPagesRead = pagesRead;
  let totalPagesFailed = pagesFailed;

  if (adaptiveFollowUpEnabled) {
    onProgress({
      stage: 'reading',
      message: 'Checking the first-pass evidence for an important gap…',
      progress: 61,
      sources: allSources.length,
      pagesRead: totalPagesRead,
      pagesFailed: totalPagesFailed,
      followUpStatus: 'checking',
      followUpQueries: 0
    });

    let followUpProposal = null;
    try {
      followUpProposal = await planFollowUp({ plan, sources: allSources, signal });
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') throw error;
      followUpProposal = { unavailable: true };
    }
    throwIfAborted(signal);

    followUpQuestion = typeof followUpProposal === 'string'
      ? cleanText(followUpProposal, PLAN_LIMITS.maxQuestionChars)
      : cleanText(followUpProposal?.question, PLAN_LIMITS.maxQuestionChars);
    if (followUpQuestion.length < 3) followUpQuestion = null;
    if (followUpProposal?.unavailable) {
      followUpStatus = 'unavailable';
    } else if (!followUpQuestion) {
      followUpStatus = 'no_gaps';
    } else {
      followUpStatus = 'searching';
      onProgress({
        stage: 'reading',
        message: 'Searching once more to check an evidence gap…',
        progress: 62,
        sources: allSources.length,
        pagesRead: totalPagesRead,
        pagesFailed: totalPagesFailed,
        followUpStatus,
        followUpQueries: 1,
        followUpQuery: followUpQuestion
      });

      let followUpResults = [];
      try {
        const results = await search(followUpQuestion, RESULTS_PER_QUERY, { signal });
        followUpResults = Array.isArray(results) ? results.slice(0, RESULTS_PER_QUERY) : [];
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') throw error;
        searchFailures += 1;
        followUpStatus = 'search_failed';
      }
      throwIfAborted(signal);

      const knownUrls = new Set(uniqueResults.map((source) => source.url));
      const followUpSource = followUpResults
        .map(cleanResult)
        .find((source) => source && !knownUrls.has(source.url));
      const remainingPageBudget = Math.max(0, totalPageLimit - allSources.length);
      if (followUpStatus === 'searching' && followUpSource && remainingPageBudget > 0) {
        onProgress({
          stage: 'reading',
          message: 'Reading the follow-up source…',
          progress: 63,
          sources: allSources.length,
          pagesRead: totalPagesRead,
          pagesFailed: totalPagesFailed,
          followUpStatus: 'reading',
          followUpQueries: 1,
          followUpQuery: followUpQuestion
        });
        let page = null;
        try {
          page = await read(followUpSource.url, { signal });
        } catch (error) {
          if (signal?.aborted || error?.name === 'AbortError') throw error;
          page = { success: false };
        }
        throwIfAborted(signal);
        if (page?.success) totalPagesRead += 1;
        else totalPagesFailed += 1;
        allSources.push({
          ...followUpSource,
          title: cleanText(page?.title, 300) || followUpSource.title,
          content: page?.success ? cleanText(page.content, 3500) : '',
          read: Boolean(page?.success)
        });
        followUpStatus = page?.success ? 'complete' : 'source_unavailable';
      } else if (followUpStatus === 'searching') {
        followUpStatus = 'no_source';
      }
      onProgress({
        stage: 'reading',
        message: followUpStatus === 'complete'
          ? 'The follow-up evidence check is complete.'
          : followUpStatus === 'search_failed'
            ? 'The follow-up search failed; continuing with collected sources.'
            : followUpStatus === 'source_unavailable'
              ? 'The follow-up page could not be read; continuing with the search result.'
              : 'The follow-up search found no additional usable source.',
        progress: 64,
        sources: allSources.length,
        pagesRead: totalPagesRead,
        pagesFailed: totalPagesFailed,
        followUpStatus,
        followUpQueries: 1,
        followUpQuery: followUpQuestion
      });
    }
    if (followUpStatus === 'no_gaps' || followUpStatus === 'unavailable') {
      onProgress({
        stage: 'reading',
        message: followUpStatus === 'no_gaps'
          ? 'The first-pass evidence covers the approved questions.'
          : 'The evidence check could not suggest a follow-up; continuing with collected sources.',
        progress: 64,
        sources: allSources.length,
        pagesRead: totalPagesRead,
        pagesFailed: totalPagesFailed,
        followUpStatus,
        followUpQueries: 0
      });
    }
  }

  return {
    plan,
    sources: allSources,
    searchesFailed: searchFailures,
    pagesRead: totalPagesRead,
    pagesFailed: totalPagesFailed,
    followUpQuestion,
    followUpStatus
  };
}
