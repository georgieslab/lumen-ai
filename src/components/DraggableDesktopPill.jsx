import React, { useEffect, useRef, useState } from 'react';
import './DesktopPills.css';

function readPosition(storageKey) {
  try {
    const isSmallScreen = typeof window !== 'undefined' && window.innerWidth <= 768;
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) {
      const maxOffset = isSmallScreen ? 140 : 2000;
      return {
        x: Math.max(-maxOffset, Math.min(maxOffset, value.x)),
        y: Math.max(-maxOffset, Math.min(maxOffset, value.y))
      };
    }
  } catch (_) {}
  return { x: 0, y: 0 };
}

export default function DraggableDesktopPill({ id, label, title, icon, position, onSelect, onHide, badge = 0, size = 'regular', isActive = false }) {
  const storageKey = `lumen_desktop_pill_${id}`;
  const [offset, setOffset] = useState(() => readPosition(storageKey));
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    let frame;
    const clamp = () => {
      const element = wrapperRef.current;
      const stage = element?.closest('.lumen-main-stage');
      if (!element || !stage || !element.offsetWidth || dragRef.current) return;
      const box = element.getBoundingClientRect(); const bounds = stage.getBoundingClientRect();
      const scale = box.width / element.offsetWidth || 1;
      const dx = Math.max(bounds.left + 10 - box.left, Math.min(bounds.right - 10 - box.right, 0));
      const dy = Math.max(bounds.top + 10 - box.top, Math.min(bounds.bottom - 10 - box.bottom, 0));
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      setOffset(previous => { const next = { x: previous.x + dx / scale, y: previous.y + dy / scale }; try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {} return next; });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(clamp); };
    const observer = new ResizeObserver(schedule);
    const stage = wrapperRef.current?.closest('.lumen-main-stage');
    if (stage) observer.observe(stage);
    window.addEventListener('resize', schedule); schedule();
    return () => { observer.disconnect(); window.removeEventListener('resize', schedule); cancelAnimationFrame(frame); };
  }, [position.left, position.top, storageKey]);

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const pill = wrapperRef.current;
    const stage = pill?.closest('.lumen-main-stage');
    if (!pill || !stage) return;

    const zoomStyle = getComputedStyle(document.documentElement).zoom;
    const parsedZoom = parseFloat(zoomStyle);
    const scale = zoomStyle.endsWith('%') ? parsedZoom / 100 : parsedZoom || 1;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      pillRect: pill.getBoundingClientRect(),
      stageRect: stage.getBoundingClientRect(),
      startOffset: offset,
      nextOffset: offset,
      scale: scale > 0 ? scale : 1,
      moved: false
    };
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rawX = event.clientX - drag.startX;
    const rawY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(rawX, rawY) < 5) return;

    if (!drag.moved) {
      setIsDragging(true);
      drag.moved = true;
      suppressClickRef.current = true;
    }

    const margin = 8;
    const minX = drag.stageRect.left + margin - drag.pillRect.left;
    const maxX = drag.stageRect.right - margin - drag.pillRect.right;
    const minY = drag.stageRect.top + margin - drag.pillRect.top;
    const maxY = drag.stageRect.bottom - margin - drag.pillRect.bottom;
    const deltaX = Math.max(minX, Math.min(maxX, rawX));
    const deltaY = Math.max(minY, Math.min(maxY, rawY));
    drag.nextOffset = {
      x: drag.startOffset.x + deltaX / drag.scale,
      y: drag.startOffset.y + deltaY / drag.scale
    };
    setOffset(drag.nextOffset);
  };

  const handlePointerEnd = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.moved) {
      suppressClickRef.current = true;
      setIsDragging(false);
      setOffset(drag.nextOffset);
      try {
        localStorage.setItem(storageKey, JSON.stringify(drag.nextOffset));
      } catch (_) {}
    }
    dragRef.current = null;
  };

  const handleClick = (e) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    onSelect?.({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    });
  };

  return (
    <div ref={wrapperRef} className={`desktop-pill-wrapper${isDragging ? ' is-dragging' : ''}`}
      style={{
        left: position.left,
        top: position.top,
        '--desktop-pill-drag-x': `${offset.x}px`,
        '--desktop-pill-drag-y': `${offset.y}px`
      }}>
    <button type="button"
      className={`desktop-action-pill${size === 'large' ? ' desktop-action-pill--large' : ''}${isDragging ? ' is-dragging' : ''}${isActive ? ' is-morph-active' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onClick={handleClick}
      title={`${title || label} · Drag to move`}
      aria-label={label}
    >
      <span className="desktop-action-pill-icon" aria-hidden="true">{icon}</span>
      <span className="desktop-action-pill-label">{label}</span>
    </button>
    {badge > 0 && <span className="desktop-pill-badge" aria-label={`${badge} unread alerts`}>{badge > 9 ? '9+' : badge}</span>}
    {onHide && <button type="button" className="desktop-pill-hide" aria-label={`Hide ${label} from desktop`} title="Hide from desktop · restore in Customize desktop" onClick={event => { event.stopPropagation(); onHide(id); }}>×</button>}
    </div>
  );
}
