// Shared request context decisions, kept independent of providers and network I/O.
export function requestsPdfCreation(prompt) {
  const text = typeof prompt === 'string' ? prompt : '';
  return /(?:create|generate|make|export|write|download|build)\s+(?:a\s+)?(?:pdf|document|report|file)\b/i.test(text)
    || /\bpdf\s+(?:report|document|summary|export|file)\b/i.test(text);
}

// Always Web is a real runner tool turn, so its intent, result, cancellation, and
// budget consumption are checkpointed exactly like a model-requested lookup.
export function requiredWebLookup({ messages = [], tools = [], promptText = '', enabled = false } = {}) {
  if (!enabled || !tools.some((tool) => tool?.toolSpec?.name === 'live_web_search')) return null;
  const lookedUp = messages.some((message) => Array.isArray(message?.content)
    && message.content.some((block) => ['live_web_search', 'browse_web_page'].includes(block?.toolUse?.name)));
  if (lookedUp) return null;
  const query = String(promptText || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!query) return null;
  return {
    message: { role: 'assistant', content: [{ toolUse: {
      toolUseId: 'mission-web-grounding', name: 'live_web_search', input: { query }
    } }] },
    stopReason: 'tool_use'
  };
}
