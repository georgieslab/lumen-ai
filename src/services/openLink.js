export function extractOpenLinkRequest(text) {
  const match = String(text || '').match(/\b(?:open|visit|go to|navigate to|show me)\b[^\n]*?((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/?#][^\s"'<>)]*)?)/i);
  if (!match) return null;
  const raw = match[1].replace(/[.,;:!?↗]+$/, '');
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch (_) {
    return null;
  }
}
