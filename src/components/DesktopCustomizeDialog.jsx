import React, { useEffect, useRef } from 'react';
import { DESKTOP_ITEMS } from '../services/desktopLayout.js';
import './DesktopPills.css';

export default function DesktopCustomizeDialog({ visibility, onToggle, onSetAll, onReset, onClose }) {
  const dialog = useRef(null);
  const close = useRef(null);
  const closeAction = useRef(onClose); closeAction.current = onClose;
  useEffect(() => {
    const previous = document.activeElement; close.current?.focus();
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeAction.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    };
    document.addEventListener('keydown', keydown, true);
    return () => { document.removeEventListener('keydown', keydown, true); previous?.focus?.(); };
  }, []);
  return <div className="desktop-customize-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className="desktop-customize-dialog" role="dialog" aria-modal="true" aria-labelledby="desktop-customize-title">
      <header><div><span>MAKE ROOM FOR YOUR WORK</span><h2 id="desktop-customize-title">Customize desktop</h2></div><button ref={close} type="button" onClick={onClose} aria-label="Close desktop customization">×</button></header>
      <p>Choose what stays on your desktop. Drag a pill to move it, or use its × to hide it. Tools are always available in Explore.</p>
      <div className="desktop-visibility-actions"><button type="button" onClick={() => onSetAll(true)}>Show all</button><button type="button" onClick={() => onSetAll(false)}>Hide all</button><button type="button" onClick={onReset}>Restore defaults & positions</button></div>
      <div className="desktop-visibility-list">{DESKTOP_ITEMS.map(item => <label key={item.id}><span>{item.label}</span><input type="checkbox" checked={visibility[item.id]} onChange={event => onToggle(item.id, event.target.checked)} aria-label={`Show ${item.label}`} /></label>)}</div>
      <footer><span>Saved on this browser. On phones, open tools from Explore.</span><button type="button" onClick={onClose}>Done</button></footer>
    </section>
  </div>;
}
