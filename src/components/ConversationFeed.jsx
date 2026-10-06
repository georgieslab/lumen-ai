import React, { useRef, useEffect, useState } from 'react';
import { fetchLiveWeatherDirect } from '../services/api';
import { getTranslations } from '../utils/translations';

function parseFormattedText(text) {
  if (!text) return [];
  // Tokenize markdown links [text](url) OR standalone URLs (https?://...)
  const tokenRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\))|(https?:\/\/[^\s<>()]+)/gi;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      // Markdown link: [Title](url)
      parts.push({ type: 'link', title: match[2], url: match[3] });
    } else if (match[4]) {
      // Raw URL
      const cleanUrl = match[4].replace(/[.,;:)]$/, '');
      let label = cleanUrl;
      try {
        label = new URL(cleanUrl).hostname.replace(/^www\./, '');
      } catch (_) {}
      parts.push({ type: 'link', title: label, url: cleanUrl });
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts;
}

function getFollowUpKeys(message, previousUserMessage) {
  if (!previousUserMessage || message.isError) return [];

  const widgetTypes = new Set(
    (Array.isArray(message.widgets) ? message.widgets : [])
      .map((widget) => widget.widgetType)
  );

  if (widgetTypes.has('weather')) return ['weatherAdvice', 'otherCity', 'nextStep'];
  if (widgetTypes.has('jobs')) return ['mockInterview', 'skills', 'nextStep'];
  if (message.webSources?.length || message.webType === 'research_report') {
    return widgetTypes.has('pdf_document')
      ? ['compare', 'deeper', 'nextStep']
      : ['compare', 'createPdf', 'deeper'];
  }
  if (widgetTypes.has('pdf_document')) return ['summary', 'deeper', 'nextStep'];

  const hasAttachment = Boolean(
    previousUserMessage.isPdf ||
    previousUserMessage.fileName ||
    previousUserMessage.image
  );
  if (hasAttachment) {
    const isPdf = previousUserMessage.isPdf ||
      previousUserMessage.fileName?.toLowerCase().endsWith('.pdf');
    return isPdf
      ? ['fileSummary', 'deeper', 'createPdf']
      : ['fileDetail', 'deeper', 'nextStep'];
  }

  return ['example', 'simplify', 'nextStep'];
}

