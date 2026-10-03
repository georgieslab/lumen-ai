import React, { useState, useEffect, useRef } from 'react';
import AmbientSphere from './components/AmbientSphere';
import VisionScanner, { SpatialMediaIcon } from './components/VisionScanner';
import ConversationFeed from './components/ConversationFeed';
import GoogleAuthButton from './components/GoogleAuthButton';
import { converseWithLumen, processFile } from './services/api';

const DEFAULT_GREETING = "I am Lumen, your ambient voice and vision AI companion. Tap the sphere or upload an image to begin.";

function getCircadianPhase() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';   // Dawn / Morning Aurora
  if (h >= 12 && h < 18) return 'day';       // Solar Zenith
  if (h >= 18 && h < 22) return 'evening';   // Twilight Dusk
  return 'night';                            // Midnight Nebula
}

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const selectedImage = selectedFile; // Backward compatibility alias
  const setSelectedImage = setSelectedFile; // Backward compatibility alias
  const [processingFile, setProcessingFile] = useState(null);
  const [isTaskComplete, setIsTaskComplete] = useState(false);
  const [circadianSetting, setCircadianSetting] = useState(() => {
    try {
      return localStorage.getItem('lumen_circadian_setting') || 'auto';
    } catch (_) {
      return 'auto';
    }
  });
  const [currentHourPhase, setCurrentHourPhase] = useState(getCircadianPhase());
  const [webMode, setWebMode] = useState('auto'); // 'auto' | 'always' | 'off'
  const [showLogDrawer, setShowLogDrawer] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('lumen_google_user');
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });

  // Periodically refresh local circadian phase for auto mode
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHourPhase(getCircadianPhase());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const activeCircadian = circadianSetting === 'auto' ? currentHourPhase : circadianSetting;

  const handleCycleCircadian = () => {
    const sequence = ['auto', 'morning', 'day', 'evening', 'night'];
    const next = sequence[(sequence.indexOf(circadianSetting) + 1) % sequence.length];
    setCircadianSetting(next);
    try {
      localStorage.setItem('lumen_circadian_setting', next);
    } catch (_) {}
  };

  const getCircadianInfo = () => {
    const icons = { morning: '🌅', day: '☀️', evening: '🌇', night: '🌌' };
    const labels = { morning: 'Dawn', day: 'Solar', evening: 'Dusk', night: 'Midnight' };
    const phaseLabel = labels[activeCircadian] || 'Cosmic';
    return {
      icon: icons[activeCircadian] || '✨',
      label: circadianSetting === 'auto' ? `Auto: ${phaseLabel}` : phaseLabel
    };
  };
  const [messages, setMessages] = useState([
    {
      id: 'lumen-welcome',
      role: 'assistant',
      text: DEFAULT_GREETING,
      timestamp: Date.now()
    }
  ]);

  const handleCycleWebMode = () => {
    setWebMode(prev => {
      if (prev === 'auto') return 'always';
      if (prev === 'always') return 'off';
      return 'auto';
    });
  };

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          await document.documentElement.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn("Fullscreen toggle error:", err);
    }
  };

  // Sync fullscreen state with browser changes (e.g. Esc key or F11)
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement));
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, []);

  const recognitionRef = useRef(null);
  const currentAudioRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleGlobalFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const processed = await processFile(file);
      setSelectedFile(processed);
    } catch (err) {
      console.warn("Could not process attached file:", err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGlobalDragEnter = (e) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsGlobalDragging(true);
    }
  };

  const handleGlobalDragLeave = (e) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsGlobalDragging(false);
      dragCounterRef.current = 0;
    }
  };

  const handleGlobalDragOver = (e) => {
    e.preventDefault();
  };

  const handleGlobalDrop = async (e) => {
    e.preventDefault();
    setIsGlobalDragging(false);
    dragCounterRef.current = 0;
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    try {
      const processed = await processFile(file);
      setSelectedFile(processed);
    } catch (err) {
      console.warn("Could not process dropped file:", err);
    }
  };

  // Load history from localStorage (scoped to current user account if signed in)
  useEffect(() => {
    try {
      const storageKey = currentUser?.email ? `lumen_history_${currentUser.email}` : 'lumen_standalone_history';
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
      if (currentUser?.givenName || currentUser?.name) {
        setMessages([{
          id: 'lumen-welcome',
          role: 'assistant',
          text: `Welcome back, ${currentUser.givenName || currentUser.name}. Your personal neural workspace is connected. How can I assist you today?`,
          timestamp: Date.now()
        }]);
      }
    } catch (err) {
      console.warn("Could not load saved conversation:", err);
    }
  }, [currentUser?.email]);

  // Save history to localStorage
  const persistMessages = (newMsgs) => {
    setMessages(newMsgs);
    try {
      const sanitised = newMsgs.slice(-15).map(m => ({
        ...m,
        image: m.image && m.image.length > 10000 ? null : m.image
      }));
      const storageKey = currentUser?.email ? `lumen_history_${currentUser.email}` : 'lumen_standalone_history';
      localStorage.setItem(storageKey, JSON.stringify(sanitised));
    } catch (err) {
      console.warn("Storage write error:", err);
    }
  };

  const handleUserLogin = (user) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('lumen_google_user', JSON.stringify(user));
      const userKey = `lumen_history_${user.email}`;
      const saved = localStorage.getItem(userKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
      const welcome = [{
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        text: `Welcome, ${user.givenName || user.name}. Your personal neural profile is active. How can I assist you today?`,
        timestamp: Date.now()
      }];
      setMessages(welcome);
      localStorage.setItem(userKey, JSON.stringify(welcome));
      playBrowserSpeech(`Welcome, ${user.givenName || user.name}. How can I assist you today?`);
    } catch (err) {
      console.warn("Error on user login:", err);
    }
  };

  const handleUserLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('lumen_google_user');
      const saved = localStorage.getItem('lumen_standalone_history');
      if (saved) {
        setMessages(JSON.parse(saved));
      } else {
        setMessages([{
          id: 'lumen-welcome',
          role: 'assistant',
          text: DEFAULT_GREETING,
          timestamp: Date.now()
        }]);
      }
      playBrowserSpeech("You have signed out. Switching to guest session.");
    } catch (_) {}
  };

  const transcriptRef = useRef('');
  const sendRef = useRef(null);

  useEffect(() => {
    sendRef.current = handleSendMessage;
  });

  // Initialize Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognizer = new SpeechRecognition();
      recognizer.continuous = false; // Automatically stops when user finishes speaking
      recognizer.interimResults = true;
      recognizer.lang = 'en-US';

      recognizer.onstart = () => {
        setIsListening(true);
        setLiveTranscript('');
        transcriptRef.current = '';
      };

      recognizer.onresult = (e) => {
        let transcript = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          transcript += e.results[i][0].transcript;
        }
        setLiveTranscript(transcript);
        transcriptRef.current = transcript;
      };

      recognizer.onerror = (e) => {
        if (e.error !== 'no-speech') {
          console.warn('Speech recognition error:', e.error);
        }
        setIsListening(false);
        setLiveTranscript('');
        transcriptRef.current = '';
      };

      recognizer.onend = () => {
        setIsListening(false);
        // Auto-send when silence is detected and recognizer ends naturally
        if (transcriptRef.current.trim()) {
          const text = transcriptRef.current;
          transcriptRef.current = ''; // Clear to prevent double send
          setLiveTranscript('');
          if (sendRef.current) sendRef.current(text);
        }
      };

      recognitionRef.current = recognizer;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
    };
  }, []);

  // Dispatch message to backend
  const handleSendMessage = async (textToSend, filePayload = selectedFile) => {
    unlockAudio();
    const userPrompt = (textToSend || liveTranscript || textInput).trim();
    if (!userPrompt && !filePayload) return;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      setIsSpeaking(false);
    }

    const userMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: userPrompt,
      image: filePayload && !filePayload.isPdf ? filePayload.dataUrl : null,
      fileName: filePayload?.name,
      isPdf: Boolean(filePayload?.isPdf),
      timestamp: Date.now()
    };

    const nextMessages = [...messages, userMessage];
    persistMessages(nextMessages);

    setLiveTranscript('');
    setTextInput('');
    if (filePayload) {
      setProcessingFile(filePayload);
    }
    setSelectedFile(null);
    setIsThinking(true);
    setIsTaskComplete(false);

    try {
      const data = await converseWithLumen({
        transcript: userPrompt,
        history: nextMessages,
        file: filePayload,
        webMode
      });

      const assistantMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        text: data.replyText,
        webSources: data.webSources || [],
        webType: data.webType || null,
        widgets: data.widgets || [],
        timestamp: Date.now()
      };

      persistMessages([...nextMessages, assistantMessage]);

      // Trigger visual task complete cue
      setIsTaskComplete(true);
      setTimeout(() => {
        setIsTaskComplete(false);
        setProcessingFile(null);
      }, 2800);

      // Play synthesized audio
      if (data.audioBase64) {
        playAudioBuffer(data.audioBase64);
      } else {
        playBrowserSpeech(data.replyText);
      }
    } catch (err) {
      console.error("Converse error:", err);
      const errorMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: "I am having trouble connecting to my neural network. Please check connection and try again.",
        timestamp: Date.now()
      };
      persistMessages([...nextMessages, errorMessage]);
      setIsTaskComplete(false);
      setProcessingFile(null);
    } finally {
      setIsThinking(false);
    }
  };

  // Play audio from Amazon Polly base64 payload
  const playAudioBuffer = (base64Audio) => {
    try {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
      const audio = currentAudioRef.current || new Audio();
      if (!currentAudioRef.current) currentAudioRef.current = audio;
      
      audio.src = audioUrl;
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => setIsSpeaking(false);

      audio.play().catch(e => {
        console.warn("Audio autoplay blocked by browser policy:", e);
        setIsSpeaking(false);
      });
    } catch (err) {
      console.warn("Audio playback failed:", err);
      setIsSpeaking(false);
    }
  };

  // Fallback speech synthesis
  const playBrowserSpeech = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // Unlock audio engine to satisfy browser autoplay policies
  function unlockAudio() {
    if (!currentAudioRef.current) {
      currentAudioRef.current = new Audio();
    }
    const audio = currentAudioRef.current;
    if (audio.src === '' || audio.src === location.href) {
      // Tiny silent mp3 base64 to unlock audio context
      audio.src = 'data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
    }
    audio.play().then(() => {
      // Intentionally don't pause immediately here if we want to let it unlock properly, 
      // but the silent audio will end quickly.
    }).catch(e => console.warn("Audio unlock pending:", e));
  };

  // Toggle voice listening
  const handleToggleListen = () => {
    unlockAudio();

    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      
      const textToSubmit = liveTranscript || transcriptRef.current;
      transcriptRef.current = ''; // Clear to prevent onend from double sending
      
      if (textToSubmit.trim() || selectedFile) {
        handleSendMessage(textToSubmit, selectedFile);
      }
    } else {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        setIsSpeaking(false);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (err) {
          console.warn("Recognizer already active:", err);
        }
      } else {
        alert("Speech recognition is not supported in this browser. Please use Google Chrome, Edge, or the text input below.");
      }
    }
  };

  const handleClearHistory = () => {
    if (confirm("Clear all conversation history?")) {
      const reset = [{
        id: 'lumen-welcome',
        role: 'assistant',
        text: DEFAULT_GREETING,
        timestamp: Date.now()
      }];
      setMessages(reset);
      localStorage.removeItem('lumen_standalone_history');
    }
  };

  return (
    <div 
      className={`lumen-app-stage ${selectedFile || processingFile ? 'has-active-doc' : ''} ${textInput.trim() ? 'has-typing' : ''} ${isThinking ? 'is-thinking' : ''} ${isListening ? 'is-listening' : ''} ${isSpeaking ? 'is-speaking' : ''} ${isTaskComplete ? 'is-complete' : ''}`}
      data-circadian={activeCircadian}
      onDragEnter={handleGlobalDragEnter}
      onDragLeave={handleGlobalDragLeave}
      onDragOver={handleGlobalDragOver}
      onDrop={handleGlobalDrop}
    >
      {/* Invisible file input for spatial triggers */}
      <input 
        type="file" 
        ref={fileInputRef}
        accept="image/*,application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={handleGlobalFileChange}
      />

      {/* Invisible audio element for strict autoplay policies */}
      <audio ref={currentAudioRef} style={{ display: 'none' }} />

      {/* Background ambient orbs & visionOS glass mesh */}
      <div className="ambient-mesh-glow m1"></div>
      <div className="ambient-mesh-glow m2"></div>
      <div className="ambient-mesh-glow m3"></div>

      {/* Top Header Navigation */}
      <header className="lumen-header">
        <div className="header-brand">
          <div className="brand-dot"></div>
          <h1 className="brand-title">LUMEN</h1>
        </div>

        <div className="header-actions">
          <button 
            type="button" 
            className={`circadian-toggle-btn phase-${activeCircadian}`}
            onClick={handleCycleCircadian}
            title={`Atmosphere: ${getCircadianInfo().label} (Click to change circadian mood)`}
            aria-label={`Circadian atmosphere: ${getCircadianInfo().label}`}
          >
            <span className="circadian-icon">{getCircadianInfo().icon}</span>
            <span className="circadian-label">{getCircadianInfo().label}</span>
          </button>

          <button 
            type="button" 
            className={`web-toggle-btn mode-${webMode}`}
            onClick={handleCycleWebMode}
            title={`Internet Access: ${webMode.toUpperCase()} (Click to toggle)`}
          >
            <span className="web-icon">🌐</span>
            <span className="web-label">Web: {webMode === 'auto' ? 'Auto' : webMode === 'always' ? 'Always' : 'Off'}</span>
          </button>

          <button 
            type="button" 
            className={`log-toggle-btn ${showLogDrawer ? 'active' : ''}`}
            onClick={() => setShowLogDrawer(!showLogDrawer)}
            title="Toggle conversation transcript"
          >
            {showLogDrawer ? '✕ Close' : '💬 Transcript'}
          </button>

          <button
            type="button"
            className={`fullscreen-btn ${isFullscreen ? 'active' : ''}`}
            onClick={handleToggleFullscreen}
            title={isFullscreen ? "Exit Full Screen" : "Go Full Screen"}
            aria-label={isFullscreen ? "Exit Full Screen" : "Go Full Screen"}
          >
            {isFullscreen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
            )}
          </button>

          <a 
            href="https://github.com/georgieslab" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="github-btn"
            title="GitHub Repository"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>

          {/* Google Account Authentication */}
          <GoogleAuthButton
            currentUser={currentUser}
            onLoginSuccess={handleUserLogin}
            onLogout={handleUserLogout}
            conversationCount={messages.length}
          />
        </div>
      </header>

      {/* Main Focus Stage */}
      <main className="lumen-main-stage">
        {/* Interactive Neural Morphing Sphere */}
        <AmbientSphere 
          isListening={isListening}
          isThinking={isThinking}
          isSpeaking={isSpeaking}
          isTaskComplete={isTaskComplete}
          isProcessingDoc={Boolean(isThinking && processingFile?.isPdf)}
          isProcessingImg={Boolean(isThinking && processingFile && !processingFile?.isPdf)}
          onToggleListen={handleToggleListen}
        />

        {/* Live speech transcription text overlay */}
        {liveTranscript && (
          <div className="live-caption-pill">
            <span className="live-caption-indicator"></span>
            <span className="live-caption-text">"{liveTranscript}"</span>
          </div>
        )}

        {/* Vision & Document Scanner Drop Zone */}
        <VisionScanner 
          selectedFile={selectedFile}
          processingFile={processingFile}
          isComplete={isTaskComplete}
          onFileSelected={(file) => setSelectedFile(file)}
          onFileCleared={() => {
            setSelectedFile(null);
            setProcessingFile(null);
          }}
          isThinking={isThinking}
          externalInputRef={fileInputRef}
        />

        {/* Conversation Feed Drawer (Toggleable) */}
        {showLogDrawer && (
          <ConversationFeed 
            messages={messages}
            liveTranscript={liveTranscript}
            isThinking={isThinking}
            onClearHistory={handleClearHistory}
          />
        )}
      </main>

      {/* Bottom Spatial Command Bar */}
      <footer className="lumen-footer">
        <form 
          className="bottom-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          {/* Spatial Media Attachment Trigger */}
          <button
            type="button"
            className="bottom-spatial-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach photo or document (PDF)"
            disabled={isThinking}
            aria-label="Attach photo or document"
          >
            <SpatialMediaIcon size={19} />
          </button>

          <input 
            type="text"
            className="bottom-text-field"
            placeholder={
              selectedFile 
                ? (selectedFile.isPdf ? "Ask Lumen about this PDF document..." : "Ask Lumen about this image...") 
                : "Speak or type your thoughts to Lumen..."
            }
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
          />
          <button 
            type="submit" 
            className="bottom-submit-btn"
            disabled={(!textInput.trim() && !selectedFile) || isThinking}
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </footer>

      {/* Full-screen Spatial Glass Drag Portal Overlay */}
      {isGlobalDragging && (
        <div className="spatial-drag-portal-overlay">
          <div className="spatial-drag-portal-card">
            <div className="portal-icon-aperture">
              <SpatialMediaIcon size={42} />
              <div className="portal-ambient-ring"></div>
            </div>
            <h3 className="portal-title">Drop to Inspect with Lumen</h3>
            <p className="portal-subtitle">Multimodal analysis for Photos, Diagrams & PDF Documents</p>
          </div>
        </div>
      )}
    </div>
  );
}

