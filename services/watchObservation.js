import { fetchUrlContent, searchDuckDuckGo } from './webSearch.js';

function canonicalSource(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.href;
  } catch { return null; }
}

// Uses the same public-address and redirect guards as the research tools. Topic
// watches compare stable result identities/titles, not fluctuating search rank.
export function createWatchObserver({ fetchPage = fetchUrlContent, search = searchDuckDuckGo } = {}) {
  return async (watch, { signal } = {}) => {
    if (watch.kind === 'url') {
      const page = await fetchPage(watch.target, { signal, maxContentLength: 40000 });
      if (!page?.success || !page.content?.trim()) throw new Error('The public page could not be read. The previous baseline has been kept.');
      return { text: page.content, title: page.title || watch.title, url: page.url || watch.target,
        sources: [{ title: page.title || watch.title, url: page.url || watch.target }] };
    }
    const results = await search(watch.target, 8, { signal });
    const seen = new Set();
    const sources = (Array.isArray(results) ? results : []).flatMap(item => {
      const url = canonicalSource(item.url);
      if (!url || seen.has(url)) return [];
      seen.add(url);
      return [{ url, title: String(item.title || url).replace(/\s+/g, ' ').trim().slice(0, 200) }];
    }).sort((a, b) => a.url.localeCompare(b.url));
    if (!sources.length) throw new Error('No public search results were available. The previous baseline has been kept.');
    return { text: JSON.stringify(sources), title: watch.title, url: sources[0].url, sources };
  };
}
