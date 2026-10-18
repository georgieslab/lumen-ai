import { randomUUID } from 'node:crypto';
import { validateArtifactInput } from './artifactTools.js';

const text = maxLength => ({ type: 'string', minLength: 1, maxLength });
const object = (properties, required) => ({ type: 'object', properties, required, additionalProperties: false });
const source = object({ url: text(2048), title: text(200) }, ['url', 'title']);
const claim = object({ claim: text(500), verdict: { type: 'string', enum: ['supported', 'contradicted', 'unresolved'] },
  explanation: text(700), sources: { type: 'array', items: source, maxItems: 4 } }, ['claim', 'verdict', 'explanation', 'sources']);
const schema = object({ title: text(120), summary: text(700), limitations: text(700),
  claims: { type: 'array', minItems: 1, maxItems: 6, items: claim } }, ['title', 'claims']);

function sourceKey(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch { return null; }
}

export function observedSourceMap(completedTools = []) {
  const sources = new Map();
  for (const tool of completedTools) {
    if (tool.status !== 'success') continue;
    if (tool.name === 'live_web_search') {
      for (const item of tool.resultItems || []) { const key = sourceKey(item.url); if (key && !sources.has(key)) sources.set(key, { observedBy: 'search' }); }
    }
    if (tool.name === 'browse_web_page') {
      const key = sourceKey(tool.input?.url);
      if (key) sources.set(key, { observedBy: 'page' });
    }
  }
  return sources;
}

export const EVIDENCE_TOOL = {
  name: 'create_evidence_report', effect: 'local', web: false,
  description: 'Create an evidence-review card with up to six claims, supported/contradicted/unresolved verdicts, explanations and source links. Research first. Every link must have appeared in a successful search or webpage read in this run. Supported and contradicted claims each need at least one source page actually read with browse_web_page. Search-only evidence must stay unresolved; unresolved claims may have no sources. Never invent confidence scores or citations.',
  inputSchema: schema,
  execute(input, { completedTools = [], now = () => new Date().toISOString() } = {}) {
    validateArtifactInput(schema, input);
    const observed = observedSourceMap(completedTools);
    const claims = input.claims.map((item, index) => {
      if (item.verdict !== 'unresolved' && !item.sources.length) throw new Error(`Claim ${index + 1} needs observed source links for a ${item.verdict} verdict.`);
      const seen = new Set();
      const sources = item.sources.map(link => {
        const key = sourceKey(link.url);
        if (!key || !observed.has(key)) throw new Error(`Source ${link.url} was not observed in a successful search or page read. Research it first or leave the claim unresolved without a citation.`);
        return { url: link.url, title: link.title.trim(), observedBy: observed.get(key).observedBy };
      }).filter(link => { const key = sourceKey(link.url); if (seen.has(key)) return false; seen.add(key); return true; });
      if (item.verdict !== 'unresolved' && !sources.some(link => link.observedBy === 'page')) throw new Error(`Claim ${index + 1} requires at least one source page actually read for a ${item.verdict} verdict. Open a source with browse_web_page, or mark it unresolved and explain the search-only evidence.`);
      return { id: `claim-${index + 1}`, claim: item.claim.trim(), verdict: item.verdict, explanation: item.explanation.trim(), sources };
    });
    return { widgetType: 'evidence_report', reportId: randomUUID(), title: input.title.trim(), summary: input.summary?.trim() || '',
      limitations: input.limitations?.trim() || '', checkedAt: now(), claims };
  }
};
