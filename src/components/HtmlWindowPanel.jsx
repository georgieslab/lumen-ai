import React, { useMemo } from 'react';
import { buildSandboxedDocument, buildStandalonePage } from '../services/htmlPage';

// Square window floating over the orb that runs Lumen's HTML in an isolated sandbox.
export default function HtmlWindowPanel({ html, onClose }) {
  const srcDoc = useMemo(() => (html ? buildSandboxedDocument(html) : ''), [html]);
  if (!html) return null;

  const openInTab = () => {
    const url = URL.createObjectURL(new Blob([buildStandalonePage(html)], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <section className="html-window glass-panel" aria-label="Lumen web page">
      <header className="embedded-tab-header">
        <span className="embedded-tab-title">🌐 Lumen page</span>
        <button type="button" className="shared-tab-stop" onClick={openInTab}>New tab</button>
        <button type="button" className="shared-tab-stop" onClick={onClose} aria-label="Close page">Close</button>
      </header>
      <iframe className="embedded-tab-frame" title="Lumen page" sandbox="allow-scripts" srcDoc={srcDoc} />
    </section>
  );
}
