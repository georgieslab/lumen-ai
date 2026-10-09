import React, { useRef, useState } from 'react';

function readPosition(storageKey) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) {
      return { x: Math.max(-2000, Math.min(2000, value.x)), y: Math.max(-2000, Math.min(2000, value.y)) };
    }
  } catch (_) {}
  return { x: 0, y: 0 };
}

export default function DraggableDesktopPill({ id, label, title, icon, position, onSelect, size = 'regular' }) {
  const storageKey = `lumen_desktop_pill_${id}`;
  const [offset, setOffset] = useState(() => readPosition(storageKey));
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const pill = event.currentTarget.closest('.desktop-action-pill');
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
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rawX = event.clientX - drag.startX;
    const rawY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(rawX, rawY) < 5) return;
    if (!drag.moved) setIsDragging(true);
    drag.moved = true;

    const margin = 10;
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
    dragRef.current = null;
    if (!drag.moved) return;

    setIsDragging(false);
    setOffset(drag.nextOffset);
    try {
      localStorage.setItem(storageKey, JSON.stringify(drag.nextOffset));
    } catch (_) {}
  };

  return (
    <div
      className={`desktop-action-pill${size === 'large' ? ' desktop-action-pill--large' : ''}${isDragging ? ' is-dragging' : ''}`}
      style={{
        left: position.left,
        top: position.top,
        '--desktop-pill-drag-x': `${offset.x}px`,
        '--desktop-pill-drag-y': `${offset.y}px`
      }}
    >
      <button type="button" className="desktop-action-pill-main" onClick={onSelect} title={title}>
        <span className="desktop-action-pill-icon" aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </button>
      <button
        type="button"
        className="desktop-action-pill-grip"
        aria-label={title}
        title={title}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        ⠿
      </button>
    </div>
  );
}