export function LiveWeatherCard({ data, onCityChange, initialSearching = false, activeLanguage = 'en-US' }) {
  const t = getTranslations(activeLanguage).weatherCard;
  const [weatherData, setWeatherData] = useState(data);
  const [isSearching, setIsSearching] = useState(initialSearching);
  const [cityInput, setCityInput] = useState('');
  const [isLoadingCity, setIsLoadingCity] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (data) {
      setWeatherData(data);
      if (data.initialSearching || initialSearching) {
        setIsSearching(true);
      }
    }
  }, [data, initialSearching]);

  const handleCitySearch = async (targetCity) => {
    const query = (targetCity || cityInput).trim();
    if (!query) return;
    setIsLoadingCity(true);
    setSearchError('');
    try {
      const res = await fetchLiveWeatherDirect(query);
      if (res && res.success) {
        setWeatherData(res);
        setCityInput('');
        setIsSearching(false);
        if (onCityChange) onCityChange(res);
      } else {
        setSearchError(res?.error || `Could not locate weather for "${query}"`);
      }
    } catch (err) {
      setSearchError("Failed to fetch weather data. Please try again.");
    } finally {
      setIsLoadingCity(false);
    }
  };

  if (!weatherData) return null;

  return (
    <div className="live-widget-card weather-widget animate-fade-in">
      <div className="widget-header">
        <div className="widget-badge weather-badge">
          <span className="live-pulse"></span>
          <span>{t.badge}</span>
        </div>
        <div className="widget-header-controls">
          <span className="widget-location">{weatherData.city}</span>
          <button
            type="button"
            className="btn-change-city"
            onClick={() => setIsSearching(!isSearching)}
            title={isSearching ? t.close : t.changeCity}
          >
            {isSearching ? t.close : t.changeCity}
          </button>
        </div>
      </div>

      {/* Expandable City Search Bar */}
      {isSearching && (
        <div className="weather-city-search-panel animate-fade-in">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleCitySearch();
            }}
            className="weather-city-search-form"
          >
            <input
              type="text"
              className="weather-city-input"
              placeholder={t.searchPlaceholder}
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="weather-city-submit-btn"
              disabled={!cityInput.trim() || isLoadingCity}
            >
              {isLoadingCity ? t.searchingBtn : t.searchBtn}
            </button>
          </form>

          {/* Quick city pills */}
          <div className="weather-quick-cities">
            {['Vienna', 'Paris', 'Tokyo', 'London', 'New York', 'Berlin', 'Rome', 'Sydney'].map((city) => (
              <button
                key={city}
                type="button"
                className="quick-city-chip"
                onClick={() => handleCitySearch(city)}
                disabled={isLoadingCity}
              >
                📍 {city}
              </button>
            ))}
          </div>

          {searchError && (
            <div className="weather-search-error">
              {searchError}
            </div>
          )}
        </div>
      )}

      <div className="weather-main-row">
        <div className="weather-temp-wrap">
          <span className="weather-icon">{weatherData.icon}</span>
          <span className="weather-temp">{weatherData.temp}°</span>
          <span className="weather-unit">C</span>
        </div>
        <div className="weather-details">
          <span className="weather-condition">{weatherData.condition}</span>
          <span className="weather-hilo">H: {weatherData.high}° • L: {weatherData.low}°</span>
        </div>
      </div>

      <div className="weather-metrics">
        <div className="metric-pill">
          <span className="metric-glyph">💧</span>
          <span className="metric-label">Humidity</span>
          <span className="metric-value">{weatherData.humidity}%</span>
        </div>
        <div className="metric-pill">
          <span className="metric-glyph">💨</span>
          <span className="metric-label">Wind</span>
          <span className="metric-value">{weatherData.wind} km/h</span>
        </div>
        {weatherData.feelsLike !== undefined && (
          <div className="metric-pill">
            <span className="metric-glyph">🌡️</span>
            <span className="metric-label">Feels</span>
            <span className="metric-value">{weatherData.feelsLike}°C</span>
          </div>
        )}
      </div>

      {Array.isArray(weatherData.forecast) && weatherData.forecast.length > 0 && (
        <div className="weather-forecast-row">
          {weatherData.forecast.map((f, idx) => (
            <div key={idx} className="forecast-item">
              <span className="forecast-day">{f.day === 'Tomorrow' ? t.tomorrow : f.day === 'Today' ? t.today : f.day}</span>
              <span className="forecast-icon">{f.icon}</span>
              <span className="forecast-temps">{f.max}°/{f.min}°</span>
            </div>
          ))}
        </div>
      )}

      {/* Atmospheric Comfort & Flow Insights */}
      <div className="weather-analytics-row">
        <span className="analytics-chip">
          <span className="analytics-dot cyan"></span>
          {t.humidityLabel || 'Comfort'}: <strong>{weatherData.humidity < 35 ? t.comfortDry : weatherData.humidity > 70 ? t.comfortHumid : t.comfortOptimal}</strong>
        </span>
        <span className="analytics-chip">
          {t.airflowLabel || 'Airflow'}: <strong>{weatherData.wind < 12 ? t.breezeGentle : weatherData.wind < 28 ? t.breezeModerate : t.breezeBrisk}</strong>
        </span>
      </div>
    </div>
  );
}

