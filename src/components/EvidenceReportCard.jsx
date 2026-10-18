import React, { useState } from 'react';
import './EvidenceReportCard.css';

const verdicts = { supported: { label: 'Supported', icon: '✓' }, contradicted: { label: 'Contradicted', icon: '×' }, unresolved: { label: 'Unresolved', icon: '?' } };
const safeUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; } };

export default function EvidenceReportCard({ widget }) {
  const [copied, setCopied] = useState(false);
  if (widget?.widgetType !== 'evidence_report') return null;
  const claims = Array.isArray(widget.claims) ? widget.claims : [];
  const checked = new Date(widget.checkedAt);
  const copy = async () => {
    const lines = claims.map(claim => `${verdicts[claim.verdict]?.label || 'Unresolved'}: ${claim.claim}\n${claim.explanation}\n${(claim.sources || []).map(source => source.url).join('\n')}`);
    try { await navigator.clipboard.writeText(`${widget.title}\n\n${lines.join('\n\n')}`); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  };
  return <section className="evidence-report-card" aria-label="Evidence review">
    <header><div><span className="evidence-eyebrow">SOURCE REVIEW</span><h3>{widget.title}</h3></div><span className="evidence-count">{claims.length} claims</span></header>
    {widget.summary && <p className="evidence-summary">{widget.summary}</p>}
    <div className="evidence-verdict-summary">{Object.entries(verdicts).map(([key, value]) => <span key={key} className={`evidence-verdict evidence-verdict--${key}`}>{value.icon} {claims.filter(claim => claim.verdict === key).length} {value.label.toLowerCase()}</span>)}</div>
    <ol className="evidence-claims">{claims.map((claim, index) => {
      const verdict = verdicts[claim.verdict] || verdicts.unresolved;
      return <li key={claim.id || index}><div className="evidence-claim-heading"><strong>{claim.claim}</strong><span className={`evidence-verdict evidence-verdict--${claim.verdict}`}>{verdict.icon} {verdict.label}</span></div>
        <p>{claim.explanation}</p><div className="evidence-source-links">{(claim.sources || []).map((source, sourceIndex) => {
          const url = safeUrl(source.url);
          return url && <a key={`${url}-${sourceIndex}`} href={url} target="_blank" rel="noopener noreferrer">{source.title || new URL(url).hostname}<small>{source.observedBy === 'page' ? 'Page read' : 'Search result'} ↗</small></a>;
        })}</div></li>;
    })}</ol>
    {widget.limitations && <p className="evidence-limitations"><strong>Limits of this review:</strong> {widget.limitations}</p>}
    <footer><span>{Number.isFinite(checked.getTime()) ? `Reviewed ${checked.toLocaleString()}` : 'Source review'} · Unresolved does not mean false.</span><button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy evidence'}</button></footer>
  </section>;
}
