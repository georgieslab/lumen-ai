import React, { useState } from 'react';

export default function BudgetCard({ widget }) {
  const [copied, setCopied] = useState(false);
  const [expandedCat, setExpandedCat] = useState(null);

  if (!widget || !Array.isArray(widget.categories)) return null;

  const {
    title = 'Budget & Expense Allocation',
    category,
    summary,
    currency = '$',
    totalBudget = 0,
    allocatedTotal = 0,
    categories = [],
    savingsTips = []
  } = widget;

  const formatMoney = (amount) => {
    return Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: Number(amount) % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
  };

  const toggleCategory = (catId) => {
    setExpandedCat((prev) => (prev === catId ? null : catId));
  };

  const handleCopyBudget = async () => {
    try {
      const lines = [
        `💰 ${title} - Total: ${currency}${formatMoney(totalBudget)}`,
        ''
      ];
      if (summary) lines.push(summary, '');

      lines.push('--- CATEGORY BREAKDOWN ---');
      categories.forEach((cat) => {
        lines.push(`• ${cat.name}: ${currency}${formatMoney(cat.allocated)} (${cat.percentage || 0}%)`);
        if (Array.isArray(cat.items) && cat.items.length > 0) {
          cat.items.forEach((it) => lines.push(`   - ${it}`));
        }
        if (cat.tip) lines.push(`   💡 Tip: ${cat.tip}`);
      });

      if (Array.isArray(savingsTips) && savingsTips.length > 0) {
        lines.push('', '--- SMART SAVINGS TIPS ---');
        savingsTips.forEach((tip) => lines.push(`• ${tip}`));
      }

      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      setCopied(false);
    }
  };

  return (
    <div className="agent-budget-card animate-fade-in">
      {/* Header */}
      <div className="agent-budget-header">
        <div className="agent-budget-badge">
          <span className="budget-badge-icon">💰</span>
          <span>Budget & Allocation</span>
        </div>
        {category && <span className="agent-budget-cat-tag">{category}</span>}
      </div>

      {/* Main Budget Number & Title */}
      <div className="agent-budget-main-row">
        <div className="agent-budget-info">
          <h3 className="agent-budget-title">{title}</h3>
          {summary && <p className="agent-budget-summary">{summary}</p>}
        </div>
        <div className="agent-budget-total-box">
          <span className="agent-budget-total-label">Total Budget</span>
          <div className="agent-budget-total-amount">
            <span className="agent-budget-currency">{currency}</span>
            <span className="agent-budget-digits">{formatMoney(totalBudget)}</span>
          </div>
        </div>
      </div>

      {/* Stacked Horizontal Allocation Bar */}
      <div className="agent-budget-stacked-bar-wrap">
        <div className="agent-budget-stacked-bar">
          {categories.map((cat, idx) => {
            const pct = Math.max(2, cat.percentage || 0);
            return (
              <div
                key={cat.id || idx}
                className="stacked-bar-segment"
                style={{
                  width: `${pct}%`,
                  backgroundColor: cat.color || '#38bdf8'
                }}
                title={`${cat.name}: ${currency}${formatMoney(cat.allocated)} (${cat.percentage}%)`}
              />
            );
          })}
        </div>
        <div className="agent-budget-bar-legend">
          {categories.map((cat, idx) => (
            <div key={cat.id || idx} className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: cat.color || '#38bdf8' }} />
              <span className="legend-name">{cat.name}</span>
              <span className="legend-pct">{cat.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Category Cards List */}
      <div className="agent-budget-categories-list">
        {categories.map((cat, idx) => {
          const isExpanded = expandedCat === (cat.id || idx);
          const hasDetails = (Array.isArray(cat.items) && cat.items.length > 0) || Boolean(cat.tip);

          return (
            <div
              key={cat.id || idx}
              className={`budget-cat-card ${isExpanded ? 'is-expanded' : ''} ${hasDetails ? 'is-clickable' : ''}`}
              onClick={() => hasDetails && toggleCategory(cat.id || idx)}
            >
              <div className="budget-cat-header">
                <div className="budget-cat-name-col">
                  <span className="budget-cat-color-bar" style={{ backgroundColor: cat.color || '#38bdf8' }} />
                  <span className="budget-cat-name">{cat.name}</span>
                </div>
                <div className="budget-cat-values-col">
                  <span className="budget-cat-amount">
                    {currency}{formatMoney(cat.allocated)}
                  </span>
                  <span className="budget-cat-pct-chip" style={{ borderColor: `${cat.color}55`, color: cat.color || '#38bdf8' }}>
                    {cat.percentage}%
                  </span>
                  {hasDetails && (
                    <span className="budget-cat-chevron">{isExpanded ? '▲' : '▼'}</span>
                  )}
                </div>
              </div>

              {/* Sub-items and Tips Drawer */}
              {isExpanded && (
                <div className="budget-cat-drawer animate-fade-in" onClick={(e) => e.stopPropagation()}>
                  {Array.isArray(cat.items) && cat.items.length > 0 && (
                    <div className="budget-cat-items-list">
                      {cat.items.map((item, iIdx) => (
                        <div key={iIdx} className="budget-sub-item">
                          <span className="sub-item-bullet">•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {cat.tip && (
                    <div className="budget-cat-tip">
                      <span className="tip-glyph">💡</span>
                      <span>{cat.tip}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Smart Savings Tips Callout */}
      {Array.isArray(savingsTips) && savingsTips.length > 0 && (
        <div className="agent-budget-tips-banner">
          <div className="tips-banner-header">
            <span className="tips-banner-icon">💡</span>
            <span className="tips-banner-title">Smart Savings & Optimization Tips</span>
          </div>
          <ul className="tips-banner-list">
            {savingsTips.map((tip, tIdx) => (
              <li key={tIdx} className="tips-banner-item">{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Bar */}
      <div className="agent-budget-actions">
        <button
          type="button"
          className="agent-budget-btn is-copy"
          onClick={handleCopyBudget}
        >
          <span>{copied ? '✓ Copied' : '📋 Copy Budget Breakdown'}</span>
        </button>
      </div>
    </div>
  );
}

