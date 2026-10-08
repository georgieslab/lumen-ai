const HTML_FENCE = /```html[^\S\n]*\n([\s\S]*?)```/gi;

// Models sometimes open the block twice ("```html" then "```html" again) or run out of room before
// closing it. Either way the page should still be found, so tidy the fences before parsing.
export function repairHtmlFences(text) {
  let source = String(text || '').replace(/(```html[^\S\n]*\n)(?:[^\S\n]*```html[^\S\n]*\n)+/gi, '$1');
  const opens = (source.match(/```html/gi) || []).length;
  const fences = (source.match(/```/g) || []).length;
  if (opens > 0 && fences % 2 === 1) source = `${source.replace(/\s+$/, '')}\n\`\`\``;
  return source;
}

// While a reply is still streaming, an opened HTML block is half-written code. Show only the words before it
// and report how much code has arrived, so the chat can say "writing the page" instead of showing raw markup.
export function hideStreamingHtml(text) {
  const source = String(text || '');
  const open = source.search(/```html/i);
  if (open < 0) return { text: source, writing: false, codeChars: 0 };
  const afterFence = source.slice(open).replace(/^```html[^\S\n]*\n?/i, '');
  const closed = afterFence.indexOf('```');
  if (closed >= 0) return { text: source, writing: false, codeChars: closed };
  return { text: source.slice(0, open).trimEnd(), writing: true, codeChars: afterFence.length };
}

// Splits assistant text into plain-text and generated-HTML segments.
export function splitHtmlBlocks(text) {
  const segments = [];
  let last = 0;
  let match;
  const source = repairHtmlFences(text);
  HTML_FENCE.lastIndex = 0;
  while ((match = HTML_FENCE.exec(source)) !== null) {
    if (match.index > last) segments.push({ type: 'text', content: source.slice(last, match.index) });
    segments.push({ type: 'html', content: match[1].trim() });
    last = HTML_FENCE.lastIndex;
  }
  if (last < source.length) segments.push({ type: 'text', content: source.slice(last) });
  return segments;
}

// Generated pages can run their own scripts but get no network, no form posts, and no access to Lumen.
const PAGE_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https:; img-src data: https:; font-src data: https:; media-src data:; form-action 'none'; base-uri 'none'";

export function buildSandboxedDocument(html) {
  const csp = `<meta http-equiv="Content-Security-Policy" content="${PAGE_CSP}">`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}${csp}`) : `${csp}${html}`;
}

const escapeAttr = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// A static wrapper page: the generated HTML lives in an opaque-origin iframe (no allow-same-origin).
export function buildStandalonePage(html, title = 'Lumen page') {
  const safeTitle = title.replace(/[<>&"]/g, '');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style></head><body><iframe sandbox="allow-scripts" srcdoc="${escapeAttr(buildSandboxedDocument(html))}"></iframe></body></html>`;
}