function CryptoSparkline({ isPositive, low, high, current }) {
  const currentNum = Number(current) || 100;
  const minVal = Number(low) || (currentNum * 0.96);
  const maxVal = Number(high) || (currentNum * 1.04);
  const spread = Math.max(0.1, maxVal - minVal);

  const sign = isPositive ? 1 : -1;
  const p0 = isPositive ? minVal + spread * 0.15 : maxVal - spread * 0.15;
  const p1 = p0 + (spread * 0.22 * sign);
  const p2 = p1 - (spread * 0.12 * sign);
  const p3 = p2 + (spread * 0.35 * sign);
  const p4 = p3 - (spread * 0.08 * sign);
  const p5 = p4 + (spread * 0.28 * sign);
  const p6 = p5 - (spread * 0.05 * sign);
  const p7 = currentNum;

  const points = [p0, p1, p2, p3, p4, p5, p6, p7];
  const width = 240;
  const height = 44;
  const paddingY = 6;

  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const clampedVal = Math.min(maxVal, Math.max(minVal, val));
    const norm = (clampedVal - minVal) / spread;
    const y = height - paddingY - (norm * (height - (paddingY * 2)));
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  const pathD = coords.reduce((acc, curr, idx) => {
    if (idx === 0) return `M ${curr.x} ${curr.y}`;
    const prev = coords[idx - 1];
    const cx = ((prev.x + curr.x) / 2).toFixed(1);
    return `${acc} C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
  }, '');

  const strokeColor = isPositive ? '#10b981' : '#f43f5e';
  const gradId = `spark-grad-${isPositive ? 'pos' : 'neg'}`;

  return (
    <div className="crypto-sparkline-box" title="24h Intraday Trend Curve">
      <div className="sparkline-header">
        <span className="sparkline-label">24H TREND MOMENTUM</span>
        <span className={`sparkline-volatility ${isPositive ? 'positive' : 'negative'}`}>
          {isPositive ? 'Accumulation ↗' : 'Retracement ↘'}
        </span>
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="sparkline-svg">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.32" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={`${pathD} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${gradId})`} />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="3" fill={strokeColor} className="sparkline-pulse-dot" />
      </svg>
    </div>
  );
}

export function LiveCryptoCard({ data }) {
  if (!data) return null;
  const isPositive = data.isPositive ?? ((data.change24h || 0) >= 0);
  const formattedPrice = typeof data.price === 'number'
    ? data.price.toLocaleString(undefined, { minimumFractionDigits: data.price < 1 ? 4 : 2, maximumFractionDigits: data.price < 1 ? 4 : 2 })
    : data.price;

  let rangePercent = 50;
  if (data.high24h && data.low24h && data.high24h > data.low24h && data.price) {
    rangePercent = Math.min(100, Math.max(0, Math.round(((data.price - data.low24h) / (data.high24h - data.low24h)) * 100)));
  }

  return (
    <div className="live-widget-card crypto-widget animate-fade-in">
      <div className="widget-header">
        <div className="widget-badge crypto-badge">
          <span className="live-pulse"></span>
          <span>LIVE MARKET</span>
        </div>
        <div className="crypto-asset-tag">
          {data.image && <img src={data.image} alt={data.name} className="crypto-mini-icon" />}
          <span className="crypto-name">{data.name}</span>
          <span className="crypto-symbol">{data.symbol}</span>
        </div>
      </div>

      <div className="crypto-main-row">
        <div className="crypto-price-wrap">
          <span className="currency-symbol">$</span>
          <span className="crypto-price">{formattedPrice}</span>
          <span className="crypto-currency">{data.currency || 'USD'}</span>
        </div>

        <div className={`crypto-change-pill ${isPositive ? 'positive' : 'negative'}`}>
          <span>{isPositive ? '▲ +' : '▼ '}{Math.abs(data.change24h || 0).toFixed(2)}%</span>
        </div>
      </div>

      {data.high24h !== undefined && data.low24h !== undefined && (
        <div className="crypto-range-container">
          <div className="range-labels">
            <span>L: ${Number(data.low24h).toLocaleString()}</span>
            <span>H: ${Number(data.high24h).toLocaleString()}</span>
          </div>
          <div className="range-bar-track">
            <div className="range-bar-fill" style={{ width: `${rangePercent}%` }}></div>
            <div className="range-bar-dot" style={{ left: `${rangePercent}%` }}></div>
          </div>
        </div>
      )}

      {/* 24h Trend Waveform Visualization */}
      <CryptoSparkline
        isPositive={isPositive}
        low={data.low24h}
        high={data.high24h}
        current={data.price}
      />

      {/* Analytics Insights Bar */}
      <div className="crypto-analytics-row">
        <span className="analytics-chip">
          <span className={`analytics-dot ${isPositive ? 'green' : 'rose'}`}></span>
          Momentum: <strong>{isPositive ? 'Bullish Breakout' : 'Consolidation / Pullback'}</strong>
        </span>
        {data.high24h && data.low24h && (
          <span className="analytics-chip">
            Range Spread: <strong>{(((data.high24h - data.low24h) / data.low24h) * 100).toFixed(1)}%</strong>
          </span>
        )}
      </div>
    </div>
  );
}

export function LivePdfCard({ data, activeLanguage = 'en-US' }) {
  if (!data) return null;
  const t = getTranslations(activeLanguage).pdfCard;
  const sizeKb = data.sizeBytes ? (data.sizeBytes / 1024).toFixed(1) : null;

  const handleDownload = () => {
    try {
      const url = data.dataUrl || `data:application/pdf;base64,${data.base64}`;
      const link = document.createElement('a');
      link.href = url;
      link.download = data.fileName || 'Lumen_Document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn("Download failed:", err);
    }
  };

  const handleView = () => {
    try {
      const url = data.dataUrl || `data:application/pdf;base64,${data.base64}`;
      const win = window.open();
      if (win) {
        win.document.write(`<iframe src="${url}" frameborder="0" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%;" allowfullscreen></iframe>`);
      }
    } catch (err) {
      console.warn("Preview failed:", err);
    }
  };

  return (
    <div className="live-widget-card pdf-widget animate-fade-in">
      <div className="widget-header">
        <div className="widget-badge pdf-badge">
          <span className="live-pulse rose"></span>
          <span>{t.badge}</span>
        </div>
        <span className="pdf-page-count">{data.pageCount || 1} {data.pageCount === 1 ? t.page : t.pages}</span>
      </div>

      <div className="pdf-main-row">
        <div className="pdf-icon-wrap">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pdf-glyph">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          <span className="pdf-mini-tag">PDF</span>
        </div>

        <div className="pdf-details">
          <h4 className="pdf-title">{data.title || t.defaultTitle}</h4>
          <span className="pdf-filename">{data.fileName}</span>
          {sizeKb && <span className="pdf-meta">{sizeKb} KB • {t.generatedBy}</span>}
        </div>
      </div>

      {data.summary && (
        <div className="pdf-summary-box">
          <p className="pdf-summary-text">{data.summary}</p>
        </div>
      )}

      <div className="pdf-actions-row">
        <button
          type="button"
          className="btn-pdf-download"
          onClick={handleDownload}
          title={t.downloadPdf}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>{t.downloadPdf}</span>
        </button>

        <button
          type="button"
          className="btn-pdf-view"
          onClick={handleView}
          title={t.preview}
        >
          <span>{t.preview}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
      </div>
    </div>
  );
}

