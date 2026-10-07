import React from 'react';

export default function SharedTabChip({ tab, onDisconnect }) {
  if (!tab) return null;
  let host = '';
  try {
    host = new URL(tab.url).hostname;
  } catch (_) {}

  return (
    <div className="shared-tab-chip" role="status">
      <span className="shared-tab-dot" aria-hidden="true" />
      <span className="shared-tab-label" title={tab.url}>
        Sharing tab: {tab.title || host || 'Untitled'}{host && tab.title ? ` (${host})` : ''}
      </span>
      <button type="button" className="shared-tab-stop" onClick={onDisconnect} aria-label="Stop sharing tab">
        Stop
      </button>
    </div>
  );
}
