import React, { useState, useEffect, useRef } from 'react';
import AmbientSphere from './components/AmbientSphere';
import VisionScanner from './components/VisionScanner';
import ConversationFeed from './components/ConversationFeed';
import { converseWithLumen } from './services/api';

const DEFAULT_GREETING = "I am Lumen, your ambient voice and vision AI companion. Tap the sphere or upload an image to begin.";

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [showLogDrawer, setShowLogDrawer] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'lumen-welcome',
      role: 'assistant',
      text: DEFAULT_GREETING,
      timestamp: Date.now()
    }
  ]);

  const recognitionRef = useRef(null);
  const currentAudioRef = useRef(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lumen_standalone_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (err) {
      console.warn("Could not load saved conversation:", err);
    }
  }, []);

  // Save history to localStorage
  const persistMessages = (newMsgs) => {
    setMessages(newMsgs);
    try {
      const sanitised = newMsgs.slice(-15).map(m => ({
        ...m,
        image: m.image && m.image.length > 10000 ? null : m.image
      }));
      localStorage.setItem('lumen_standalone_history', JSON.stringify(sanitised));
    } catch (err) {
      console.warn("Storage write error:", err);
    }
  };

  // Initialize Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognizer = new SpeechRecognition();
      recognizer.continuous = false;
      recognizer.interimResults = true;
      recognizer.lang = 'en-US';

      recognizer.onstart = () => {
        setIsListening(true);
        setLiveTranscript('');
      };

      recognizer.onresult = (e) => {
        let transcript = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          transcript += e.results[i][0].transcript;
        }
        setLiveTranscript(transcript);
      };

      recognizer.onerror = (e) => {
        console.warn('Speech recognition error:', e.error);
        setIsListening(false);
        setLiveTranscript('');
      };

      recognizer.onend = () => {
        setIsListening(false);
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
  const handleSendMessage = async (textToSend, imgPayload = selectedImage) => {
    const userPrompt = (textToSend || liveTranscript || textInput).trim();
    if (!userPrompt && !imgPayload) return;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      setIsSpeaking(false);
    }

    const userMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: userPrompt,
      image: imgPayload ? imgPayload.dataUrl : null,
      timestamp: Date.now()
    };

    const nextMessages = [...messages, userMessage];
    persistMessages(nextMessages);

    setLiveTranscript('');
    setTextInput('');
    setSelectedImage(null);
    setIsThinking(true);

    try {
      const data = await converseWithLumen({
        transcript: userPrompt,
        history: nextMessages,
        image: imgPayload
      });

      const assistantMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        text: data.replyText,
        timestamp: Date.now()
      };

      persistMessages([...nextMessages, assistantMessage]);

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
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

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

  // Toggle voice listening
  const handleToggleListen = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (liveTranscript.trim() || selectedImage) {
        handleSendMessage(liveTranscript, selectedImage);
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
    <div className="lumen-app-stage">
      {/* Background ambient orbs & visionOS glass mesh */}
      <div className="ambient-mesh-glow m1"></div>
      <div className="ambient-mesh-glow m2"></div>
      <div className="ambient-mesh-glow m3"></div>

      {/* Top Header Navigation */}
      <header className="lumen-header">
        <div className="header-brand">
          <div className="brand-dot"></div>
          <h1 className="brand-title">LUMEN</h1>
          <span className="brand-badge">Ambient Copilot</span>
        </div>

        <div className="header-actions">
          <button 
            type="button" 
            className={`log-toggle-btn ${showLogDrawer ? 'active' : ''}`}
            onClick={() => setShowLogDrawer(!showLogDrawer)}
            title="Toggle conversation log"
          >
            💬 {showLogDrawer ? 'Hide Log' : 'Log'}
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
        </div>
      </header>

      {/* Main Focus Stage */}
      <main className="lumen-main-stage">
        {/* Interactive Neural Morphing Sphere */}
        <AmbientSphere 
          isListening={isListening}
          isThinking={isThinking}
          isSpeaking={isSpeaking}
          onToggleListen={handleToggleListen}
        />

        {/* Live speech transcription text overlay */}
        {liveTranscript && (
          <div className="live-caption-pill">
            <span className="live-caption-indicator"></span>
            <span className="live-caption-text">"{liveTranscript}"</span>
          </div>
        )}

        {/* Vision Scanner Drop Zone */}
        <VisionScanner 
          selectedImage={selectedImage}
          onImageSelected={(img) => setSelectedImage(img)}
          onImageCleared={() => setSelectedImage(null)}
          isThinking={isThinking}
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

      {/* Bottom Quiet Input Controls */}
      <footer className="lumen-footer">
        <form 
          className="bottom-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          <input 
            type="text"
            className="bottom-text-field"
            placeholder={selectedImage ? "Ask Lumen about this image..." : "Speak or type your thoughts to Lumen..."}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
          />
          <button 
            type="submit" 
            className="bottom-submit-btn"
            disabled={(!textInput.trim() && !selectedImage) || isThinking}
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
}
