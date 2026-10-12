import React, { useState } from 'react';

export default function ComparisonCard({ widget }) {
  if (!widget || widget.widgetType !== 'comparison') return null;

  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const {
    title = 'Comparative Analysis',
    category = 'Decision Matrix',
    summary,
    criteria = [],
    options = [],
    recommendation
  } = widget;

  const handleCopyMarkdown = () => {
    let md = `### ${title}\n\n`;
    if (summary) md += `${summary}\n\n`;

    // Markdown Table
    const headers = ['Criteria', ...options.map(o => o.name)];
    md += `| ${headers.join(' | ')} |\n`;
    md += `| ${headers.map(() => '---').join(' | ')} |\n`;

    criteria.forEach(crit => {
      const row = [crit, ...options.map(o => o.values?.[crit] || '—')];
      md += `| ${row.join(' | ')} |\n`;
    });

    if (recommendation) {
      md += `\n**Recommendation:** ${recommendation}\n`;
    }

    navigator.clipboard?.writeText?.(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="agent-comparison-card">
      <div className="agent-comparison-header">
        <div className="agent-comparison-top-row">
          <div className="agent-comparison-badge">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M12 3v18" />
              <path d="M3 12h18" />
            </svg>
            <span>Decision Matrix</span>
          </div>
          {category && <span className="agent-comparison-category">{category}</span>}
        </div>
        <h4 className="agent-comparison-title">{title}</h4>
        {summary && <p className="agent-comparison-summary">{summary}</p>}
      </div>

      {/* Mobile Tab Switcher */}
      <div className="agent-comparison-mobile-tabs">
        {options.map((opt, idx) => (
          <button
            key={opt.id || idx}
            type="button"
            className={`agent-tab-pill ${activeTab === idx ? 'is-active' : ''}`}
            onClick={() => setActiveTab(idx)}
          >
            <span>{opt.name}</span>
            {opt.highlight && <span className="agent-tab-highlight-dot" title={opt.highlight} />}
          </button>
        ))}
      </div>

      {/* Desktop Comparative Table View */}
      <div className="agent-comparison-table-wrap">
        <table className="agent-comparison-table">
          <thead>
            <tr>
              <th className="criteria-col-head">Dimension</th>
              {options.map((opt, idx) => (
                <th key={opt.id || idx} className={`option-col-head ${opt.highlight ? 'has-highlight' : ''}`}>
                  <div className="option-head-inner">
                    {opt.highlight && (
                      <span className="option-highlight-badge">{opt.highlight}</span>
                    )}
                    <div className="option-name">{opt.name}</div>
                    {opt.rating && <div className="option-rating">⭐ {opt.rating}</div>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {criteria.map((crit, cIdx) => (
              <tr key={cIdx}>
                <td className="criteria-label-cell">{crit}</td>
                {options.map((opt, oIdx) => (
                  <td key={oIdx} className={`criteria-value-cell ${opt.highlight ? 'is-highlighted-col' : ''}`}>
                    {opt.values?.[crit] || '—'}
                  </td>
                ))}
              </tr>
            ))}
            {/* Pros Row */}
            {options.some(o => o.pros?.length > 0) && (
              <tr className="pros-cons-row">
                <td className="criteria-label-cell">Pros</td>
                {options.map((opt, oIdx) => (
                  <td key={oIdx} className={`criteria-value-cell pros-cell ${opt.highlight ? 'is-highlighted-col' : ''}`}>
                    {Array.isArray(opt.pros) && opt.pros.length > 0 ? (
                      <ul className="pro-list">
                        {opt.pros.map((p, pIdx) => (
                          <li key={pIdx}>+ {p}</li>
                        ))}
                      </ul>
                    ) : '—'}
                  </td>
                ))}
              </tr>
            )}
            {/* Cons Row */}
            {options.some(o => o.cons?.length > 0) && (
              <tr className="pros-cons-row">
                <td className="criteria-label-cell">Cons</td>
                {options.map((opt, oIdx) => (
                  <td key={oIdx} className={`criteria-value-cell cons-cell ${opt.highlight ? 'is-highlighted-col' : ''}`}>
                    {Array.isArray(opt.cons) && opt.cons.length > 0 ? (
                      <ul className="con-list">
                        {opt.cons.map((c, cIdx) => (
                          <li key={cIdx}>- {c}</li>
                        ))}
                      </ul>
                    ) : '—'}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View for Active Tab */}
      <div className="agent-comparison-mobile-card">
        {options[activeTab] && (
          <div className="mobile-option-panel">
            <div className="mobile-option-header">
              <div className="mobile-option-title-row">
                <span className="mobile-option-name">{options[activeTab].name}</span>
                {options[activeTab].rating && (
                  <span className="mobile-option-rating">⭐ {options[activeTab].rating}</span>
                )}
              </div>
              {options[activeTab].highlight && (
                <span className="option-highlight-badge">{options[activeTab].highlight}</span>
              )}
            </div>

            <div className="mobile-criteria-list">
              {criteria.map((crit, cIdx) => (
                <div key={cIdx} className="mobile-criteria-row">
                  <span className="mobile-crit-label">{crit}</span>
                  <span className="mobile-crit-value">{options[activeTab].values?.[crit] || '—'}</span>
                </div>
              ))}
            </div>

            {options[activeTab].pros?.length > 0 && (
              <div className="mobile-procon-section">
                <span className="mobile-procon-title is-pros">Pros:</span>
                <ul className="pro-list">
                  {options[activeTab].pros.map((p, pIdx) => (
                    <li key={pIdx}>+ {p}</li>
                  ))}
                </ul>
              </div>
            )}

            {options[activeTab].cons?.length > 0 && (
              <div className="mobile-procon-section">
                <span className="mobile-procon-title is-cons">Trade-offs:</span>
                <ul className="con-list">
                  {options[activeTab].cons.map((c, cIdx) => (
                    <li key={cIdx}>- {c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recommendation Banner */}
      {recommendation && (
        <div className="agent-comparison-recommendation">
          <div className="recommendation-badge">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="7" />
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
            </svg>
            <span>Recommendation</span>
          </div>
          <p className="recommendation-text">{recommendation}</p>
        </div>
      )}

      {/* Actions */}
      <div className="agent-comparison-actions">
        <button
          type="button"
          className="agent-comparison-btn is-copy"
          onClick={handleCopyMarkdown}
        >
          {copied ? '✓ Copied Markdown' : 'Copy Table'}
        </button>
      </div>
    </div>
  );
}

