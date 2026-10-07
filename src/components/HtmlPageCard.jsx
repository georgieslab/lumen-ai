import React, { useMemo, useState } from 'react';
import { buildSandboxedDocument, buildStandalonePage } from '../services/htmlPage';

// Pages written by Lumen run only after the user clicks, inside an isolated sandbox.
export default function HtmlPageCard({ html }) {
  const [previewing, setPreviewing] = useState(false);
  const srcDoc = useMemo(() => (previewing ? buildSandboxedDocument(html) : ''), [previewing, html]);

  const openPage = (features) => {
    const blob = new Blob([buildStandalonePage(html)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', features);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const openInNewTab = () => openPage('noopener,noreferrer');
  // A sized pop-up window; browsers only allow it from a click, so it can't open automatically.
  const openInPopup = () => openPage('popup=yes,noopener,noreferrer,width=960,height=720');

  const download = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lumen-page.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="html-page-card">
      <div className="html-page-card-title">🌐 Lumen wrote a web page</div>
      <div className="html-page-card-actions">
        <button type="button" className="shared-tab-stop" onClick={() => setPreviewing((v) => !v)}>
          {previewing ? 'Hide preview' : 'Preview in Lumen'}
        </button>
        <button type="button" className="shared-tab-stop" onClick={openInPopup}>Open in pop-up window</button>
        <button type="button" className="shared-tab-stop" onClick={openInNewTab}>Open in new tab</button>
        <button type="button" className="shared-tab-stop" onClick={download}>Download</button>
      </div>
      {previewing && (
        <iframe className="html-page-frame" title="Lumen page preview" sandbox="allow-scripts" srcDoc={srcDoc} />
      )}
      <details>
        <summary>View code</summary>
        <pre className="html-page-code">{html}</pre>
      </details>
    </div>
  );
}

