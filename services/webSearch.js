/**
 * Zero-Setup Internet Access & Web Browsing Engine for Lumen AI
 * - Programmatic Live Web Browsing & Extraction Tool (SSRF-Protected)
 * - Free DuckDuckGo HTML Search Scraper (No API key required)
 * - Wikipedia Knowledge Base API Fallback
 * - Real-Time URL Reader & Text Content Extractor
 * - Smart Intent Detection for Live Web Queries
 */

import { URL } from 'url';

/**
 * SSRF Guard: Validates that target URL is a public web resource
 * Blocks access to localhost, private networks (RFC 1918), link-local, and cloud metadata
 */
export function isSafeUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    const host = parsed.hostname.toLowerCase();

    // Block localhost, link-local, loopback, and cloud metadata services
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '169.254.169.254' || // AWS/GCP instance metadata endpoint
      host === 'metadata.google.internal' ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
      /^127\./.test(host) ||
      host.endsWith('.internal') ||
      host.endsWith('.local') ||
      host.endsWith('.localhost')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function cleanHtmlEntities(str) {
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

export function extractActualUrl(rawHref) {
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
 * Programmatic Web Browsing & Extraction Tool
 */
export class WebBrowserTool {
  constructor(options = {}) {
    this.timeoutMs = options.timeoutMs || 8000;
    this.maxContentLength = options.maxContentLength || 3500;
    this.userAgent = options.userAgent || 
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  }

  isSafeUrl(url) {
    return isSafeUrl(url);
  }

  cleanText(raw) {
    return cleanHtmlEntities(raw);
  }

  /**
   * Search the live web (DuckDuckGo fallback to Wikipedia)
   */
  async search(query, maxResults = 4) {
    return searchDuckDuckGo(query, maxResults);
  }

  /**
   * Navigate to a URL and extract clean text, headings, and metadata
   */
  async navigateAndExtract(targetUrl) {
    return fetchUrlContent(targetUrl, {
      timeoutMs: this.timeoutMs,
      maxContentLength: this.maxContentLength,
      userAgent: this.userAgent
    });
  }
}

export const webBrowser = new WebBrowserTool();

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
      return await searchWikipedia(cleanQuery, maxResults);
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

        if ((title || snippet) && isSafeUrl(actualUrl)) {
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
    return await searchWikipedia(cleanQuery, maxResults);
  } catch (err) {
    clearTimeout(timeout);
    console.warn('DuckDuckGo search fallback to Wikipedia:', err.message);
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
 * Fetch and extract the readable text content from a web page URL with SSRF protection
 */
export async function fetchUrlContent(targetUrl, options = {}) {
  const cleanUrl = String(targetUrl || '').trim();
  if (!cleanUrl) {
    return { success: false, error: 'No URL provided.', url: cleanUrl };
  }

  // Security SSRF check
  if (!isSafeUrl(cleanUrl)) {
    return {
      success: false,
      error: 'URL blocked by security guard (only public HTTP/HTTPS endpoints allowed).',
      url: cleanUrl
    };
  }

  const timeoutMs = options.timeoutMs || 8000;
  const maxLen = options.maxContentLength || 3500;
  const userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP status ${res.status}: ${res.statusText}`);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/json')) {
      return { success: false, error: `Unsupported media format: ${contentType}`, url: cleanUrl };
    }

    const html = await res.text();

    // Strip scripts, styles, svg, and HTML comments
    const cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Extract document title
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(cleaned);
    const title = titleMatch ? cleanHtmlEntities(titleMatch[1]) : cleanUrl;

    // Extract readable paragraphs and headers
    const textBlocks = [];
    const blockRegex = /<(?:p|h[1-6]|li|article|section)[^>]*>([\s\S]*?)<\/(?:p|h[1-6]|li|article|section)>/gi;
    let b;
    while ((b = blockRegex.exec(cleaned)) !== null && textBlocks.length < 40) {
      const text = cleanHtmlEntities(b[1]);
      if (text.length > 25) {
        textBlocks.push(text);
      }
    }

    let content = textBlocks.slice(0, 20).join('\n\n').slice(0, maxLen);
    if (!content) {
      // Client-rendered pages ship little body text; their meta tags still describe the page.
      const metaContent = (attr, name) => {
        const m = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i').exec(cleaned)
          || new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${name}["']`, 'i').exec(cleaned);
        return m ? cleanHtmlEntities(m[1]) : '';
      };
      const noscript = /<noscript[^>]*>([\s\S]*?)<\/noscript>/i.exec(cleaned);
      const parts = [
        metaContent('name', 'description'),
        metaContent('property', 'og:title'),
        metaContent('property', 'og:description'),
        noscript ? cleanHtmlEntities(noscript[1]) : ''
      ].filter((p, i, arr) => p && p.length > 10 && arr.indexOf(p) === i);
      if (parts.length) {
        content = `(This page is rendered by JavaScript, so only its metadata could be read. The user can share the live tab or a screenshot for the full view.)\n\n${parts.join('\n\n')}`.slice(0, maxLen);
      }
    }
    return {
      success: true,
      url: cleanUrl,
      title: title || cleanUrl,
      content: content || 'Could not extract readable article text from this page.',
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`URL Reader error for ${cleanUrl}:`, err.message);
    return {
      success: false,
      url: cleanUrl,
      title: cleanUrl,
      error: err.message
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
