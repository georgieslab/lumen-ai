import React, { useState } from 'react';

const PRIORITY_STYLES = {
  high: { label: 'High Priority', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  low: { label: 'Low', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' }
};

export default function ChecklistCard({ widget }) {
  if (!widget || widget.widgetType !== 'checklist') return null;

  const [items, setItems] = useState(
    Array.isArray(widget.items)
      ? widget.items.map(it => ({ ...it, completed: Boolean(it.completed) }))
      : []
  );
  const [copied, setCopied] = useState(false);

  const toggleItem = (id) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  };

  const completedCount = items.filter(i => i.completed).length;
  const totalCount = items.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleCopy = () => {
    const text = `# ${widget.title || 'Checklist'}\n\n` +
      items.map(i => `- [${i.completed ? 'x' : ' '}] ${i.text}${i.category ? ` (${i.category})` : ''}`).join('\n');
    navigator.clipboard?.writeText?.(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleAll = () => {
    const allCompleted = items.every(i => i.completed);
    setItems(prev => prev.map(item => ({ ...item, completed: !allCompleted })));
  };

  return (
    <div className="agent-checklist-card">
      <div className="agent-checklist-header">
        <div className="agent-checklist-title-area">
          <div className="agent-checklist-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
            <span>Action Plan</span>
          </div>
          {widget.category && <span className="agent-checklist-category">{widget.category}</span>}
        </div>
        <h4 className="agent-checklist-title">{widget.title || 'Action Checklist'}</h4>
        {widget.description && <p className="agent-checklist-desc">{widget.description}</p>}

        <div className="agent-checklist-progress-bar-wrap">
          <div className="agent-checklist-progress-info">
            <span>{completedCount} of {totalCount} completed</span>
            <span className="agent-checklist-percent">{percent}%</span>
          </div>
          <div className="agent-checklist-progress-track">
            <div className="agent-checklist-progress-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      <div className="agent-checklist-items">
        {items.map((item) => {
          const prio = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.medium;
          return (
            <div
              key={item.id}
              className={`agent-checklist-item ${item.completed ? 'is-completed' : ''}`}
              onClick={() => toggleItem(item.id)}
              role="checkbox"
              aria-checked={item.completed}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  toggleItem(item.id);
                }
              }}
            >
              <div className={`agent-checklist-checkbox ${item.completed ? 'checked' : ''}`}>
                {item.completed && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>

              <div className="agent-checklist-item-body">
                <span className="agent-checklist-item-text">{item.text}</span>
                <div className="agent-checklist-item-meta">
                  {item.category && item.category !== 'General' && (
                    <span className="agent-checklist-tag">{item.category}</span>
                  )}
                  {item.estimate && (
                    <span className="agent-checklist-estimate">⏱ {item.estimate}</span>
                  )}
                  {item.priority && item.priority !== 'medium' && (
                    <span
                      className="agent-checklist-priority-tag"
                      style={{ color: prio.color, backgroundColor: prio.bg }}
                    >
                      {prio.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="agent-checklist-actions">
        <button
          type="button"
          className="agent-checklist-btn"
          onClick={handleToggleAll}
        >
          {items.every(i => i.completed) ? 'Uncheck All' : 'Check All'}
        </button>
        <button
          type="button"
          className="agent-checklist-btn is-copy"
          onClick={handleCopy}
        >
          {copied ? '✓ Copied' : 'Copy Plan'}
        </button>
      </div>
    </div>
  );
}

