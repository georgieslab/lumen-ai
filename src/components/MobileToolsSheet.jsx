import React, { useEffect, useMemo, useRef, useState } from 'react';

const primaryGroups = [
  { title: 'Plan & decide', ids: ['day', 'decision'] },
  { title: 'Research & follow', ids: ['verify', 'watches'] },
  { title: 'Your workspace', ids: ['projects', 'weather', 'persona'] }
];

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>;
}

export default function MobileToolsSheet({ actions, utilityActions, onSelect, onClose, onSettings }) {
  const panel = useRef(null);
  const close = useRef(null);
  const search = useRef(null);
  const content = useRef(null);
  const closeAction = useRef(onClose);
  closeAction.current = onClose;
  const [query, setQuery] = useState('');
  const [view, setView] = useState('everyday');
  const allActions = useMemo(() => [...actions, ...utilityActions], [actions, utilityActions]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = allActions.filter(action => `${action.label} ${action.description || ''}`.toLocaleLowerCase().includes(normalizedQuery));
  const groups = normalizedQuery ? [{ title: 'Search results', actions: filtered }] : [
    ...primaryGroups.map(group => ({ title: group.title, actions: group.ids.map(id => allActions.find(action => action.id === id)).filter(Boolean) })),
    ...(view === 'all' ? [{ title: 'Create & explore', actions: actions.filter(action => !primaryGroups.some(group => group.ids.includes(action.id))) }] : [])
  ].filter(group => group.actions.length);

  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const backdrop = panel.current.parentElement;
    const root = backdrop.parentElement;
    const previousInert = new Map();
    const lockBackground = () => [...root.children].filter(element => element !== backdrop && element instanceof HTMLElement).forEach(element => {
      if (!previousInert.has(element)) previousInert.set(element, element.inert);
      element.inert = true;
    });
    lockBackground();
    const observer = new MutationObserver(lockBackground);
    observer.observe(root, { childList: true });
    close.current?.focus({ preventScroll: true });
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeAction.current(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')].filter(element => element.offsetParent !== null);
      const first = controls[0]; const last = controls.at(-1);
      if (!panel.current.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      observer.disconnect();
      document.body.style.overflow = previousOverflow;
      previousInert.forEach((inert, element) => { element.inert = inert; });
      if (previous?.isConnected) previous.focus?.({ preventScroll: true });
    };
  }, []);
  useEffect(() => { content.current?.scrollTo({ top: 0, behavior: 'instant' }); }, [normalizedQuery, view]);

  const card = action => <button type="button" key={action.id} className={`mobile-tool-card mobile-tool-card--${action.id}`}
    onClick={() => onSelect(action)} aria-label={action.label} aria-describedby={`mobile-tool-description-${action.id}`}>
    <span className="mobile-tool-icon" aria-hidden="true">{action.icon}</span>
    <span className="mobile-tool-copy"><strong>{action.label}</strong><small id={`mobile-tool-description-${action.id}`}>{action.description}</small></span>
    <svg className="mobile-tool-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
  </button>;

  return <div className="mobile-tools-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panel} className="mobile-tools-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-tools-title" aria-describedby="mobile-tools-description">
      <header className="mobile-tools-header">
        <div className="mobile-tools-heading"><span className="mobile-tools-eyebrow"><i aria-hidden="true" />LUMEN WORKSPACE</span><h2 id="mobile-tools-title">Your tools<span aria-hidden="true">.</span></h2><p id="mobile-tools-description">Plan, research, and organize.</p></div>
        <button type="button" ref={close} className="mobile-tools-close" onClick={onClose} aria-label="Close tools"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg></button>
      </header>
      <div className="mobile-tools-controls">
        <div className="mobile-tools-search"><SearchIcon /><input ref={search} type="search" placeholder="Find a tool" aria-label="Find a tool" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" spellCheck="false" />{query && <button type="button" aria-label="Clear tool search" onClick={() => { setQuery(''); search.current?.focus(); }}>×</button>}</div>
        <div className="mobile-tools-toolbar"><nav className="mobile-tools-segments" aria-label="Tool categories"><button type="button" aria-pressed={view === 'everyday'} className={view === 'everyday' ? 'is-selected' : ''} onClick={() => { setView('everyday'); setQuery(''); }}>Everyday</button><button type="button" aria-pressed={view === 'all'} className={view === 'all' ? 'is-selected' : ''} onClick={() => { setView('all'); setQuery(''); }}>All tools<span>{allActions.length}</span></button></nav><span className="mobile-tools-result-count" role="status">{normalizedQuery ? `${filtered.length} result${filtered.length === 1 ? '' : 's'}` : `${groups.reduce((count, group) => count + group.actions.length, 0)} tools`}</span></div>
      </div>
      <div ref={content} className="mobile-tools-content" key={normalizedQuery ? 'search' : view}>
        {groups.map(group => <section className="mobile-tools-group" key={group.title} aria-label={group.title}><h3>{group.title}</h3><div>{group.actions.map(card)}</div></section>)}
        {normalizedQuery && !filtered.length && <div className="mobile-tools-empty"><SearchIcon /><strong>No tools found</strong><p>Try “plan”, “weather”, or “budget”.</p><button type="button" onClick={() => { setQuery(''); search.current?.focus(); }}>Clear search</button></div>}
      </div>
      <footer className="mobile-tools-footer"><button type="button" className="mobile-tools-settings" onClick={onSettings}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" /><circle cx="15" cy="17" r="3" /></svg>Preferences</button><button type="button" className="mobile-tools-done" onClick={onClose}>Done</button></footer>
    </section>
  </div>;
}
