import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { normalizeWebUrl } from './OpenWebPageButton';

export default function AgentActionModal({
  action,
  originRect = null,
  onClose,
  onExecute,
  onOpenWebPage,
  activeLanguage = 'en-US',
  defaultCity = 'Vienna',
  targetRole = 'Software Engineer'
}) {
  const cardRef = useRef(null);
  const backdropRef = useRef(null);
  const [isClosing, setIsClosing] = useState(false);

  // Common state across actions
  const [codeSnippet, setCodeSnippet] = useState('');
  const [codeFocus, setCodeFocus] = useState('bugs');
  const [codeLang, setCodeLang] = useState('javascript');

  const [scheduleStart, setScheduleStart] = useState('08:00');
  const [scheduleEnd, setScheduleEnd] = useState('18:00');
  const [schedulePriorities, setSchedulePriorities] = useState('');
  const [scheduleType, setScheduleType] = useState('work');

  const [budgetAmount, setBudgetAmount] = useState('3000');
  const [budgetCurrency, setBudgetCurrency] = useState('$');
  const [budgetPurpose, setBudgetPurpose] = useState('monthly');
  const [budgetNotes, setBudgetNotes] = useState('');

  const [seoUrl, setSeoUrl] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');

  const [webUrl, setWebUrl] = useState('');

  // Daily Brief specialized state
  const [briefFocus, setBriefFocus] = useState('frontier-ai');
  const [briefScope, setBriefScope] = useState('worldwide');
  const [briefCustomLocation, setBriefCustomLocation] = useState(defaultCity || 'San Francisco');
  const [briefFormat, setBriefFormat] = useState('executive');
  const [briefSelectedTags, setBriefSelectedTags] = useState(['models', 'agents', 'open-weights']);
  const [includeWeather, setIncludeWeather] = useState(false);

  const toggleBriefTag = (tagId) => {
    setBriefSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  // Quick clipboard paste helper
  const handlePasteClipboard = async (setter) => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) setter(text);
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }
  };

  // Sample code snippets for instant testing
  const insertSampleCode = () => {
    setCodeLang('javascript');
    setCodeSnippet(`async function fetchUserProfile(userId) {
  // TODO: Fix potential memory leak & race conditions
  let cache = {};
  const res = await fetch('/api/users/' + userId);
  if (!res.ok) throw new Error('Failed to load');
  const data = await res.json();
  cache[userId] = data;
  return data;
}`);
  };

  // Smooth container morph animation on open
  useLayoutEffect(() => {
    if (!action || !cardRef.current) return;
    const card = cardRef.current;
    const backdrop = backdropRef.current;

    if (originRect) {
      const cardRect = card.getBoundingClientRect();
      const scaleX = Math.max(0.06, originRect.width / Math.max(cardRect.width, 1));
      const scaleY = Math.max(0.04, originRect.height / Math.max(cardRect.height, 1));
      const deltaX = (originRect.x + originRect.width / 2) - (cardRect.x + cardRect.width / 2);
      const deltaY = (originRect.y + originRect.height / 2) - (cardRect.y + cardRect.height / 2);

      card.animate([
        {
          transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`,
          borderRadius: '999px',
          opacity: 0.85,
          boxShadow: '0 0 28px rgba(56, 189, 248, 0.7), inset 0 0 12px rgba(255, 255, 255, 0.5)'
        },
        {
          transform: 'translate(0px, 0px) scale(1, 1)',
          borderRadius: '20px',
          opacity: 1,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6), 0 0 32px rgba(56, 189, 248, 0.16), inset 0 1px 1px rgba(255, 255, 255, 0.25)'
        }
      ], {
        duration: 380,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'both'
      });
    } else {
      card.animate([
        { transform: 'scale(0.9)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 }
      ], {
        duration: 260,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'both'
      });
    }

    if (backdrop) {
      backdrop.animate([
        { opacity: 0 },
        { opacity: 1 }
      ], {
        duration: 280,
        easing: 'ease-out',
        fill: 'both'
      });
    }
  }, [action, originRect]);

  // Smooth reverse morph on close
  const handleAnimatedClose = (afterCloseCb) => {
    if (isClosing) return;
    setIsClosing(true);

    const card = cardRef.current;
    const backdrop = backdropRef.current;

    const finalize = () => {
      setIsClosing(false);
      onClose();
      if (typeof afterCloseCb === 'function') afterCloseCb();
    };

    if (originRect && card) {
      const cardRect = card.getBoundingClientRect();
      const scaleX = Math.max(0.06, originRect.width / Math.max(cardRect.width, 1));
      const scaleY = Math.max(0.04, originRect.height / Math.max(cardRect.height, 1));
      const deltaX = (originRect.x + originRect.width / 2) - (cardRect.x + cardRect.width / 2);
      const deltaY = (originRect.y + originRect.height / 2) - (cardRect.y + cardRect.height / 2);

      const anim = card.animate([
        {
          transform: 'translate(0px, 0px) scale(1, 1)',
          borderRadius: '20px',
          opacity: 1
        },
        {
          transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`,
          borderRadius: '999px',
          opacity: 0,
          boxShadow: '0 0 28px rgba(56, 189, 248, 0.8)'
        }
      ], {
        duration: 240,
        easing: 'cubic-bezier(0.2, 0, 0.3, 1)',
        fill: 'both'
      });

      if (backdrop) {
        backdrop.animate([
          { opacity: 1 },
          { opacity: 0 }
        ], {
          duration: 220,
          easing: 'ease-in',
          fill: 'both'
        });
      }

      anim.onfinish = finalize;
    } else if (card) {
      const anim = card.animate([
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(0.92)', opacity: 0 }
      ], {
        duration: 180,
        easing: 'ease-in',
        fill: 'both'
      });

      if (backdrop) {
        backdrop.animate([
          { opacity: 1 },
          { opacity: 0 }
        ], {
          duration: 180,
          easing: 'ease-in',
          fill: 'both'
        });
      }

      anim.onfinish = finalize;
    } else {
      finalize();
    }
  };

  // Close on Escape key
  useEffect(() => {
    if (!action) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') handleAnimatedClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [action]);

  if (!action) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    let prompt = '';
    if (action === 'code-analysis') {
      const focusLabels = {
        bugs: 'identify concrete bugs, security vulnerabilities, and runtime risks',
        perf: 'analyze execution performance, algorithmic complexity, and bottlenecks',
        refactor: 'suggest clean architecture, readability, and modern maintainability refactorings',
        explain: 'explain how this code works step-by-step with architecture diagrams if helpful'
      };
      prompt = `Review and analyze this ${codeLang} code:\n\`\`\`${codeLang}\n${codeSnippet || '// Paste code snippet here'}\n\`\`\`\nPrimary focus: Please ${focusLabels[codeFocus] || focusLabels.bugs}. Provide concrete recommendations and code diffs.`;
    } else if (action === 'day-schedule') {
      const typeLabels = {
        work: 'focused professional workday',
        study: 'intensive learning and study day',
        travel: 'travel and sightseeing itinerary',
        weekend: 'balanced weekend with chores and relaxation'
      };
      prompt = `Create a structured daily schedule for a ${typeLabels[scheduleType] || 'productive day'} from ${scheduleStart} to ${scheduleEnd}.${schedulePriorities.trim() ? ` Key priorities to include: ${schedulePriorities}.` : ' Include deep work sessions, collaborative time, meals, and recovery breaks.'}`;
    } else if (action === 'budget-planner') {
      const purposeLabels = {
        monthly: 'monthly living expenses and personal savings plan',
        travel: 'travel, accommodation, dining, and activities trip budget',
        project: 'project setup, equipment, tools, and contingency budget',
        event: 'event planning and vendor allocation budget'
      };
      prompt = `Create a comprehensive budget allocation plan for ${budgetCurrency}${budgetAmount} for a ${purposeLabels[budgetPurpose] || 'budget breakdown'}.${budgetNotes.trim() ? ` Additional details: ${budgetNotes}.` : ''} Calculate exact category breakdowns, percentage allocations, and actionable money-saving tips.`;
    } else if (action === 'seo-analysis') {
      prompt = `Inspect the SEO and search performance signals of this webpage: ${seoUrl || 'https://example.com'}.${seoKeywords.trim() ? ` Target keywords: ${seoKeywords}.` : ''} Analyze meta tags, headings, content relevance, technical performance, and recommend high-impact ranking improvements.`;
    } else if (action === 'daily-brief') {
      const scopeLabels = {
        worldwide: 'worldwide across global research labs and industry',
        us: 'in the United States & Silicon Valley',
        europe: 'across Europe and European tech hubs',
        asia: 'across Asia-Pacific and global Asian tech hubs',
        custom: `in ${briefCustomLocation.trim() || 'the specified region'}`
      };

      const focusDescriptions = {
        'frontier-ai': 'cutting-edge frontier AI breakthroughs, foundation models (OpenAI, Anthropic, Google DeepMind, Meta), reasoning architectures, open-weights releases, and autonomous agents',
        tech: 'global tech developments, semiconductor advancements (Nvidia, TSMC), quantum computing, robotics, and major innovation announcements',
        markets: 'tech equities, NASDAQ AI movements, venture capital funding rounds, semiconductor earnings, and crypto macro trends',
        world: 'verified international headlines, global diplomacy, world economy, and major scientific announcements',
        local: `local community news, civic updates, and developments in ${briefCustomLocation.trim() || defaultCity || 'your city'}`
      };

      const formatDescriptions = {
        executive: 'an executive briefing with 3 verified stories, concise factual summaries, analytical "why it matters" takeaways, and direct source links',
        rapid: 'a rapid intelligence radar with 5 distinct developments and bulleted verified links',
        'deep-dive': 'a deep-dive spotlight on today\'s single biggest breakthrough with comprehensive analysis and background context'
      };

      const tagTerms = {
        models: 'frontier foundation models & benchmarks',
        agents: 'autonomous AI agents & tool use',
        'open-weights': 'open source weights & Hugging Face community',
        chips: 'GPUs, semiconductors & AI data center infrastructure',
        policy: 'AI safety, governance & regulatory developments',
        startups: 'AI venture funding & startup launches'
      };

      const selectedTagStr = briefSelectedTags.length > 0
        ? ` Priority topics: ${briefSelectedTags.map(t => tagTerms[t] || t).join(', ')}.`
        : '';

      const weatherStr = includeWeather
        ? ` Also include a brief weather snapshot for ${briefCustomLocation.trim() || defaultCity || 'local area'} using get_live_weather.`
        : '';

      prompt = `Compile a concise, high-signal Daily Intelligence Brief on ${focusDescriptions[briefFocus] || focusDescriptions['frontier-ai']} ${scopeLabels[briefScope] || scopeLabels.worldwide} published in the last 24 to 48 hours. Format as ${formatDescriptions[briefFormat] || formatDescriptions.executive}.${selectedTagStr}${weatherStr} Use live web search to verify distinct stories with direct original article URLs (not homepages or search results). Invoke create_daily_brief to render the interactive briefing card.`;
    } else if (action === 'open-web-page') {
      const target = webUrl.trim();
      if (!target) return;
      const normalized = normalizeWebUrl(target);
      if (normalized) {
        handleAnimatedClose(() => {
          if (onOpenWebPage) {
            onOpenWebPage(normalized);
          } else {
            onExecute(`Open and browse this webpage, summarize its main contents and extract key takeaways: ${normalized}`);
          }
        });
        return;
      }
    }

    if (prompt) {
      handleAnimatedClose(() => {
        onExecute(prompt);
      });
    }
  };

  return (
    <div ref={backdropRef} className="agent-action-modal-backdrop" onClick={() => handleAnimatedClose()}>
      <section
        ref={cardRef}
        className="agent-action-modal-card glass-panel"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="agent-action-modal-inner animate-content-morph">
          {/* Header */}
          <header className="agent-action-modal-header">
            <div className="agent-action-modal-title-group">
              <span className="agent-action-badge">
                {action === 'code-analysis' && '</> Code Analysis'}
                {action === 'day-schedule' && '📅 Day Schedule Planner'}
                {action === 'budget-planner' && '💰 Budget & Expense Planner'}
                {action === 'seo-analysis' && '⌕ SEO Web Inspector'}
                {action === 'daily-brief' && '☀ Worldwide AI & Daily Intelligence Brief'}
                {action === 'open-web-page' && '🌐 Web Browser & Inspector'}
              </span>
              <p className="agent-action-modal-sub">
                {action === 'code-analysis' && 'Paste code or provide a snippet for deep agent inspection.'}
                {action === 'day-schedule' && 'Configure hours and priorities to build an interactive timeline.'}
                {action === 'budget-planner' && 'Set budget limits and purpose for automated allocation.'}
                {action === 'seo-analysis' && 'Inspect metadata, content signals, and rankings.'}
                {action === 'daily-brief' && 'Synthesize real-time frontier AI breakthroughs, worldwide tech trends, or global markets with verified sources.'}
                {action === 'open-web-page' && 'Open a website inside Lumen or let the agent browse and extract findings.'}
              </p>
            </div>
            <button
              type="button"
              className="agent-action-modal-close"
              onClick={() => handleAnimatedClose()}
              aria-label="Close modal"
            >
              ✕
            </button>
          </header>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="agent-action-modal-form">
          {/* 1. Code Analysis */}
          {action === 'code-analysis' && (
            <div className="agent-action-fields">
              <div className="agent-action-row">
                <label className="agent-action-label">
                  Language:
                  <select
                    className="agent-action-select"
                    value={codeLang}
                    onChange={(e) => setCodeLang(e.target.value)}
                  >
                    <option value="javascript">JavaScript / TypeScript</option>
                    <option value="python">Python</option>
                    <option value="react">React / JSX</option>
                    <option value="rust">Rust</option>
                    <option value="go">Go</option>
                    <option value="sql">SQL</option>
                    <option value="html/css">HTML / CSS</option>
                  </select>
                </label>
              </div>

              <div className="agent-action-focus-chips">
                <span className="agent-action-label">Analysis Focus:</span>
                <div className="agent-chips-wrap">
                  {[
                    { id: 'bugs', label: '🐞 Bugs & Security' },
                    { id: 'perf', label: '⚡ Performance' },
                    { id: 'refactor', label: '🧹 Clean Refactor' },
                    { id: 'explain', label: '📖 Architecture & Explanation' }
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      className={`agent-preset-chip ${codeFocus === chip.id ? 'active' : ''}`}
                      onClick={() => setCodeFocus(chip.id)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="agent-action-label-row">
                <span className="agent-action-label">Code Snippet or Git URL:</span>
                <div className="agent-action-mini-tools">
                  <button
                    type="button"
                    className="agent-action-tool-btn"
                    onClick={() => handlePasteClipboard(setCodeSnippet)}
                    title="Paste from clipboard"
                  >
                    📋 Paste
                  </button>
                  <button
                    type="button"
                    className="agent-action-tool-btn"
                    onClick={insertSampleCode}
                    title="Load sample snippet to test"
                  >
                    ✨ Sample
                  </button>
                </div>
              </div>
              <textarea
                className="agent-action-code-textarea"
                rows={8}
                placeholder="Paste your function, component, or code snippet here..."
                value={codeSnippet}
                onChange={(e) => setCodeSnippet(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {/* 2. Day Schedule */}
          {action === 'day-schedule' && (
            <div className="agent-action-fields">
              <div className="agent-action-row-split">
                <label className="agent-action-label">
                  Start Time:
                  <input
                    type="time"
                    className="agent-action-input"
                    value={scheduleStart}
                    onChange={(e) => setScheduleStart(e.target.value)}
                  />
                </label>
                <label className="agent-action-label">
                  End Time:
                  <input
                    type="time"
                    className="agent-action-input"
                    value={scheduleEnd}
                    onChange={(e) => setScheduleEnd(e.target.value)}
                  />
                </label>
              </div>

              <div className="agent-action-focus-chips">
                <span className="agent-action-label">Day Mode:</span>
                <div className="agent-chips-wrap">
                  {[
                    { id: 'work', label: '💼 Focused Workday' },
                    { id: 'study', label: '📚 Study & Learning' },
                    { id: 'travel', label: '✈️ Travel & Sightseeing' },
                    { id: 'weekend', label: '🌿 Relaxed Weekend' }
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      className={`agent-preset-chip ${scheduleType === chip.id ? 'active' : ''}`}
                      onClick={() => setScheduleType(chip.id)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="agent-action-label">
                Key Events & Priorities (optional):
                <textarea
                  className="agent-action-textarea"
                  rows={3}
                  placeholder="e.g. 10:00 Team standup, Deep work sprint on API, Gym at 17:00..."
                  value={schedulePriorities}
                  onChange={(e) => setSchedulePriorities(e.target.value)}
                  autoFocus
                />
              </label>
            </div>
          )}

          {/* 3. Budget Planner */}
          {action === 'budget-planner' && (
            <div className="agent-action-fields">
              <div className="agent-action-row-split">
                <label className="agent-action-label">
                  Currency:
                  <select
                    className="agent-action-select"
                    value={budgetCurrency}
                    onChange={(e) => setBudgetCurrency(e.target.value)}
                  >
                    <option value="$">USD ($)</option>
                    <option value="€">EUR (€)</option>
                    <option value="£">GBP (£)</option>
                    <option value="¥">JPY (¥)</option>
                    <option value="CHF">CHF</option>
                  </select>
                </label>
                <label className="agent-action-label">
                  Total Budget:
                  <input
                    type="number"
                    className="agent-action-input"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    placeholder="3000"
                    autoFocus
                  />
                </label>
              </div>

              <div className="agent-action-focus-chips">
                <span className="agent-action-label">Allocation Purpose:</span>
                <div className="agent-chips-wrap">
                  {[
                    { id: 'monthly', label: '🏠 Monthly Living (50/30/20)' },
                    { id: 'travel', label: '✈️ Trip / Vacation' },
                    { id: 'project', label: '💻 Hardware / Home Office' },
                    { id: 'event', label: '🎉 Event / Project' }
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      className={`agent-preset-chip ${budgetPurpose === chip.id ? 'active' : ''}`}
                      onClick={() => setBudgetPurpose(chip.id)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="agent-action-label">
                Specific Items or Constraints (optional):
                <textarea
                  className="agent-action-textarea"
                  rows={2}
                  placeholder="e.g. 5 days in Tokyo, staying in Shibuya, including dining and shopping..."
                  value={budgetNotes}
                  onChange={(e) => setBudgetNotes(e.target.value)}
                />
              </label>
            </div>
          )}

          {/* 4. SEO Analysis */}
          {action === 'seo-analysis' && (
            <div className="agent-action-fields">
              <div className="agent-action-label-row">
                <span className="agent-action-label">Webpage URL:</span>
                <button
                  type="button"
                  className="agent-action-tool-btn"
                  onClick={() => handlePasteClipboard(setSeoUrl)}
                  title="Paste URL from clipboard"
                >
                  📋 Paste
                </button>
              </div>
              <input
                type="url"
                className="agent-action-input"
                placeholder="https://example.com"
                value={seoUrl}
                onChange={(e) => setSeoUrl(e.target.value)}
                autoFocus
                required
              />
              <label className="agent-action-label">
                Target Keywords (optional):
                <input
                  type="text"
                  className="agent-action-input"
                  placeholder="e.g. ai agent, productivity tool, saas"
                  value={seoKeywords}
                  onChange={(e) => setSeoKeywords(e.target.value)}
                />
              </label>
            </div>
          )}

          {/* 5. Daily Brief */}
          {action === 'daily-brief' && (
            <div className="agent-action-fields daily-brief-modal-fields">
              {/* Focus Area Selection */}
              <div className="agent-action-group">
                <span className="agent-action-label">Intelligence Focus:</span>
                <div className="daily-brief-focus-grid">
                  {[
                    {
                      id: 'frontier-ai',
                      icon: '🤖',
                      title: 'Worldwide AI & Frontier Models',
                      desc: 'OpenAI, Anthropic, Google DeepMind, Meta, SOTA reasoning architectures, open-weights, and autonomous agents.'
                    },
                    {
                      id: 'tech',
                      icon: '⚡',
                      title: 'Global Tech & Deep Tech',
                      desc: 'Semiconductors (Nvidia, TSMC), quantum computing, robotics, space exploration, and hardware breakthroughs.'
                    },
                    {
                      id: 'markets',
                      icon: '📈',
                      title: 'Tech Markets & Venture Capital',
                      desc: 'Wall Street NASDAQ AI rally, startup mega-rounds, semiconductor earnings, and crypto macro trends.'
                    },
                    {
                      id: 'world',
                      icon: '🌍',
                      title: 'International World News',
                      desc: 'Top verified international headlines, diplomacy, global economic policy, and international science.'
                    },
                    {
                      id: 'local',
                      icon: '🏙️',
                      title: 'Local City Pulse & Community',
                      desc: 'Headlines, civic updates, and local community developments tailored to your chosen metropolitan area.'
                    }
                  ].map((focus) => (
                    <div
                      key={focus.id}
                      className={`daily-brief-focus-card ${briefFocus === focus.id ? 'active' : ''}`}
                      onClick={() => setBriefFocus(focus.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setBriefFocus(focus.id); }}
                    >
                      <div className="focus-card-header">
                        <span className="focus-card-icon">{focus.icon}</span>
                        <strong className="focus-card-title">{focus.title}</strong>
                        {briefFocus === focus.id && <span className="focus-card-check">✓</span>}
                      </div>
                      <p className="focus-card-desc">{focus.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Geographic Scope Selector */}
              <div className="agent-action-group">
                <span className="agent-action-label">Geographic Scope:</span>
                <div className="agent-chips-wrap">
                  {[
                    { id: 'worldwide', label: '🌐 Worldwide (Global)' },
                    { id: 'us', label: '🇺🇸 US & Silicon Valley' },
                    { id: 'europe', label: '🇪🇺 Europe' },
                    { id: 'asia', label: '🌏 Asia-Pacific' },
                    { id: 'custom', label: '📍 Custom Region' }
                  ].map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      className={`agent-preset-chip ${briefScope === sc.id ? 'active' : ''}`}
                      onClick={() => setBriefScope(sc.id)}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>

                {(briefScope === 'custom' || briefFocus === 'local') && (
                  <div className="daily-brief-custom-loc-row animate-fade-in">
                    <label className="agent-action-label">
                      Target City / Metropolitan Region:
                      <input
                        type="text"
                        className="agent-action-input"
                        placeholder="e.g. San Francisco, Tokyo, London, Berlin, Singapore..."
                        value={briefCustomLocation}
                        onChange={(e) => setBriefCustomLocation(e.target.value)}
                        autoFocus
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Curated AI Priority Tags (if AI / Tech chosen) */}
              {(briefFocus === 'frontier-ai' || briefFocus === 'tech') && (
                <div className="agent-action-group">
                  <span className="agent-action-label">Priority Topic Filters (Multi-Select):</span>
                  <div className="agent-chips-wrap">
                    {[
                      { id: 'models', label: '⚡ Frontier SOTA Models' },
                      { id: 'agents', label: '🤖 Autonomous AI Agents' },
                      { id: 'open-weights', label: '🔓 Open Source & Weights' },
                      { id: 'chips', label: '💻 GPUs & Infrastructure' },
                      { id: 'policy', label: '⚖️ AI Safety & Policy' },
                      { id: 'startups', label: '🚀 Startups & Investments' }
                    ].map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        className={`agent-preset-chip ${briefSelectedTags.includes(tag.id) ? 'active' : ''}`}
                        onClick={() => toggleBriefTag(tag.id)}
                      >
                        {briefSelectedTags.includes(tag.id) ? '✓ ' : '+ '}
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Briefing Depth & Format */}
              <div className="agent-action-group">
                <span className="agent-action-label">Briefing Depth & Format:</span>
                <div className="daily-brief-format-row">
                  {[
                    { id: 'executive', icon: '🌅', label: 'Executive Briefing', sub: '3 curated stories + impact analysis' },
                    { id: 'rapid', icon: '⚡', label: 'Rapid Radar', sub: '5 quick bullet bites + links' },
                    { id: 'deep-dive', icon: '🔬', label: 'Deep Dive Spotlight', sub: 'In-depth breakdown of #1 story' }
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      className={`daily-brief-format-btn ${briefFormat === fmt.id ? 'active' : ''}`}
                      onClick={() => setBriefFormat(fmt.id)}
                    >
                      <span className="format-btn-icon">{fmt.icon}</span>
                      <span className="format-btn-label">{fmt.label}</span>
                      <span className="format-btn-sub">{fmt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Local Weather Snapshot */}
              <div className="daily-brief-options-row">
                <label className="daily-brief-checkbox-label">
                  <input
                    type="checkbox"
                    className="daily-brief-checkbox"
                    checked={includeWeather}
                    onChange={(e) => setIncludeWeather(e.target.checked)}
                  />
                  <span>🌤️ Include local weather snapshot for {briefCustomLocation || defaultCity || 'local area'}</span>
                </label>
              </div>

              {/* Live Intelligence Briefing Plan Preview */}
              <div className="daily-brief-live-preview">
                <div className="live-preview-header">
                  <span className="live-preview-dot"></span>
                  <span className="live-preview-title">📡 Live Agent Strategy:</span>
                </div>
                <div className="live-preview-details">
                  <span>Scope: <strong>{briefScope === 'worldwide' ? 'Worldwide (Global)' : briefScope.toUpperCase()}</strong></span>
                  <span> · Target: <strong>{briefFocus === 'frontier-ai' ? 'Frontier AI & Models' : briefFocus}</strong></span>
                  <span> · Source: <strong>Live Web Search & Verified Outlets (Last 24-48h)</strong></span>
                  <span> · Output: <strong>Interactive Intelligence Brief Card</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* 6. Open Web Page */}
          {action === 'open-web-page' && (
            <div className="agent-action-fields">
              <div className="agent-action-label-row">
                <span className="agent-action-label">Web Address or URL:</span>
                <button
                  type="button"
                  className="agent-action-tool-btn"
                  onClick={() => handlePasteClipboard(setWebUrl)}
                  title="Paste URL from clipboard"
                >
                  📋 Paste
                </button>
              </div>
              <input
                type="text"
                className="agent-action-input"
                placeholder="e.g. news.ycombinator.com or https://github.com"
                value={webUrl}
                onChange={(e) => setWebUrl(e.target.value)}
                autoFocus
                required
              />

              <div className="agent-action-focus-chips">
                <span className="agent-action-label">Popular Presets:</span>
                <div className="agent-chips-wrap">
                  {[
                    { url: 'https://news.ycombinator.com', label: '🟧 Hacker News' },
                    { url: 'https://en.wikipedia.org', label: '📖 Wikipedia' },
                    { url: 'https://github.com/trending', label: '🐙 GitHub' },
                    { url: 'https://developer.mozilla.org', label: '🦊 MDN Docs' }
                  ].map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      className="agent-preset-chip"
                      onClick={() => setWebUrl(preset.url)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer Submit */}
          <footer className="agent-action-modal-footer">
            <button
              type="button"
              className="agent-action-btn-cancel"
              onClick={() => handleAnimatedClose()}
            >
              Cancel
            </button>
            {action === 'open-web-page' && (
              <button
                type="button"
                className="agent-action-btn-secondary"
                onClick={() => {
                  const normalized = normalizeWebUrl(webUrl);
                  if (normalized) {
                    handleAnimatedClose(() => {
                      onExecute(`Open and browse this webpage, summarize its main contents, extract key takeaways, and verify source data: ${normalized}`);
                    });
                  }
                }}
              >
                Agent Browse 🤖
              </button>
            )}
            <button
              type="submit"
              className="agent-action-btn-submit"
            >
              {action === 'code-analysis' && 'Analyze Code 🚀'}
              {action === 'day-schedule' && 'Generate Schedule 🚀'}
              {action === 'budget-planner' && 'Build Budget Plan 🚀'}
              {action === 'seo-analysis' && 'Inspect Webpage 🚀'}
              {action === 'daily-brief' && (briefFocus === 'frontier-ai' ? 'Synthesize Worldwide AI Brief 🚀' : 'Compile Intelligence Brief 🚀')}
              {action === 'open-web-page' && 'Open in Lumen Tab 🌐'}
            </button>
          </footer>
        </form>
        </div>
      </section>
    </div>
  );
}