export function LiveJobsRadarCard({
  data,
  onFilterChange,
  onSearchJobs,
  onMockInterview,
  onGenerateDossier,
  activeLanguage = 'en-US'
}) {
  const t = getTranslations(activeLanguage).jobsCard;
  const [role, setRole] = useState(data?.role || 'Frontend Developer');
  const [location, setLocation] = useState(data?.location || 'Vienna & Remote');
  const [isEditing, setIsEditing] = useState(Boolean(data?.initialEditing));
  const [customRole, setCustomRole] = useState('');
  const [customLocation, setCustomLocation] = useState('');

  useEffect(() => {
    if (data?.role) setRole(data.role);
    if (data?.location) setLocation(data.location);
  }, [data]);

  const quickRoles = [
    { label: '⚛️ Frontend', val: 'Frontend Developer' },
    { label: '⚡ AI / LLM', val: 'AI & LLM Engineer' },
    { label: '🚀 Fullstack', val: 'Fullstack Developer' },
    { label: '🐍 Python', val: 'Python & Backend Engineer' },
    { label: '🎨 UI / UX', val: 'UI/UX & Design Engineer' },
    { label: '📱 Mobile', val: 'Mobile Developer (React Native)' }
  ];

  const quickLocations = [
    { label: '🇦🇹 Vienna', val: 'Vienna, Austria' },
    { label: '🌐 Remote', val: 'Remote / Anywhere' },
    { label: '🇦🇹 Vienna & Remote', val: 'Vienna & Remote' },
    { label: '🇩🇪 Berlin', val: 'Berlin, Germany' },
    { label: '🇨🇭 Zurich', val: 'Zurich, Switzerland' },
    { label: '🇬🇧 London', val: 'London, UK' },
    { label: '🇩🇪 Munich', val: 'Munich, Germany' }
  ];

  const handleApply = (newRole, newLoc) => {
    const finalRole = newRole || role;
    const finalLoc = newLoc || location;
    setRole(finalRole);
    setLocation(finalLoc);
    if (onFilterChange) {
      onFilterChange({ role: finalRole, location: finalLoc });
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    const finalRole = customRole.trim() || role;
    const finalLoc = customLocation.trim() || location;
    handleApply(finalRole, finalLoc);
    setCustomRole('');
    setCustomLocation('');
    setIsEditing(false);
  };

  return (
    <div className="live-widget-card jobs-widget animate-fade-in">
      <div className="widget-header">
        <div className="widget-badge jobs-badge">
          <span className="live-pulse green"></span>
          <span>{t.badge}</span>
        </div>
        <button
          type="button"
          className="jobs-change-toggle-btn"
          onClick={() => setIsEditing(!isEditing)}
          title={isEditing ? t.done : t.changeTile}
        >
          {isEditing ? t.done : t.changeTile}
        </button>
      </div>

      {/* Main Focus Row */}
      <div className="jobs-main-row">
        <div className="jobs-icon-wrap">
          <span className="jobs-big-icon">💼</span>
        </div>
        <div className="jobs-target-info">
          <div className="jobs-role-title">{role}</div>
          <div className="jobs-location-sub">
            <span className="location-pin">📍</span> {location}
          </div>
        </div>
        <div className="jobs-status-pill">
          <span className="status-live-dot"></span>
          <span>{t.activeTile}</span>
        </div>
      </div>

      {/* Configuration Drawer (if editing is open) */}
      {isEditing && (
        <div className="jobs-config-box animate-fade-in">
          <div className="config-section-title">{t.targetRole}</div>
          <div className="config-pills-row">
            {quickRoles.map(r => (
              <button
                key={r.val}
                type="button"
                className={`config-pill ${role === r.val ? 'active' : ''}`}
                onClick={() => handleApply(r.val, location)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="config-section-title" style={{ marginTop: '0.65rem' }}>{t.targetLocation}</div>
          <div className="config-pills-row">
            {quickLocations.map(l => (
              <button
                key={l.val}
                type="button"
                className={`config-pill ${location === l.val ? 'active' : ''}`}
                onClick={() => handleApply(role, l.val)}
              >
                {l.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleCustomSubmit} className="custom-job-form">
            <input
              type="text"
              placeholder={t.customRolePlaceholder}
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              className="custom-job-input"
            />
            <input
              type="text"
              placeholder={t.customLocPlaceholder}
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              className="custom-job-input"
            />
            <button type="submit" className="custom-job-submit-btn">
              {t.applyBtn}
            </button>
          </form>
        </div>
      )}

      {/* Fast Action Buttons */}
      <div className="jobs-actions-row">
        <button
          type="button"
          className="btn-jobs-search"
          onClick={() => onSearchJobs && onSearchJobs(role, location)}
          title={`Search active ${role} jobs in ${location}`}
        >
          <span>🔍</span>
          <span>{t.findJobsBtn}</span>
        </button>

        <button
          type="button"
          className="btn-jobs-interview"
          onClick={() => onMockInterview && onMockInterview(role)}
          title={`Practice a mock interview for ${role}`}
        >
          <span>🎙️</span>
          <span>{t.mockInterviewBtn}</span>
        </button>

        <button
          type="button"
          className="btn-jobs-dossier"
          onClick={() => onGenerateDossier && onGenerateDossier(role, location)}
          title={`Generate career dossier PDF for ${role} in ${location}`}
        >
          <span>📄</span>
          <span>{t.exportDossierBtn}</span>
        </button>
      </div>
    </div>
  );
}

function FormattedBubbleText({ text }) {
  if (!text) return null;
  const parts = parseFormattedText(text);

  return (
    <div className="bubble-text">
      {parts.map((part, i) => {
        if (part.type === 'link') {
          return (
            <a
              key={i}
              href={part.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bubble-inline-link"
              title={part.url}
            >
              <span className="link-title">{part.title}</span>
              <span className="link-glyph">↗</span>
            </a>
          );
        }

        // Render text with line breaks preserved
        const lines = part.content.split('\n');
        return (
          <React.Fragment key={i}>
            {lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {line}
                {lIdx < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function ConversationFeed({
  messages,
  liveTranscript,
  isThinking,
  onClearHistory,
  onExportPdf,
  onSendMessage,
  activeLanguage = 'en-US'
}) {
  const t = getTranslations(activeLanguage).feed;
  const feedEndRef = useRef(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveTranscript, isThinking]);

  return (
    <div className="conversation-feed-card">
      <div className="feed-header">
        <span className="feed-title">{t.logTitle}</span>
        <div className="feed-header-actions">
          {messages.length > 1 && onExportPdf && (
            <button 
              type="button" 
              className="feed-export-pdf-btn" 
              onClick={onExportPdf}
              title="Export this conversation to a downloadable PDF report"
            >
              {t.exportPdf}
            </button>
          )}
          {messages.length > 1 && (
            <button 
              type="button" 
              className="feed-clear-btn" 
              onClick={onClearHistory}
              title="Clear conversation history"
            >
              {t.clearLog}
            </button>
          )}
        </div>
      </div>

      <div className="feed-scroll-stage">
        {messages.map((msg, messageIndex) => {
          const previousUserMessage = messages
            .slice(0, messageIndex)
            .reverse()
            .find((message) => message.role === 'user');
          const followUpKeys = messageIndex === messages.length - 1 &&
            msg.role === 'assistant' &&
            !msg.isStreaming &&
            !isThinking
            ? getFollowUpKeys(msg, previousUserMessage)
            : [];

          return (
          <div key={msg.id} className={`dialogue-bubble ${msg.role}`}>
            <div className="bubble-meta">
              <span className="bubble-speaker">{msg.role === 'user' ? t.you : t.lumen}</span>
              {msg.timestamp && (
                <span className="bubble-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {Boolean(msg.isPdf || msg.fileName?.toLowerCase().endsWith('.pdf') || (msg.image && msg.image.startsWith('data:application/pdf'))) ? (
              <div className="bubble-file-badge">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="bubble-file-icon">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <div className="bubble-file-details">
                  <span className="bubble-file-name">{msg.fileName || 'Attached Document'}</span>
                  <span className="bubble-file-type">PDF Document</span>
                </div>
              </div>
            ) : msg.image ? (
              <div className="bubble-image-wrap">
                <img src={msg.image} alt="Visual Payload" className="bubble-img" />
              </div>
            ) : null}

            <FormattedBubbleText text={msg.text} />
            {msg.taskProgress && (
              <div
                className="research-progress"
                role="status"
                aria-live="polite"
                aria-label={msg.taskProgress.message}
              >
                <div className="research-progress-label">
                  <span className="research-progress-beacon"></span>
                  <span>{msg.taskProgress.message}</span>
                  <span>{msg.taskProgress.progress}%</span>
                </div>
                <div
                  className="research-progress-track"
                  role="progressbar"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={msg.taskProgress.progress}
                >
                  <span style={{ width: `${Math.max(0, Math.min(100, Number(msg.taskProgress.progress) || 0))}%` }} />
                </div>
              </div>
            )}
            {msg.isStreaming && (
              <span className="streaming-cursor-pulse" title={t.streamingAria} aria-hidden="true">▍</span>
            )}

            {/* Real-Time Interactive Live Data & Document Widgets */}
            {Array.isArray(msg.widgets) && msg.widgets.length > 0 && (
              <div className="bubble-widgets-wrap">
                {msg.widgets.map((widget, wIdx) => {
                  if (widget.widgetType === 'weather') {
                    return <LiveWeatherCard key={wIdx} data={widget} activeLanguage={activeLanguage} />;
                  }
                  if (widget.widgetType === 'crypto') {
                    return <LiveCryptoCard key={wIdx} data={widget} />;
                  }
                  if (widget.widgetType === 'pdf_document') {
                    return <LivePdfCard key={wIdx} data={widget} activeLanguage={activeLanguage} />;
                  }
                  if (widget.widgetType === 'jobs') {
                    return <LiveJobsRadarCard key={wIdx} data={widget} activeLanguage={activeLanguage} />;
                  }
                  return null;
                })}
              </div>
            )}

            {msg.webSources && msg.webSources.length > 0 && (
              <div className="bubble-web-sources">
                <span className="sources-label">{t.webSources}</span>
                <div className="sources-list">
                  {msg.webSources.map((source, sIdx) => {
                    let hostname = '';
                    try {
                      hostname = new URL(source.url).hostname.replace(/^www\./, '');
                    } catch (_) {
                      hostname = 'Web';
                    }
                    return (
                      <a 
                        key={sIdx} 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="source-pill"
                        title={source.snippet || source.title}
                      >
                        <span className="source-dot"></span>
                        <span className="source-name">{source.title || hostname}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {followUpKeys.length > 0 && (
              <div className="follow-up-actions">
                <span className="follow-up-title">{t.followUpsTitle}</span>
                <div className="follow-up-options">
                  {followUpKeys.map((key) => {
                    const suggestion = t.followUps[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        className="follow-up-chip"
                        onClick={() => onSendMessage(suggestion)}
                      >
                        {suggestion}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          );
        })}

        {liveTranscript && (
          <div className="dialogue-bubble user live">
            <span className="bubble-speaker">{t.youSpeaking}</span>
            <p className="bubble-text">"{liveTranscript}"</p>
          </div>
        )}

        {isThinking && (
          <div className="dialogue-bubble assistant thinking">
            <span className="bubble-speaker">{t.lumen}</span>
            <div className="thinking-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}

        <div ref={feedEndRef} />
      </div>
    </div>
  );
}
