import React, { useState, useRef, useEffect } from 'react';
import { previewVoice } from '../services/api';
import { getTranslations, formatString } from '../utils/translations';

export const VOICE_PERSONAS = [
  // English (US & Global)
  {
    id: 'Joanna',
    name: 'Joanna',
    gender: 'female',
    lang: 'en-US',
    accent: 'US English',
    flag: '🇺🇸',
    persona: 'Warm & Radiant',
    description: 'Natural, engaging, and articulate female voice. Ideal for daily collaboration and fluid conversation.',
    tag: 'Popular',
    previewText: "Hello! I am Lumen, your ambient copilot. How can I assist you today?"
  },
  {
    id: 'Matthew',
    name: 'Matthew',
    gender: 'male',
    lang: 'en-US',
    accent: 'US English',
    flag: '🇺🇸',
    persona: 'Executive & Thoughtful',
    description: 'Calm, authoritative, and perceptive male voice. Perfect for deep technical analysis and advisory.',
    tag: 'Executive',
    previewText: "Greetings. I am Lumen, ready to analyze data, vision inputs, and answer your questions."
  },
  {
    id: 'Ruth',
    name: 'Ruth',
    gender: 'female',
    lang: 'en-US',
    accent: 'US English',
    flag: '🇺🇸',
    persona: 'Sophisticated & Natural',
    description: 'Warm, expressive, and nuanced female voice with realistic conversational pauses.',
    tag: 'Natural',
    previewText: "Nice to meet you. I am ready to collaborate on your projects and explore new ideas."
  },
  {
    id: 'Stephen',
    name: 'Stephen',
    gender: 'male',
    lang: 'en-US',
    accent: 'US English',
    flag: '🇺🇸',
    persona: 'Deep & Articulate',
    description: 'Resonant, clear, and confident male tone for analytical discussions and code reviews.',
    tag: 'Deep',
    previewText: "Greetings. Let us explore frontier models, code analysis, and strategic insights."
  },
  {
    id: 'Danielle',
    name: 'Danielle',
    gender: 'female',
    lang: 'en-US',
    accent: 'US English',
    flag: '🇺🇸',
    persona: 'Crisp & Dynamic',
    description: 'Modern, bright, and energetic female delivery for fast-paced brainstorming.',
    tag: 'Modern',
    previewText: "Hi there! Let us explore ideas and build something amazing together today."
  },
  {
    id: 'Gregory',
    name: 'Gregory',
    gender: 'male',
    lang: 'en-US',
    accent: 'US English',
    flag: '🇺🇸',
    persona: 'Friendly & Casual',
    description: 'Approachable, warm, and conversational male voice with a relaxed cadence.',
    tag: 'Casual',
    previewText: "Hey! I'm always here to help you brainstorm, code, and solve challenges."
  },
  // English (UK)
  {
    id: 'Amy',
    name: 'Amy',
    gender: 'female',
    lang: 'en-GB',
    accent: 'UK British',
    flag: '🇬🇧',
    persona: 'Refined & Poised',
    description: 'Polished, melodic, and intelligent British female voice with clear RP pronunciation.',
    tag: 'British',
    previewText: "Good day. I am Lumen, very pleased to be at your service today."
  },
  {
    id: 'Arthur',
    name: 'Arthur',
    gender: 'male',
    lang: 'en-GB',
    accent: 'UK British',
    flag: '🇬🇧',
    persona: 'Distinguished Scholar',
    description: 'Reflective, scholarly, and calm British male tone with distinguished poise.',
    tag: 'Scholarly',
    previewText: "Welcome. I can provide thoughtful perspectives, data summaries, and in-depth analysis."
  },
  // English (AU)
  {
    id: 'Olivia',
    name: 'Olivia',
    gender: 'female',
    lang: 'en-AU',
    accent: 'Australian',
    flag: '🇦🇺',
    persona: 'Bright & Melodic',
    description: 'Upbeat, friendly Australian female voice with natural warmth.',
    tag: 'Oceanic',
    previewText: "G'day! I am Lumen, excited to help you explore and create."
  },
  // German
  {
    id: 'Vicki',
    name: 'Vicki',
    gender: 'female',
    lang: 'de-DE',
    accent: 'Deutsch',
    flag: '🇩🇪',
    persona: 'Klar & Freundlich',
    description: 'Natürliche, ausdrucksstarke deutsche Frauenstimme mit hervorragender Verständlichkeit.',
    tag: 'Deutsch',
    previewText: "Hallo! Ich bin Lumen, Ihre intelligente Begleiterin für Sprache und Vision."
  },
  {
    id: 'Daniel',
    name: 'Daniel',
    gender: 'male',
    lang: 'de-DE',
    accent: 'Deutsch',
    flag: '🇩🇪',
    persona: 'Sachlich & Präzise',
    description: 'Ruhige, vertrauenswürdige deutsche Männerstimme für professionelle Auswertungen.',
    tag: 'Deutsch',
    previewText: "Guten Tag. Ich unterstütze Sie gerne bei Recherchen, Analysen und technischen Fragen."
  },
  // French
  {
    id: 'Lea',
    name: 'Léa',
    gender: 'female',
    lang: 'fr-FR',
    accent: 'Français',
    flag: '🇫🇷',
    persona: 'Élégante & Douce',
    description: 'Voix féminine française raffinée, chaleureuse et fluide.',
    tag: 'Français',
    previewText: "Bonjour! Je suis Lumen, votre copilote multimodal pour la voix et la vision."
  },
  {
    id: 'Remi',
    name: 'Rémi',
    gender: 'male',
    lang: 'fr-FR',
    accent: 'Français',
    flag: '🇫🇷',
    persona: 'Chaleureux & Naturel',
    description: 'Voix masculine française claire, bienveillante et naturelle.',
    tag: 'Français',
    previewText: "Bonjour! Comment puis-je vous accompagner dans vos projets aujourd'hui?"
  },
  // Spanish
  {
    id: 'Lucia',
    name: 'Lucía',
    gender: 'female',
    lang: 'es-ES',
    accent: 'Español',
    flag: '🇪🇸',
    persona: 'Cálida & Expresiva',
    description: 'Voz femenina en español natural, ágil y comunicativa.',
    tag: 'Español',
    previewText: "¡Hola! Soy Lumen, tu asistente inteligente de voz y visión multimodal."
  },
  {
    id: 'Sergio',
    name: 'Sergio',
    gender: 'male',
    lang: 'es-ES',
    accent: 'Español',
    flag: '🇪🇸',
    persona: 'Claro & Cercano',
    description: 'Voz masculina en español cercana, profesional y articulada.',
    tag: 'Español',
    previewText: "¡Hola! Qué gusto saludarte. ¿En qué podemos trabajar hoy?"
  },
  // Italian
  {
    id: 'Bianca',
    name: 'Bianca',
    gender: 'female',
    lang: 'it-IT',
    accent: 'Italiano',
    flag: '🇮🇹',
    persona: 'Armoniosa & Vivace',
    description: 'Voce femminile italiana espressiva, melodica e naturale.',
    tag: 'Italiano',
    previewText: "Ciao! Sono Lumen, la tua assistente vocale intelligente e multimodale."
  },
  {
    id: 'Adriano',
    name: 'Adriano',
    gender: 'male',
    lang: 'it-IT',
    accent: 'Italiano',
    flag: '🇮🇹',
    persona: 'Profondo & Accogliente',
    description: 'Voce maschile italiana avvolgente, sicura e accogliente.',
    tag: 'Italiano',
    previewText: "Benvenuto. Sono qui per aiutarti a esplorare idee e creare soluzioni."
  },
  // Japanese
  {
    id: 'Kazuha',
    name: 'Kazuha',
    gender: 'female',
    lang: 'ja-JP',
    accent: '日本語',
    flag: '🇯🇵',
    persona: '親しみやすく自然',
    description: '自然で丁寧な日本語の女性音声。日常的な対話に最適です。',
    tag: '日本語',
    previewText: "こんにちは、ルーメンです。音声とビジョンでお手伝いします。"
  },
  {
    id: 'Takumi',
    name: 'Takumi',
    gender: 'male',
    lang: 'ja-JP',
    accent: '日本語',
    flag: '🇯🇵',
    persona: '誠実で明瞭',
    description: '聞き取りやすく落ち着いた日本語の男性音声。',
    tag: '日本語',
    previewText: "こんにちは。本日はどのような作業をサポートいたしましょうか？"
  }
];

