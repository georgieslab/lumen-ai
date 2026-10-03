/**
 * Zero-Setup Internet Access Engine for Lumen AI
 * - Free DuckDuckGo HTML Search Scraper (No API key required)
 * - Real-Time URL Reader & Text Content Extractor
 * - Smart Intent Detection for Live Web Queries
 */

function cleanHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractActualUrl(rawHref) {
  if (!rawHref) return '';
  try {
    if (rawHref.includes('uddg=')) {
      const match = rawHref.match(/uddg=([^&]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
    if (rawHref.startsWith('//')) return 'https:' + rawHref;
    return rawHref;
  } catch (_) {
    return rawHref;
  }
}

/**
 * Perform a DuckDuckGo web search without any API keys
 */
export async function searchDuckDuckGo(query, maxResults = 4) {
  const cleanQuery = query.replace(/[^\w\s\-\.\,\?\!\'\"]/g, ' ').trim();
  if (!cleanQuery) return [];

  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`DuckDuckGo returned status ${res.status}`);
      return [];
    }

    const html = await res.text();
    const results = [];
    const sections = html.split(/<div class="[^"]*web-result[^"]*"/i);

    for (let i = 1; i < sections.length && results.length < maxResults; i++) {
      const chunk = sections[i];
      const titleMatch = chunk.match(/<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      const snippetMatch = chunk.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);

      if (titleMatch || snippetMatch) {
        const rawUrl = titleMatch ? titleMatch[1] : '';
        const title = titleMatch ? cleanHtmlEntities(titleMatch[2]) : '';
        const snippet = snippetMatch ? cleanHtmlEntities(snippetMatch[1]) : '';
        const actualUrl = extractActualUrl(rawUrl);

        if (title || snippet) {
          results.push({
            title: title || 'Web Result',
            snippet: snippet || '',
            url: actualUrl
          });
        }
      }
    }

    if (results.length > 0) {
      return results;
    }

    // Fallback to Wikipedia search API if DuckDuckGo HTML is challenged/empty
    const wikiFallback = await searchWikipedia(cleanQuery, maxResults);
    return wikiFallback;
  } catch (err) {
    clearTimeout(timeout);
    console.warn('DuckDuckGo search error:', err.message);
    return await searchWikipedia(cleanQuery, maxResults);
  }
}

/**
 * Search Wikipedia public API for facts, people, history, science, events
 */
export async function searchWikipedia(query, maxResults = 4) {
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=`;
    const res = await fetch(wikiUrl);
    if (!res.ok) return [];
    const data = await res.json();
    const hits = data.query?.search || [];
    return hits.slice(0, maxResults).map(h => ({
      title: h.title,
      snippet: cleanHtmlEntities(h.snippet),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}`
    }));
  } catch (err) {
    console.warn('Wikipedia search error:', err.message);
    return [];
  }
}

/**
 * Fetch and extract the text content from a web page URL
 */
export async function fetchUrlContent(targetUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    const html = await res.text();

    // Strip scripts, styles, svg, and HTML comments
    const cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Extract title
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(cleaned);
    const title = titleMatch ? cleanHtmlEntities(titleMatch[1]) : '';

    // Extract readable paragraphs and headers
    const textBlocks = [];
    const blockRegex = /<(?:p|h[1-6]|li|article|section)[^>]*>([\s\S]*?)<\/(?:p|h[1-6]|li|article|section)>/gi;
    let b;
    while ((b = blockRegex.exec(cleaned)) !== null && textBlocks.length < 35) {
      const text = cleanHtmlEntities(b[1]);
      if (text.length > 25) {
        textBlocks.push(text);
      }
    }

    const content = textBlocks.slice(0, 15).join('\n\n').slice(0, 3000);
    return {
      url: targetUrl,
      title: title || targetUrl,
      content: content || 'Could not extract readable article text from this page.',
      success: true
    };
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`URL Reader error for ${targetUrl}:`, err.message);
    return {
      url: targetUrl,
      title: targetUrl,
      error: err.message,
      success: false
    };
  }
}

/**
 * Extract URL from text if present
 */
export function extractUrlFromText(text) {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[.,\)\;]$/, '') : null;
}

/**
 * Determine if a prompt benefits from real-time web search
 */
export function shouldPerformWebSearch(text) {
  if (!text) return false;
  const lower = text.toLowerCase();

  // Explicit search commands
  if (/\b(search( for)?|look up|google|browse|find online|check the web|on the internet)\b/.test(lower)) {
    return true;
  }

  // Real-time news, current events, weather, finance
  if (/\b(weather|temperature|forecast|stock price|ticker|news|today|tonight|yesterday|current(ly)?|latest|who won|score of|live score)\b/.test(lower)) {
    return true;
  }

  // Time-sensitive fact checking
  if (/\b(what time is it in|who is the current|release date of|when is the next)\b/.test(lower)) {
    return true;
  }

  return false;
}

/**
 * High-level grounding engine: detects URLs or search intent and returns structured context
 */
export async function getWebGroundingContext(promptText, options = {}) {
  const { mode = 'auto' } = options; // 'auto', 'always', 'off'
  if (mode === 'off' || !promptText || promptText.length < 3) return null;

  // 1. Direct URL Reading
  const detectedUrl = extractUrlFromText(promptText);
  if (detectedUrl) {
    console.log(`[Web Engine] Detected URL: ${detectedUrl}. Reading page content...`);
    const pageData = await fetchUrlContent(detectedUrl);
    if (pageData.success && pageData.content) {
      return {
        type: 'url_reader',
        groundingText: `[Live Web Page Context (${detectedUrl}) - Title: "${pageData.title}"]:\n${pageData.content}`,
        sources: [
          {
            title: pageData.title || detectedUrl,
            url: detectedUrl,
            snippet: pageData.content.slice(0, 160) + '...'
          }
        ]
      };
    }
  }

  // 2. Real-Time Web Search
  const shouldSearch = mode === 'always' || shouldPerformWebSearch(promptText);
  if (!shouldSearch) return null;

  // Derive search query (remove conversational filler if user said "search for ...")
  let cleanQuery = promptText;
  const searchPrefix = promptText.match(/(?:search(?: the web)?(?: for)?|look up|browse for|google)\s+(.+)/i);
  if (searchPrefix && searchPrefix[1]) {
    cleanQuery = searchPrefix[1].trim();
  }

  console.log(`[Web Engine] Searching DuckDuckGo for: "${cleanQuery}"...`);
  const searchResults = await searchDuckDuckGo(cleanQuery, 4);

  if (!searchResults || searchResults.length === 0) {
    return null;
  }

  const formattedResults = searchResults.map((r, i) => 
    `${i + 1}. [${r.title}] (${r.url})\n   ${r.snippet}`
  ).join('\n\n');

  return {
    type: 'web_search',
    query: cleanQuery,
    groundingText: `[Live Web Search Grounding for "${cleanQuery}"]:\n${formattedResults}`,
    sources: searchResults
  };
}
