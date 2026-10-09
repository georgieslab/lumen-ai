import React, { useEffect, useState } from 'react';

// Turns what the user typed into a safe http(s) URL, or null.
export function normalizeWebUrl(input) {
  const raw = String(input || '').trim();
  if (!raw || /\s/.test(raw)) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return null;
    return url.href;
  } catch (_) {
    return null;
  }
}

// The user's own click and typed address count as approval to open the page.
export default function OpenWebPageButton({ onOpen, openRequest = 0, triggerOnly = false }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (openRequest > 0) {
      setEditing(true);
      setError('');
    }
  }, [openRequest]);

  const submit = (event) => {
    event.preventDefault();
    const url = normalizeWebUrl(value);
    if (!url) {
      setError('Enter a full web address, like example.com');
      return;
    }
    setError('');
    setEditing(false);
    setValue('');
    onOpen(url);
  };

  if (!editing) {
    if (triggerOnly) return null;
    return (
      <button type="button" className="open-web-btn" onClick={() => setEditing(true)} title="Enter a web address to view it inside Lumen. Some sites may block embedded viewing." aria-label="Open a web page inside Lumen">
        <span className="open-web-btn-label">🌐 Open web page</span>
      </button>
    );
  }

  return (
    <form className="open-web-form glass-panel" onSubmit={submit}>
      <div className="open-web-tabbar">
        <span className="open-web-tab-dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="open-web-tab-title">New tab</span>
        <button
          type="button"
          className="open-web-tab-close"
          onClick={() => { setEditing(false); setError(''); }}
          aria-label="Close address entry"
          title="Close"
        >×</button>
      </div>
      <div className="open-web-address-row">
        <span className="open-web-address-icon" aria-hidden="true">🌐</span>
        <input
          className="open-web-input"
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          placeholder="Enter a web address"
          aria-label="Web address"
          autoFocus
        />
        <button type="submit" className="open-web-go" aria-label="Go to web address" title="Go">
          <span aria-hidden="true">→</span>
        </button>
      </div>
      {error && <span className="open-web-error" role="alert">{error}</span>}
    </form>
  );
}
