import React, { useState } from 'react';

export default function DailyBriefCard({ widget }) {
  const [copied, setCopied] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (!widget || !Array.isArray(widget.stories)) return null;

  const {
    title = 'Worldwide AI & Frontier Tech Intelligence Brief',
    date,
    scope = 'Worldwide',
    summary,
    stories = [],
    weather
  } = widget;

  // Extract unique categories
  const categories = Array.from(new Set(stories.map(s => s.category).filter(Boolean)));

  const filteredStories = stories.filter(s => {
    if (selectedCategory === 'all') return true;
    return s.category === selectedCategory;
  });

  const handleCopy = async () => {
    try {
      const lines = [
        `☀ ${title}${date ? ` (${date})` : ''}`,
        `Scope: ${scope}`,
        ''
      ];
      if (summary) {
        lines.push(`Executive Summary: ${summary}`, '');
      }
      lines.push('--- TOP DEVELOPMENTS ---');
      stories.forEach((s, idx) => {
        lines.push(`${idx + 1}. ${s.headline}`);
        if (s.publisher || s.publishedAt) {
          lines.push(`   Source: ${s.publisher || 'Verified'} ${s.publishedAt ? `· ${s.publishedAt}` : ''}`);
        }
        lines.push(`   Summary: ${s.summary}`);
        if (s.whyItMatters) {
          lines.push(`   Why it matters: ${s.whyItMatters}`);
        }
        if (s.url) {
          lines.push(`   Link: ${s.url}`);
        }
        lines.push('');
      });

      if (weather && weather.city) {
        lines.push(`Weather (${weather.city}): ${weather.temp || '--'} · ${weather.condition || 'Clear'}`);
      }

      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      setCopied(false);
    }
  };

  const handleToggleSpeech = () => {
    if (!window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const textToSpeak = `${title}. ${summary ? `Executive Summary: ${summary}.` : ''} Top stories: ${stories.map(s => s.headline).join('. ')}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.05;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="agent-daily-brief-card animate-fade-in">
      {/* Header Banner */}
      <div className="daily-brief-header">
        <div className="daily-brief-header-left">
          <div className="daily-brief-badge">
            <span className="daily-brief-badge-icon">☀</span>
            <span>DAILY INTELLIGENCE BRIEF</span>
          </div>
          <span className="daily-brief-scope-tag">🌐 {scope}</span>
          {date && <span className="daily-brief-date-tag">{date}</span>}
        </div>

        <div className="daily-brief-actions">
          {window.speechSynthesis && (
            <button
              type="button"
              className={`daily-brief-action-btn ${isSpeaking ? 'active' : ''}`}
              onClick={handleToggleSpeech}
              title={isSpeaking ? 'Stop read aloud' : 'Listen to brief audio summary'}
            >
              {isSpeaking ? '⏹ Stop Audio' : '🎧 Audio Brief'}
            </button>
          )}
          <button
            type="button"
            className="daily-brief-action-btn"
            onClick={handleCopy}
            title="Copy brief as markdown"
          >
            {copied ? '✓ Copied!' : '📋 Copy Brief'}
          </button>
        </div>
      </div>

      {/* Main Title & Executive Summary */}
      <div className="daily-brief-hero">
        <h3 className="daily-brief-title">{title}</h3>
        {summary && (
          <div className="daily-brief-summary-box">
            <span className="daily-brief-summary-label">⚡ EXECUTIVE SUMMARY</span>
            <p className="daily-brief-summary-text">{summary}</p>
          </div>
        )}
      </div>

      {/* Category Filter Pills (if multiple categories present) */}
      {categories.length > 1 && (
        <div className="daily-brief-filter-row">
          <button
            type="button"
            className={`daily-brief-filter-chip ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            All Stories ({stories.length})
          </button>
          {categories.map((catKey) => {
            const count = stories.filter(s => s.category === catKey).length;
            const label = stories.find(s => s.category === catKey)?.categoryLabel || catKey;
            const icon = stories.find(s => s.category === catKey)?.categoryIcon || '📌';
            return (
              <button
                key={catKey}
                type="button"
                className={`daily-brief-filter-chip ${selectedCategory === catKey ? 'active' : ''}`}
                onClick={() => setSelectedCategory(catKey)}
              >
                {icon} {label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Stories Feed */}
      <div className="daily-brief-stories-list">
        {filteredStories.map((story, idx) => (
          <article key={story.id || idx} className="daily-brief-story-item">
            {/* Story Meta Header */}
            <div className="story-meta-header">
              <span
                className="story-cat-badge"
                style={{
                  backgroundColor: `${story.categoryColor || '#38bdf8'}22`,
                  borderColor: `${story.categoryColor || '#38bdf8'}66`,
                  color: story.categoryColor || '#38bdf8'
                }}
              >
                {story.categoryIcon || '🤖'} {story.categoryLabel || 'Frontier AI'}
              </span>

              <div className="story-source-row">
                {story.publisher && (
                  <span className="story-publisher-chip">📰 {story.publisher}</span>
                )}
                {story.publishedAt && (
                  <span className="story-time-chip">⏱ {story.publishedAt}</span>
                )}
              </div>
            </div>

            {/* Story Headline */}
            <h4 className="story-headline">
              {story.url ? (
                <a
                  href={story.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="story-headline-link"
                >
                  {story.headline}
                  <span className="story-external-icon">↗</span>
                </a>
              ) : (
                story.headline
              )}
            </h4>

            {/* Factual Summary */}
            <p className="story-summary-text">{story.summary}</p>

            {/* "Why It Matters" Strategic Impact Box */}
            {story.whyItMatters && (
              <div className="story-impact-box">
                <span className="story-impact-label">💡 WHY IT MATTERS</span>
                <span className="story-impact-text">{story.whyItMatters}</span>
              </div>
            )}

            {/* Story Link Footer */}
            {story.url && (
              <div className="story-link-footer">
                <a
                  href={story.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="story-read-btn"
                >
                  Read original coverage on {story.publisher || 'source'} ↗
                </a>
              </div>
            )}
          </article>
        ))}
      </div>

      {/* Optional Local Weather Snapshot (cleanly separated at footer) */}
      {weather && weather.city && (
        <div className="daily-brief-weather-footer">
          <div className="weather-footer-left">
            <span className="weather-footer-icon">🌤️</span>
            <span className="weather-footer-title">Local Conditions: {weather.city}</span>
          </div>
          <div className="weather-footer-values">
            <span className="weather-footer-temp">{weather.temp || '--'}</span>
            <span className="weather-footer-condition">{weather.condition || 'Clear'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

