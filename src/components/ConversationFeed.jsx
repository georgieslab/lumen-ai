import React, { useRef, useEffect } from 'react';

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

