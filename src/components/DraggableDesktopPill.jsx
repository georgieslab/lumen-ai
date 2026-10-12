import React, { useRef, useState } from 'react';

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

export default function DraggableDesktopPill({ id, label, title, icon, position, onSelect, size = 'regular', isActive = false }) {
  const storageKey = `lumen_desktop_pill_${id}`;
  const [offset, setOffset] = useState(() => readPosition(storageKey));
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const pill = event.currentTarget;
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      onSelect?.({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      });
    }
  };

  return (
    <div
      className={`desktop-action-pill${size === 'large' ? ' desktop-action-pill--large' : ''}${isDragging ? ' is-dragging' : ''}${isActive ? ' is-morph-active' : ''}`}
      style={{
        left: position.left,
        top: position.top,
        '--desktop-pill-drag-x': `${offset.x}px`,
        '--desktop-pill-drag-y': `${offset.y}px`
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      title={title}
      aria-label={label}
    >
      <span className="desktop-action-pill-icon" aria-hidden="true">{icon}</span>
      <span className="desktop-action-pill-label">{label}</span>
    </div>
  );
}
