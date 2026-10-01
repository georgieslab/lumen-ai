import React from 'react';

export default function AmbientSphere({
  isListening,
  isThinking,
  isSpeaking,
  onToggleListen
}) {
  const getStatusText = () => {
    if (isListening) return "Listening to your voice...";
    if (isThinking) return "Lumen is reflecting...";
    if (isSpeaking) return "Lumen is speaking...";
    return "Tap sphere to converse";
  };

  const stateClass = isListening 
    ? 'listening' 
    : isThinking 
    ? 'thinking' 
    : isSpeaking 
    ? 'speaking' 
    : 'idle';

  return (
    <div className={`sphere-stage ${stateClass}`}>
      {/* Outer ambient radiant glow */}
      <div className="ambient-radiance"></div>

      {/* Main interactive neural sphere */}
      <div 
        className="siri-sphere-wrap"
        onClick={onToggleListen}
        role="button"
        tabIndex={0}
        aria-label={getStatusText()}
        title="Tap to start or stop listening"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleListen();
          }
        }}
      >
        <div className="siri-core loader">
          <div className="loader-inner">
            <div className="blob b1"></div>
            <div className="blob b2"></div>
            <div className="blob b3"></div>
            <div className="blob b4"></div>
            <div className="blob b5"></div>
            <div className="blob b6"></div>
          </div>
          {/* visionOS Specular Lens Refraction */}
          <div className="siri-specular-lens"></div>
        </div>
      </div>

      {/* Audio Waveform Equalizer Bars */}
      <div className={`waveform-container ${isSpeaking || isListening ? 'active' : ''}`}>
        <span className="wave-bar w1"></span>
        <span className="wave-bar w2"></span>
        <span className="wave-bar w3"></span>
        <span className="wave-bar w4"></span>
        <span className="wave-bar w5"></span>
        <span className="wave-bar w6"></span>
        <span className="wave-bar w7"></span>
      </div>

      {/* Spoken / Listening Status Badge */}
      <div className="status-pill">
        <span className={`status-dot ${stateClass}`}></span>
        <span className="status-label">{getStatusText()}</span>
      </div>
    </div>
  );
}
