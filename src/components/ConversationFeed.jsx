import React, { useRef, useEffect, useState } from 'react';
import { fetchLiveWeatherDirect } from '../services/api';

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

export function LiveWeatherCard({ data, onCityChange, initialSearching = false }) {
  const [weatherData, setWeatherData] = useState(data);
  const [isSearching, setIsSearching] = useState(initialSearching);
  const [cityInput, setCityInput] = useState('');
  const [isLoadingCity, setIsLoadingCity] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (data) setWeatherData(data);
  }, [data]);

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
          <span>LIVE METEO</span>
        </div>
        <div className="widget-header-controls">
          <span className="widget-location">{weatherData.city}</span>
          <button
            type="button"
            className="btn-change-city"
            onClick={() => setIsSearching(!isSearching)}
            title="Search weather for another city"
          >
            {isSearching ? '✕ Close' : '🔍 Change City'}
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
              placeholder="Search city (e.g. Paris, Tokyo, Miami)..."
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="weather-city-submit-btn"
              disabled={!cityInput.trim() || isLoadingCity}
            >
              {isLoadingCity ? '...' : 'Search'}
            </button>
          </form>

          {/* Quick city pills */}
          <div className="weather-quick-cities">
            {['Paris', 'Tokyo', 'London', 'New York', 'Dubai', 'Sydney', 'Rome'].map((city) => (
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
              <span className="forecast-day">{f.day}</span>
              <span className="forecast-icon">{f.icon}</span>
              <span className="forecast-temps">{f.max}°/{f.min}°</span>
            </div>
          ))}
        </div>
      )}
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
  onClearHistory
}) {
  const feedEndRef = useRef(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveTranscript, isThinking]);

  return (
    <div className="conversation-feed-card">
      <div className="feed-header">
        <span className="feed-title">Conversation Log</span>
        {messages.length > 1 && (
          <button 
            type="button" 
            className="feed-clear-btn" 
            onClick={onClearHistory}
            title="Clear conversation history"
          >
            Clear Log
          </button>
        )}
      </div>

      <div className="feed-scroll-stage">
        {messages.map((msg) => (
          <div key={msg.id} className={`dialogue-bubble ${msg.role}`}>
            <div className="bubble-meta">
              <span className="bubble-speaker">{msg.role === 'user' ? 'You' : 'Lumen'}</span>
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

            {/* Real-Time Interactive Live Data Widgets (Weather, Crypto/Markets) */}
            {Array.isArray(msg.widgets) && msg.widgets.length > 0 && (
              <div className="bubble-widgets-wrap">
                {msg.widgets.map((widget, wIdx) => {
                  if (widget.widgetType === 'weather') {
                    return <LiveWeatherCard key={wIdx} data={widget} />;
                  }
                  if (widget.widgetType === 'crypto') {
                    return <LiveCryptoCard key={wIdx} data={widget} />;
                  }
                  return null;
                })}
              </div>
            )}

            {msg.webSources && msg.webSources.length > 0 && (
              <div className="bubble-web-sources">
                <span className="sources-label">🌐 Web Sources:</span>
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
          </div>
        ))}

        {liveTranscript && (
          <div className="dialogue-bubble user live">
            <span className="bubble-speaker">You (speaking...)</span>
            <p className="bubble-text">"{liveTranscript}"</p>
          </div>
        )}

        {isThinking && (
          <div className="dialogue-bubble assistant thinking">
            <span className="bubble-speaker">Lumen</span>
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