export default function LumenVoiceModal({
  isOpen,
  onClose,
  activeVoice = 'Joanna',
  onSelectVoice,
  activeLanguage = 'en-US'
}) {
  const t = getTranslations(activeLanguage).voiceModal;
  const [filter, setFilter] = useState('all');
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState(null);
  const [customPhrase, setCustomPhrase] = useState('');
  const [savedFeedback, setSavedFeedback] = useState(null);

  const audioPlayerRef = useRef(null);

  useEffect(() => {
    // Stop any audio when modal closes
    if (!isOpen && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setPlayingVoiceId(null);
      setLoadingVoiceId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentVoiceObj = VOICE_PERSONAS.find(v => v.id === activeVoice) || VOICE_PERSONAS[0];

  // Filter list based on selected category
  const filteredVoices = VOICE_PERSONAS.filter(voice => {
    if (filter === 'female') return voice.gender === 'female';
    if (filter === 'male') return voice.gender === 'male';
    if (filter === 'english') return voice.lang.startsWith('en');
    if (filter === 'multilingual') return !voice.lang.startsWith('en');
    return true; // 'all'
  });

  // Audition voice preview via Amazon Polly
  const handlePlayPreview = async (voice, customText = '') => {
    // If already playing this voice, pause it
    if (playingVoiceId === voice.id) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setPlayingVoiceId(null);
      return;
    }

    try {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setLoadingVoiceId(voice.id);
      setPlayingVoiceId(null);

      const phraseToSpeak = (customText || customPhrase || voice.previewText).trim();
      const res = await previewVoice(voice.id, phraseToSpeak);

      if (res && res.audioBase64) {
        const audio = new Audio(`data:audio/mp3;base64,${res.audioBase64}`);
        audioPlayerRef.current = audio;

        audio.onplay = () => {
          setLoadingVoiceId(null);
          setPlayingVoiceId(voice.id);
        };
        audio.onended = () => {
          setPlayingVoiceId(null);
        };
        audio.onerror = () => {
          setLoadingVoiceId(null);
          setPlayingVoiceId(null);
        };

        await audio.play();
      } else {
        setLoadingVoiceId(null);
      }
    } catch (err) {
      console.warn("Failed to preview voice:", err);
      setLoadingVoiceId(null);
      setPlayingVoiceId(null);
    }
  };

  const handleSelect = (voiceId) => {
    if (onSelectVoice) {
      onSelectVoice(voiceId);
      setSavedFeedback(voiceId);
      setTimeout(() => setSavedFeedback(null), 3500);

      const targetVoiceObj = VOICE_PERSONAS.find(v => v.id === voiceId);
      if (targetVoiceObj) {
        handlePlayPreview(targetVoiceObj);
      }
    }
  };

  return (
    <div className="voice-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="voice-modal-title">
      <div className="voice-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="voice-modal-header">
          <div className="voice-modal-title-group">
            <div className="voice-modal-badge">
              <span className="voice-badge-icon">🎙️</span>
              <span className="voice-badge-label">{t.studioBadge}</span>
            </div>
            <h2 id="voice-modal-title" className="voice-modal-title">{t.title}</h2>
            <p className="voice-modal-subtitle">
              {t.subtitle}
            </p>
          </div>
          <button 
            type="button" 
            className="voice-modal-close-btn" 
            onClick={onClose}
            aria-label="Close voice settings"
          >
            ✕
          </button>
        </div>

        {/* Current Active Voice Spotlight Card */}
        <div className="voice-spotlight-card">
          <div className="voice-spotlight-left">
            <div className={`voice-avatar-orb ${currentVoiceObj.gender}`}>
              <span className="voice-avatar-flag">{currentVoiceObj.flag}</span>
              {playingVoiceId === currentVoiceObj.id && (
                <div className="voice-mini-equalizer">
                  <span className="eq-bar bar1"></span>
                  <span className="eq-bar bar2"></span>
                  <span className="eq-bar bar3"></span>
                </div>
              )}
            </div>
            <div className="voice-spotlight-info">
              <div className="voice-spotlight-top">
                <span className="voice-spotlight-tag">{t.activeTag}</span>
                <span className="voice-spotlight-accent">{currentVoiceObj.accent}</span>
              </div>
              <h3 className="voice-spotlight-name">
                {currentVoiceObj.name} <span className="voice-persona-tag">{currentVoiceObj.persona}</span>
              </h3>
              <p className="voice-spotlight-desc">{currentVoiceObj.description}</p>
            </div>
          </div>
          <div className="voice-spotlight-actions">
            <button
              type="button"
              className={`voice-audition-btn ${playingVoiceId === currentVoiceObj.id ? 'is-playing' : ''} ${loadingVoiceId === currentVoiceObj.id ? 'is-loading' : ''}`}
              onClick={() => handlePlayPreview(currentVoiceObj)}
              disabled={loadingVoiceId === currentVoiceObj.id}
            >
              {loadingVoiceId === currentVoiceObj.id ? (
                <>{t.generatingBtn}</>
              ) : playingVoiceId === currentVoiceObj.id ? (
                <>{t.stopBtn}</>
              ) : (
                <>{t.auditionBtn}</>
              )}
            </button>
          </div>
        </div>

        {/* Voice Saved & Activated Confirmation Banner */}
        {savedFeedback && (
          <div className="voice-saved-banner" role="status" aria-live="polite">
            <span className="voice-saved-check">✓</span>
            <span className="voice-saved-text">
              {formatString(t.voiceSaved || "Lumen voice set to {voice}. Speaking sample preview...", { voice: savedFeedback })}
            </span>
          </div>
        )}

        {/* Category Filters */}
        <div className="voice-filter-tabs">
          <button 
            type="button" 
            className={`voice-filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            {t.filterAll} ({VOICE_PERSONAS.length})
          </button>
          <button 
            type="button" 
            className={`voice-filter-tab ${filter === 'female' ? 'active' : ''}`}
            onClick={() => setFilter('female')}
          >
            {t.filterFemale} ({VOICE_PERSONAS.filter(v => v.gender === 'female').length})
          </button>
          <button 
            type="button" 
            className={`voice-filter-tab ${filter === 'male' ? 'active' : ''}`}
            onClick={() => setFilter('male')}
          >
            {t.filterMale} ({VOICE_PERSONAS.filter(v => v.gender === 'male').length})
          </button>
          <button 
            type="button" 
            className={`voice-filter-tab ${filter === 'english' ? 'active' : ''}`}
            onClick={() => setFilter('english')}
          >
            {t.filterEnglish} (US / UK / AU)
          </button>
          <button 
            type="button" 
            className={`voice-filter-tab ${filter === 'multilingual' ? 'active' : ''}`}
            onClick={() => setFilter('multilingual')}
          >
            {t.filterMultilingual} (DE / FR / ES / IT / JP)
          </button>
        </div>

        {/* Voice Cards Grid */}
        <div className="voice-grid">
          {filteredVoices.map((voice) => {
            const isSelected = voice.id === activeVoice;
            const isPlaying = playingVoiceId === voice.id;
            const isLoading = loadingVoiceId === voice.id;

            return (
              <div 
                key={voice.id} 
                className={`voice-card ${isSelected ? 'selected' : ''} ${isPlaying ? 'playing' : ''}`}
                onClick={() => handleSelect(voice.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(voice.id);
                  }
                }}
                aria-label={`Select voice ${voice.name}, ${voice.persona}`}
              >
                <div className="voice-card-top">
                  <div className="voice-card-identity">
                    <span className="voice-flag-pill">{voice.flag} {voice.accent}</span>
                    <span className={`voice-gender-pill ${voice.gender}`}>{voice.gender === 'female' ? '♀ Female' : '♂ Male'}</span>
                  </div>
                  {isSelected ? (
                    <span className="voice-active-indicator">✓ Active</span>
                  ) : voice.tag ? (
                    <span className="voice-badge-subtle">{voice.tag}</span>
                  ) : null}
                </div>

                <div className="voice-card-body">
                  <h4 className="voice-card-name">
                    {voice.name}
                    <span className="voice-card-persona">{voice.persona}</span>
                  </h4>
                  <p className="voice-card-desc">{voice.description}</p>
                </div>

                <div className="voice-card-footer">
                  <button
                    type="button"
                    className={`voice-preview-btn ${isPlaying ? 'playing' : ''} ${isLoading ? 'loading' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayPreview(voice);
                    }}
                    disabled={isLoading}
                    title={`Audition sample for ${voice.name}`}
                  >
                    {isLoading ? (
                      '⏳'
                    ) : isPlaying ? (
                      <>
                        <span className="voice-eq-icon">
                          <span className="eq-bar"></span>
                          <span className="eq-bar"></span>
                          <span className="eq-bar"></span>
                        </span>
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <span>▶</span>
                        <span>Preview</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className={`voice-select-action-btn ${isSelected ? 'active-btn' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(voice.id);
                    }}
                  >
                    {isSelected ? t.activeVoiceBadge : t.selectVoiceBtn}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom Phrase Testing Bar */}
        <div className="voice-custom-test-bar">
          <div className="voice-test-label">
            <span>🗣️ {t.testPhraseBtn}:</span>
          </div>
          <div className="voice-test-input-group">
            <input
              type="text"
              className="voice-test-input"
              placeholder={t.customPlaceholder || `Type any phrase to hear ${currentVoiceObj.name} speak it...`}
              value={customPhrase}
              onChange={(e) => setCustomPhrase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePlayPreview(currentVoiceObj, customPhrase);
                }
              }}
            />
            <button
              type="button"
              className="voice-test-btn"
              onClick={() => handlePlayPreview(currentVoiceObj, customPhrase)}
              disabled={loadingVoiceId === currentVoiceObj.id}
            >
              {loadingVoiceId === currentVoiceObj.id ? t.generatingBtn : t.testPhraseBtn}
            </button>
          </div>
        </div>

        {/* Natural Conversation Voice Switching Hint */}
        <div className="voice-footer-hint">
          <span className="hint-icon">💡</span>
          <span className="hint-text">
            <strong>Pro Tip:</strong> You can also change Lumen's voice anytime in conversation by speaking or typing naturally: <em>"Switch your voice to female"</em>, <em>"Change voice to Amy"</em>, or <em>"Speak with a British accent"</em>.
          </span>
        </div>
      </div>
    </div>
  );
}
