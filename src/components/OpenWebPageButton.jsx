import React, { useState } from 'react';

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
export default function OpenWebPageButton({ onOpen }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

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
    return (
      <button type="button" className="open-web-btn" onClick={() => setEditing(true)}>
        <span className="open-web-btn-label">🌐 Open web page</span>
      </button>
    );
  }

  return (
    <form className="open-web-form glass-panel" onSubmit={submit}>
      <input
        className="open-web-input"
        type="text"
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(''); }}
        placeholder="reflection-writer.web.app"
        aria-label="Web address"
        autoFocus
      />
      <button type="submit" className="shared-tab-stop">Open</button>
      <button type="button" className="shared-tab-stop" onClick={() => { setEditing(false); setError(''); }}>Cancel</button>
      {error && <span className="open-web-error" role="alert">{error}</span>}
    </form>
  );
}
