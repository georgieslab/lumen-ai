import React, { useMemo } from 'react';
import { getTranslations } from '../utils/translations';
import './ParticleOrb.css';

const TOTAL_PARTICLES = 300;

export default function AmbientSphere({
  isListening,
  isThinking,
  isSpeaking,
  isTaskComplete,
  isProcessingDoc,
  isProcessingImg,
  audioLevel = 0,
  frequencyData = [0, 0, 0, 0, 0, 0, 0, 0],
  onToggleListen,
  activeLanguage = 'en-US',
  sphereLabels
}) {
  const particles = useMemo(() => Array.from({ length: TOTAL_PARTICLES }), []);
  const t = sphereLabels || getTranslations(activeLanguage).sphere;

  const getStatusText = () => {
    if (isTaskComplete) return t.taskComplete;
    if (isProcessingDoc) return t.inspectingDoc;
    if (isProcessingImg) return t.inspectingImg;
    if (isListening) return t.listening;
    if (isThinking) return t.reflecting;
    if (isSpeaking) return t.speaking;
    return t.tapToConverse;
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

  const audioScale = (isListening || isSpeaking) && audioLevel > 0.04
    ? 1 + (audioLevel * 0.16)
    : 1;

  return (
    <div 
      className={`sphere-stage ${stateClass}`}
      style={{
        '--dynamic-audio-scale': audioScale,
        '--dynamic-audio-energy': audioLevel
      }}
    >
      {/* Outer ambient radiant glow */}
      <div 
        className="ambient-radiance"
        style={{
          transform: `scale(${audioScale * 1.05})`,
          opacity: 0.35 + (audioLevel * 0.45)
        }}
      ></div>

      {/* Main interactive neural 3D particle sphere */}
      <div 
        className="siri-sphere-wrap particle-orb-wrap"
        onClick={onToggleListen}
        role="button"
        tabIndex={0}
        aria-label={getStatusText()}
        title={t.tapToConverse}
        onKeyDown={(e) => {
          if (!e.repeat && (e.key === 'Enter' || e.key === ' ')) {
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

      {/* Spoken / Listening Status Badge & Live Equalizer Waveform */}
      <div className={`status-pill ${(isListening || isSpeaking) && audioLevel > 0.05 ? 'has-audio-energy' : ''}`}>
        {(isListening || isSpeaking) && (
          <div className="audio-equalizer-bars" title="Live Frequency Equalizer">
            {frequencyData.map((val, idx) => (
              <span
                key={idx}
                className="eq-bar"
                style={{
                  height: `${Math.max(3, Math.min(18, Math.round((val / 100) * 18)))}px`,
                  opacity: Math.max(0.35, val / 100)
                }}
              />
            ))}
          </div>
        )}
        <span className="status-label">{getStatusText()}</span>
      </div>
    </div>
  );
}
