import React, { useEffect, useId, useRef, useState } from 'react';
import { RESPONSE_STYLES } from '../../services/responsePreferences.js';
import './ReplyModePicker.css';

function ReplyIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h11M4 18h6" /></svg>;
}

export default function ReplyModePicker({ value, onChange, copy, inline = false }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const id = useId();
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true });
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const options = RESPONSE_STYLES.map(style => <button
    key={style}
    type="button"
    className={`reply-mode-option ${value === style ? 'is-selected' : ''}`}
    role={inline ? undefined : 'menuitemradio'}
    tabIndex={inline ? undefined : -1}
    aria-checked={inline ? undefined : value === style}
    aria-pressed={inline ? value === style : undefined}
    aria-label={copy.styles[style]}
    aria-describedby={`${id}-${style}-description`}
    onClick={() => { onChange(style); if (!inline) close(true); }}
  >
    <span className="reply-mode-option-copy"><strong>{copy.styles[style]}</strong><small id={`${id}-${style}-description`}>{copy.styleDescriptions[style]}</small></span>
    <span className="reply-mode-option-check" aria-hidden="true">{value === style && <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 10 4 4 8-8" /></svg>}</span>
  </button>);

  if (inline) return <section className="reply-mode-settings" aria-labelledby={`${id}-heading`}>
    <h3 id={`${id}-heading`}>{copy.responseStyle}</h3>
    <p>{copy.styleHint}</p>
    <div className="reply-mode-options" role="group" aria-labelledby={`${id}-heading`}>{options}</div>
    <p className="reply-mode-hint">{copy.simpleUpdatesHint}</p>
  </section>;

  return <div ref={root} className="reply-mode-picker" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
    <button ref={trigger} type="button" className={`reply-mode-trigger ${open ? 'is-open' : ''}`}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? `${id}-menu` : undefined}
      aria-label={`${copy.responseStyle}: ${copy.styles[value]}`} title={copy.chooseStyle}
      onClick={() => setOpen(current => !current)}
      onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }}>
      <ReplyIcon /><span>{copy.styles[value]}</span><svg className="reply-mode-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
    </button>
    {open && <div className="reply-mode-popover">
      <span className="reply-mode-menu-title" id={`${id}-heading`}>{copy.chooseStyle}</span>
      <div ref={menu} id={`${id}-menu`} className="reply-mode-options" role="menu" aria-labelledby={`${id}-heading`}
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
          const buttons = [...menu.current.querySelectorAll('[role="menuitemradio"]')];
          const index = buttons.indexOf(document.activeElement);
          let next;
          if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
          if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
          if (event.key === 'Home') next = 0;
          if (event.key === 'End') next = buttons.length - 1;
          if (next !== undefined) { event.preventDefault(); buttons[next]?.focus(); }
        }}>{options}</div>
      <p className="reply-mode-hint">{copy.simpleUpdatesHint}</p>
    </div>}
  </div>;
}
