// How much room Lumen gets for one reply. Chat answers stay short and cheap; a request to write a
// web page, game or demo needs several thousand tokens, and a page cut off in the middle cannot run.

export const DEFAULT_REPLY_TOKENS = 1350;
// Amazon Nova Lite, the default model, allows about 5,120 output tokens.
export const PAGE_REPLY_TOKENS = 5000;

const BUILD_VERB = /\b(build|write|create|make|generate|design|code|craft|develop|redesign|improve|update|change|add|enhance|extend|polish)\b/i;
const PAGE_NOUN = /\b(html|web\s?page|webpage|web\s?site|website|landing\s?page|mini[- ]?app|game|demo|animation|canvas|visuali[sz]ation|dashboard|interactive|aurora|particles?|shader|page)\b/i;
const HTML_FENCE_OPEN = /```html/i;

const textOf = (item) => (typeof item === 'string' ? item : String(item?.text ?? ''));

// True when this message, or the page Lumen wrote just before it, is about building a page.
export function isPageRequest(prompt, history = []) {
  const text = textOf(prompt);
  if (BUILD_VERB.test(text) && PAGE_NOUN.test(text)) return true;
  const recent = Array.isArray(history) ? history.slice(-3) : [];
  // A follow-up such as "make it glow more" belongs to the page Lumen just wrote.
  return recent.some((item) => item?.role !== 'user' && HTML_FENCE_OPEN.test(textOf(item))) && BUILD_VERB.test(text);
}

// Models that are not Amazon Nova can write much longer replies, so a page is not squeezed.
export const LONG_MODEL_PAGE_TOKENS = 12000;

export function replyTokenBudget(prompt, history = [], base = DEFAULT_REPLY_TOKENS, modelId = '') {
  if (!isPageRequest(prompt, history)) return base;
  const isNova = !modelId || String(modelId).toLowerCase().includes('nova');
  return Math.max(base, isNova ? PAGE_REPLY_TOKENS : LONG_MODEL_PAGE_TOKENS);
}

// The model that writes pages. Writing a polished page is much harder than chatting, so it can use a
// stronger model than the everyday one. Set LUMEN_PAGE_MODEL_ID to change it, or to "none" to turn it off.
export const DEFAULT_PAGE_MODEL = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';

export function pageModelId(env = {}) {
  const configured = String(env.LUMEN_PAGE_MODEL_ID ?? '').trim();
  if (configured.toLowerCase() === 'none') return null;
  return configured || DEFAULT_PAGE_MODEL;
}

// If a page was cut off by the length limit, close the code block (so the card still shows, with its
// code) and say what happened, instead of leaving a raw, unterminated block.
export function truncationTail(reply) {
  const text = String(reply || '');
  const fences = (text.match(/```/g) || []).length;
  if (fences % 2 === 0) return '';
  return `${text.endsWith('\n') ? '' : '\n'}\`\`\`\n\nThis page hit my length limit and may be incomplete. Ask me to make it more compact and I'll rewrite it shorter.`;
}
