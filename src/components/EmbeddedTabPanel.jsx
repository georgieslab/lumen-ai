import React from 'react';

// Shows a page the user approved inside Lumen. Sandboxed; many sites refuse framing, so a new-tab fallback is always offered.
export default function EmbeddedTabPanel({ url, onClose }) {
  if (!url) return null;
  // Never embed Lumen's own origin: allow-same-origin would let that page reach Lumen's data.
  let sameOrigin = false;
  try { sameOrigin = new URL(url).origin === window.location.origin; } catch (_) { sameOrigin = true; }
  if (sameOrigin) return null;
  let host = url;
  try { host = new URL(url).hostname; } catch (_) {}
  return (
    <section className="embedded-tab-panel glass-panel" aria-label={`Tab: ${host}`}>
      <header className="embedded-tab-header">
        <span className="embedded-tab-title" title={url}>{host}</span>
        <a className="shared-tab-stop" href={url} target="_blank" rel="noopener noreferrer">New tab</a>
        <button type="button" className="shared-tab-stop" onClick={onClose} aria-label="Close tab">Close</button>
      </header>
      <iframe
        className="embedded-tab-frame"
        src={url}
        title={host}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="no-referrer"
        loading="lazy"
      />
      <p className="embedded-tab-note">If the page stays blank, the site does not allow embedding. Use "New tab".</p>
    </section>
  );
}

