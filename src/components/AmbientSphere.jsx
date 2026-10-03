import React, { useMemo } from 'react';
import './ParticleOrb.css';

const TOTAL_PARTICLES = 300;

export default function AmbientSphere({
  isListening,
  isThinking,
  isSpeaking,
  isTaskComplete,
  isProcessingDoc,
  isProcessingImg,
  onToggleListen
}) {
  const particles = useMemo(() => Array.from({ length: TOTAL_PARTICLES }), []);

  const getStatusText = () => {
    if (isTaskComplete) return "Task Complete ✓";
    if (isProcessingDoc) return "Inspecting document contents...";
    if (isProcessingImg) return "Analyzing visual features...";
    if (isListening) return "Listening to your voice...";
    if (isThinking) return "Lumen is reflecting...";
    if (isSpeaking) return "Lumen is speaking...";
    return "Tap sphere to converse";
  };

  const stateClass = isTaskComplete
    ? 'complete'
    : isProcessingDoc
    ? 'processing-doc'
    : isListening 
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

      {/* Main interactive neural 3D particle sphere */}
      <div 
        className="siri-sphere-wrap particle-orb-wrap"
        onClick={onToggleListen}
        role="button"
        tabIndex={0}
        aria-label={getStatusText()}
        title="Tap to converse"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleListen();
          }
        }}
      >
        <div className="siri-core">
          {/* Inner ambient glow nucleus */}
          <div className="orb-center-nucleus"></div>

          {/* 3D Particle Orb Scene */}
          <div className={`orb-3d-scene ${stateClass}`}>
            <div className="orb-3d-wrap">
              {particles.map((_, i) => (
                <div key={i} className="c" />
              ))}
            </div>
          </div>

          {/* visionOS Specular Lens Refraction */}
          <div className="siri-specular-lens"></div>
        </div>
      </div>

      {/* Spoken / Listening Status Badge */}
      <div className="status-pill">
        <span className="status-label">{getStatusText()}</span>
      </div>
    </div>
  );
}

