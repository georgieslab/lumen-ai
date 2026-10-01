import React, { useRef, useEffect } from 'react';

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

            {msg.image && (
              <div className="bubble-image-wrap">
                <img src={msg.image} alt="Visual Payload" className="bubble-img" />
              </div>
            )}

            <p className="bubble-text">{msg.text}</p>
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
