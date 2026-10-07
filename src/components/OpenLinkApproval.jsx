import React from 'react';

function sameOriginUrl(url) {
  try { return new URL(url).origin === window.location.origin; } catch (_) { return true; }
}

// Opening a page in the user's browser always needs an explicit click here.
export default function OpenLinkApproval({ url, onDismiss, onOpenInLumen }) {
  if (!url) return null;
  let host = url;
  try { host = new URL(url).hostname; } catch (_) {}
  return (
    <div className="shared-tab-chip open-link-approval" role="alertdialog" aria-label="Open link approval">
      <span className="shared-tab-label" title={url}>Lumen wants to open {host}</span>
      <button type="button" className="shared-tab-stop" onClick={() => onOpenInLumen(url)} disabled={sameOriginUrl(url)}>Open in Lumen</button>
      <a
        className="shared-tab-stop"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onDismiss}
      >
        New tab
      </a>
      <button type="button" className="shared-tab-stop" onClick={onDismiss}>Deny</button>
    </div>
  );
}


