
import React, { useState, useEffect, useRef } from 'react';
import AmbientSphere from './components/AmbientSphere';
import VisionScanner, { SpatialMediaIcon } from './components/VisionScanner';
import ConversationFeed, { LiveWeatherCard, LiveCryptoCard, LivePdfCard, LiveJobsRadarCard } from './components/ConversationFeed';
import LumenLogo from './components/LumenLogo';
import WorkspaceShareModal from './components/WorkspaceShareModal';
import WebcamLensModal from './components/WebcamLensModal';
import LumenVoiceModal, { VOICE_PERSONAS } from './components/LumenVoiceModal';
import TechStackModal from './components/TechStackModal';
import { useAudioVisualizer } from './hooks/useAudioVisualizer';
import { converseWithLumenStream, researchWithLumenStream, processFile, fetchAmbientData, exportConversationPdfDirect } from './services/api';
import { getTranslations, formatString, DEFAULT_VOICES_BY_LANG } from './utils/translations';

function getCircadianPhase() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';   // Dawn / Morning Aurora
  if (h >= 12 && h < 18)
     return 'day';       // Solar Zenith
  if (h >= 18 && h < 22) return 'evening';   // Twilight Dusk
  return 'night';                            // Midnight Nebula
}

function isResearchReportRequest(prompt) {
  const asksForResearch = /\b(research|investigate|look up|find out about)\b/i.test(prompt);
  const asksForDeliverable = /\b(pdf|report|briefing|dossier)\b/i.test(prompt);
  return asksForResearch && asksForDeliverable;
}

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const selectedImage = selectedFile; // Backward compatibility alias
  const setSelectedImage = setSelectedFile; // Backward compatibility alias
  const [processingFile, setProcessingFile] = useState(null);
  const [isTaskComplete, setIsTaskComplete] = useState(false);
  const [ambientData, setAmbientData] = useState({ weather: null, crypto: null, loading: true });
  const [activeStageWidget, setActiveStageWidget] = useState(null);
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
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);
  const [isExplorePanelOpen, setIsExplorePanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => {
    try {
      return localStorage.getItem('lumen_theme_setting') || 'visionos';
    } catch (_) {
      return 'visionos';
    }
  });
  const [activeLanguage, setActiveLanguage] = useState(() => {
    try {
      return localStorage.getItem('lumen_language_setting') || 'en-US';
    } catch (_) {
      return 'en-US';
    }
  });
  const [activeVoice, setActiveVoice] = useState(() => {
    try {
      return localStorage.getItem('lumen_voice_setting') || 'Joanna';
    } catch (_) {
      return 'Joanna';
    }
  });
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isTechStackModalOpen, setIsTechStackModalOpen] = useState(false);
  const [jobFilter, setJobFilter] = useState(() => {
    try {
      const saved = localStorage.getItem('lumen_job_filter');
      return saved ? JSON.parse(saved) : { role: 'Frontend Developer', location: 'Vienna & Remote' };
    } catch (_) {
      return { role: 'Frontend Developer', location: 'Vienna & Remote' };
    }
  });

  const handleJobFilterChange = (newFilter) => {
    setJobFilter(newFilter);
    try {
      localStorage.setItem('lumen_job_filter', JSON.stringify(newFilter));
    } catch (_) {}
    if (activeStageWidget?.widgetType === 'jobs') {
      setActiveStageWidget({
        widgetType: 'jobs',
        role: newFilter.role,
        location: newFilter.location
      });
    }
  };
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('lumen_google_user');
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });

  const t = getTranslations(activeLanguage);

  const handleCycleTheme = () => {
    const themes = ['visionos', 'cyberpunk', 'obsidian', 'solardawn', 'highcontrast'];
    const next = themes[(themes.indexOf(currentTheme) + 1) % themes.length];
    setCurrentTheme(next);
    try {
      localStorage.setItem('lumen_theme_setting', next);
    } catch (_) {}
  };

  const getThemeInfo = () => {
    const themes = {
      visionos: { icon: '🔮', label: t.header.themes.visionos },
      cyberpunk: { icon: '⚡', label: t.header.themes.cyberpunk },
      obsidian: { icon: '🌑', label: t.header.themes.obsidian },
      solardawn: { icon: '🌅', label: t.header.themes.solardawn },
      highcontrast: { icon: '👁️', label: t.header.themes.highcontrast }
    };
    return themes[currentTheme] || { icon: '🔮', label: 'VisionOS' };
  };

  const handleCycleLanguage = () => {
    const langs = ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'it-IT'];
    const next = langs[(langs.indexOf(activeLanguage) + 1) % langs.length];
    setActiveLanguage(next);
    try {
      localStorage.setItem('lumen_language_setting', next);
    } catch (_) {}

    // Auto-synchronize native neural voice to the selected language
    const autoVoice = DEFAULT_VOICES_BY_LANG[next] || 'Joanna';
    setActiveVoice(autoVoice);
    try {
      localStorage.setItem('lumen_voice_setting', autoVoice);
    } catch (_) {}

    // Dynamically update initial welcome bubble if no conversation has taken place yet
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'lumen-welcome') {
        return [{
          ...prev[0],
          text: getTranslations(next).welcome
        }];
      }
      return prev;
    });
  };

  const getLanguageInfo = () => {
    const langs = {
      'en-US': { flag: '🇺🇸', code: 'EN', label: 'English (US)' },
      'es-ES': { flag: '🇪🇸', code: 'ES', label: 'Español' },
      'fr-FR': { flag: '🇫🇷', code: 'FR', label: 'Français' },
      'de-DE': { flag: '🇩🇪', code: 'DE', label: 'Deutsch' },
      'ja-JP': { flag: '🇯🇵', code: 'JA', label: '日本語' },
      'it-IT': { flag: '🇮🇹', code: 'IT', label: 'Italiano' }
    };
    return langs[activeLanguage] || { flag: '🌐', code: 'EN', label: 'English' };
  };

  const handleImportSession = (importedMessages) => {
    if (Array.isArray(importedMessages) && importedMessages.length > 0) {
      persistMessages(importedMessages);
      setShowLogDrawer(true);
    }
  };

  // Periodically refresh local circadian phase for auto mode
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHourPhase(getCircadianPhase());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch real-time ambient data (weather & crypto) for stage widgets on launch
  useEffect(() => {
    let isMounted = true;
    let savedCity = 'Tokyo';
    try {
      savedCity = localStorage.getItem('lumen_preferred_weather_city') || 'Tokyo';
    } catch (_) {}

    fetchAmbientData(savedCity, 'bitcoin').then((res) => {
      if (isMounted && res) {
        setAmbientData({
          weather: res.weather?.success ? res.weather : null,
          crypto: res.crypto?.success ? res.crypto : null,
          loading: false
        });
      }
    }).catch((err) => console.warn('Ambient live data notice:', err));

    return () => { isMounted = false; };
  }, []);

  const handleCityChange = (newWeather) => {
    if (!newWeather) return;
    setActiveStageWidget(newWeather);
    setAmbientData(prev => ({ ...prev, weather: newWeather }));
    try {
      const cityName = newWeather.city?.split(',')[0]?.trim();
      if (cityName) {
        localStorage.setItem('lumen_preferred_weather_city', cityName);
      }
    } catch (_) {}
  };

  const handleExportConversationPdf = async () => {
    try {
      const pdf = await exportConversationPdfDirect(messages, currentUser);
      if (pdf && pdf.success) {
        setActiveStageWidget(pdf);
        const pdfMessage = {
          id: `pdf-${Date.now()}`,
          role: 'assistant',
          text: `I have compiled your conversation history into a downloadable PDF document: **${pdf.title}**.`,
          widgets: [pdf],
          timestamp: Date.now()
        };
        persistMessages([...messages, pdfMessage]);
      }
    } catch (err) {
      console.warn("Export PDF error:", err);
      alert("Could not export PDF at this moment. Please try again.");
    }
  };

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
    const labels = {
      morning: t.header.circadianPhases.morning,
      day: t.header.circadianPhases.day,
      evening: t.header.circadianPhases.evening,
      night: t.header.circadianPhases.night
    };
    const phaseLabel = labels[activeCircadian] || 'Cosmic';
    return {
      icon: icons[activeCircadian] || '✨',
      label: circadianSetting === 'auto'
        ? formatString(t.header.circadianPhases.auto, { phase: phaseLabel })
        : phaseLabel
    };
  };
  const [messages, setMessages] = useState(() => [
    {
      id: 'lumen-welcome',
      role: 'assistant',
      text: getTranslations(activeLanguage).welcome,
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
  const textInputRef = useRef(null);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    if (!isAttachmentMenuOpen && !isMobileControlsOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsAttachmentMenuOpen(false);
        closeControlMenu();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAttachmentMenuOpen, isMobileControlsOpen]);

  // Real Web Audio API Frequency Analysis & Reactive Equalizer Hook
  const { audioLevel, frequencyData } = useAudioVisualizer({
    isListening,
    isSpeaking,
    audioElementRef: currentAudioRef
  });

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
          text: getTranslations(activeLanguage).welcome,
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
      recognizer.lang = activeLanguage;

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
  }, [activeLanguage]);

  // Dispatch message to backend with Real-Time SSE Token Streaming
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

    // Initialize Assistant Streaming Message Bubble
    const assistantMsgId = `ast-${Date.now()}`;
    let accumulatedText = "";
    const accumulatedWidgets = [];
    let audioPlayed = false;

    const assistantPlaceholder = {
      id: assistantMsgId,
      role: 'assistant',
      text: '',
      webSources: [],
      webType: null,
      widgets: [],
      isStreaming: true,
      timestamp: Date.now()
    };

    setMessages([...nextMessages, assistantPlaceholder]);

    const completeResponse = (data) => {
      setIsThinking(false);
      if (data.voiceChanged) {
        setActiveVoice(data.voiceChanged);
        try {
          localStorage.setItem('lumen_voice_setting', data.voiceChanged);
        } catch (_) {}
      }
      const finalText = data.replyText || accumulatedText || "I am present and listening.";
      const finalWidgets = (Array.isArray(data.widgets) && data.widgets.length > 0) ? data.widgets : accumulatedWidgets;
      const finalSources = data.webSources || [];

      const completedMessage = {
        id: assistantMsgId,
        role: 'assistant',
        text: finalText,
        webSources: finalSources,
        webType: data.webType || (finalWidgets.length ? 'live_widget' : null),
        widgets: finalWidgets,
        isStreaming: false,
        timestamp: Date.now()
      };

      persistMessages([...nextMessages, completedMessage]);

      if (finalWidgets.length > 0 && data.webType !== 'research_report') {
        setActiveStageWidget(finalWidgets[0]);
        if (finalWidgets[0].widgetType === 'weather') {
          handleCityChange(finalWidgets[0]);
        }
      }

      setIsTaskComplete(true);
      setTimeout(() => {
        setIsTaskComplete(false);
        setProcessingFile(null);
      }, 2800);

      if (!audioPlayed && !data.audioBase64) {
        playBrowserSpeech(data.briefSummary || finalText);
      }
    };

    try {
      if (isResearchReportRequest(userPrompt) && !filePayload) {
        await researchWithLumenStream({
          transcript: userPrompt,
          history: nextMessages,
          language: activeLanguage,
          onProgress: (progress) => {
            setIsThinking(true);
            setMessages(prev => prev.map(message => message.id === assistantMsgId
              ? { ...message, taskProgress: progress }
              : message));
          },
          onDone: completeResponse
        });
      } else {
        await converseWithLumenStream({
          transcript: userPrompt,
          history: nextMessages,
          file: filePayload,
          webMode,
          language: activeLanguage,
          voiceId: activeVoice,
          onToken: (token) => {
            accumulatedText += token;
            setIsThinking(false);
            setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, text: accumulatedText } : m));
          },
          onWidget: (widget) => {
            if (widget && !accumulatedWidgets.some(w => w.widgetType === widget.widgetType && w.city === widget.city && w.symbol === widget.symbol && w.title === widget.title)) {
              accumulatedWidgets.push(widget);
              setActiveStageWidget(widget);
              setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, widgets: [...accumulatedWidgets] } : m));
            }
          },
          onAudio: (base64Audio) => {
            if (base64Audio) {
              audioPlayed = true;
              playAudioBuffer(base64Audio);
            }
          },
          onVoiceChange: (newVoiceId) => {
            if (newVoiceId) {
              setActiveVoice(newVoiceId);
              try {
                localStorage.setItem('lumen_voice_setting', newVoiceId);
              } catch (_) {}
            }
          },
          onDone: completeResponse,
          onError: (streamErr) => {
            console.warn("Stream error notification:", streamErr);
          }
        });
      }
    } catch (err) {
      console.error("Converse error:", err);
      const errorMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        isError: true,
        text: isResearchReportRequest(userPrompt)
          ? `I couldn’t complete that research task: ${err.message}. Your request is still in the conversation; please try again.`
          : "I am having trouble connecting to my neural network. Please check connection and try again.",
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
    utterance.lang = activeLanguage;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    try {
      const voices = window.speechSynthesis.getVoices();
      const isMale = ['Matthew', 'Stephen', 'Arthur', 'Gregory', 'Daniel', 'Remi', 'Sergio', 'Adriano', 'Takumi'].includes(activeVoice);
      const matched = voices.find(v => {
        const matchesLang = v.lang.startsWith(activeLanguage.slice(0, 2));
        const nameLower = v.name.toLowerCase();
        if (!matchesLang) return false;
        if (nameLower.includes(activeVoice.toLowerCase())) return true;
        if (isMale) return /male|david|george|mark|daniel/i.test(nameLower);
        return /female|zira|samantha|victoria|joanna/i.test(nameLower);
      });
      if (matched) utterance.voice = matched;
    } catch (_) {}

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
        text: getTranslations(activeLanguage).welcome,
        timestamp: Date.now()
      }];
      setMessages(reset);
      localStorage.removeItem('lumen_standalone_history');
    }
  };

  const controlMenuActions = [
    {
      icon: getCircadianInfo().icon,
      label: t.header.atmosphere,
      description: getCircadianInfo().label,
      onSelect: handleCycleCircadian
    },
    {
      icon: getThemeInfo().icon,
      label: t.header.visualTheme,
      description: getThemeInfo().label,
      onSelect: handleCycleTheme
    },
    {
      icon: getLanguageInfo().flag,
      label: getLanguageInfo().code,
      description: t.header.languageTooltip,
      onSelect: handleCycleLanguage
    },
    {
      icon: '🎙️',
      label: activeVoice,
      description: formatString(t.header.voiceTooltip, { voice: activeVoice }),
      onSelect: () => setIsVoiceModalOpen(true)
    },
    {
      icon: '🌐',
      label: t.header.webModes[webMode] || webMode,
      description: formatString(t.header.webTooltip, { mode: t.header.webModes[webMode] || webMode.toUpperCase() }),
      onSelect: handleCycleWebMode
    },
    {
      icon: '🔗',
      label: t.header.share,
      description: t.header.shareTooltip,
      onSelect: () => setIsShareModalOpen(true)
    },
    {
      icon: '⚡',
      label: t.header.techStack || 'Architecture',
      description: t.header.techStackTooltip || 'System Architecture & Tech Stack',
      onSelect: () => setIsTechStackModalOpen(true)
    },
    {
      icon: '💬',
      label: t.header.transcriptOpen.replace(/^💬\s*/, ''),
      description: t.header.transcriptTooltip,
      onSelect: () => setShowLogDrawer(prev => !prev)
    },
    {
      icon: '⛶',
      label: isFullscreen ? t.header.fullscreenExit : t.header.fullscreenEnter,
      description: isFullscreen ? t.header.fullscreenExit : t.header.fullscreenEnter,
      onSelect: handleToggleFullscreen
    },
    {
      icon: '⌘',
      label: 'GitHub',
      description: t.header.githubTooltip,
      onSelect: () => window.open('https://github.com/georgieslab', '_blank', 'noopener,noreferrer')
    }
  ];
  const exploreActions = [
    {
      icon: '🎙️',
      label: t.sphere.tapToConverse,
      description: t.explorePanel.voiceDescription,
      onSelect: handleToggleListen
    },
    {
      icon: '👁️',
      label: t.scanner.inspectTitle,
      description: t.scanner.portalSubtitle,
      onSelect: () => fileInputRef.current?.click()
    },
    {
      icon: '🔎',
      label: t.starterChips.aiBreakthroughs,
      description: t.starterChips.aiBreakthroughsTooltip,
      onSelect: () => handleSendMessage(t.starterChips.aiBreakthroughsQuery)
    },
    {
      icon: '🌤️',
      label: t.starterChips.cityWeather,
      description: t.starterChips.cityWeatherTooltip,
      onSelect: () => setActiveStageWidget({
        widgetType: 'weather',
        city: ambientData.weather?.city || 'Vienna',
        temp: ambientData.weather?.temp ?? '--',
        condition: ambientData.weather?.condition || t.glance.liveGlobalWeather,
        icon: ambientData.weather?.icon || '🌤️',
        high: ambientData.weather?.high ?? '--',
        low: ambientData.weather?.low ?? '--',
        humidity: ambientData.weather?.humidity ?? '--',
        wind: ambientData.weather?.wind ?? '--',
        forecast: ambientData.weather?.forecast || [],
        initialSearching: true
      })
    },
    {
      icon: '📄',
      label: t.starterChips.createPdf,
      description: t.starterChips.createPdfTooltip,
      onSelect: () => handleSendMessage(`${t.starterChips.pdfPromptDefault}Lumen AI`)
    }
  ];
  const selectControlMenuAction = (action) => {
    setIsMobileControlsOpen(false);
    action.onSelect();
  };

  const closeControlMenu = () => {
    setIsMobileControlsOpen(false);
    setIsExplorePanelOpen(false);
  };

  const openExplorePanel = () => {
    setIsExplorePanelOpen(true);
    setIsMobileControlsOpen(true);
  };

  return (
    <div 
      className={`lumen-app-stage ${selectedFile || processingFile ? 'has-active-doc' : ''} ${textInput.trim() ? 'has-typing' : ''} ${isThinking ? 'is-thinking' : ''} ${isListening ? 'is-listening' : ''} ${isSpeaking ? 'is-speaking' : ''} ${isTaskComplete ? 'is-complete' : ''}`}
      data-circadian={activeCircadian}
      data-theme={currentTheme}
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

      {/* Background ambient moving & dimming atmosphere light mesh */}
      <div className="ambient-mesh-glow m1"></div>
      <div className="ambient-mesh-glow m2"></div>
      <div className="ambient-mesh-glow m3"></div>
      <div className="ambient-mesh-glow m4"></div>
      <div className="ambient-mesh-glow m5"></div>

      {/* Top Header Navigation */}
      <header className="lumen-header">
        <div className="header-brand">
          <LumenLogo size={28} />
          <h1 className="brand-title">LUMEN</h1>
        </div>

        <div className="header-actions">
          {/* Circadian Atmosphere Cycle */}
          <button 
            type="button" 
            className={`circadian-toggle-btn phase-${activeCircadian}`}
            onClick={handleCycleCircadian}
            title={`${t.header.atmosphere}: ${getCircadianInfo().label}`}
            aria-label={`${t.header.atmosphere}: ${getCircadianInfo().label}`}
          >
            <span className="circadian-icon">{getCircadianInfo().icon}</span>
            <span className="circadian-label">{getCircadianInfo().label}</span>
          </button>

          {/* Visual Theme Mood System */}
          <button 
            type="button" 
            className={`theme-toggle-btn theme-${currentTheme}`}
            onClick={handleCycleTheme}
            title={`${t.header.visualTheme}: ${getThemeInfo().label}`}
            aria-label={`${t.header.visualTheme}: ${getThemeInfo().label}`}
          >
            <span className="theme-icon">{getThemeInfo().icon}</span>
            <span className="theme-label">{getThemeInfo().label}</span>
          </button>

          {/* Multilingual Voice & Intelligence Selector */}
          <button 
            type="button" 
            className="language-toggle-btn"
            onClick={handleCycleLanguage}
            title={t.header.languageTooltip}
            aria-label={t.header.languageTooltip}
          >
            <span className="lang-flag">{getLanguageInfo().flag}</span>
            <span className="lang-label">{getLanguageInfo().code}</span>
          </button>

          {/* Neural Voice Persona Selector */}
          <button 
            type="button" 
            className="voice-toggle-btn"
            onClick={() => setIsVoiceModalOpen(true)}
            title={formatString(t.header.voiceTooltip, { voice: activeVoice })}
            aria-label={`Voice: ${activeVoice}`}
          >
            <span className="voice-icon">🎙️</span>
            <span className="voice-label">{activeVoice}</span>
          </button>

          {/* Web Access Toggle */}
          <button 
            type="button" 
            className={`web-toggle-btn mode-${webMode}`}
            onClick={handleCycleWebMode}
            title={formatString(t.header.webTooltip, { mode: t.header.webModes[webMode] || webMode.toUpperCase() })}
          >
            <span className="web-icon">🌐</span>
            <span className="web-label">{t.header.webPrefix}{t.header.webModes[webMode] || webMode}</span>
          </button>

          {/* Collaboration & Share */}
          <button 
            type="button" 
            className="share-toggle-btn"
            onClick={() => setIsShareModalOpen(true)}
            title={t.header.shareTooltip}
          >
            <span className="share-icon">🔗</span>
            <span className="share-label">{t.header.share}</span>
          </button>

          {/* System Architecture & Tech Stack Blueprint */}
          <button 
            type="button" 
            className="tech-stack-toggle-btn"
            onClick={() => setIsTechStackModalOpen(true)}
            title={t.header.techStackTooltip || "System Architecture & Tech Stack (AWS Bedrock, Polly, Web Audio, Open-Meteo)"}
            aria-label="System Architecture & Tech Stack"
          >
            <span className="tech-stack-icon">⚡</span>
            <span className="tech-stack-label">{t.header.techStack || "Architecture"}</span>
          </button>

          {/* Conversation Transcript Toggle */}
          <button 
            type="button" 
            className={`log-toggle-btn ${showLogDrawer ? 'active' : ''}`}
            onClick={() => setShowLogDrawer(!showLogDrawer)}
            title={t.header.transcriptTooltip}
          >
            {showLogDrawer ? t.header.transcriptClose : t.header.transcriptOpen}
          </button>

          <button
            type="button"
            className={`fullscreen-btn ${isFullscreen ? 'active' : ''}`}
            onClick={handleToggleFullscreen}
            title={isFullscreen ? t.header.fullscreenExit : t.header.fullscreenEnter}
            aria-label={isFullscreen ? t.header.fullscreenExit : t.header.fullscreenEnter}
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
            title={t.header.githubTooltip}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
        <div className="mobile-header-actions">
          <button
            type="button"
            className="chat-panel-trigger"
            onClick={() => setShowLogDrawer((open) => !open)}
            aria-label={showLogDrawer ? t.header.transcriptClose : t.header.transcriptOpen}
            aria-expanded={showLogDrawer}
            aria-controls="conversation-panel"
            title={showLogDrawer ? t.header.transcriptClose : t.header.transcriptOpen}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-4-.98L3 21l1.98-5.5A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 1 1 21 11.5Z" />
            </svg>
          </button>
          <button
            type="button"
            className="mobile-explore-trigger"
            onClick={() => {
              if (isMobileControlsOpen && isExplorePanelOpen) {
                closeControlMenu();
              } else {
                openExplorePanel();
              }
            }}
            aria-label={t.explorePanel.title}
            aria-haspopup="dialog"
            aria-expanded={isMobileControlsOpen}
            title={t.explorePanel.title}
          >
            <span className="mobile-explore-icon" aria-hidden="true">✦</span>
            <span className="mobile-explore-label">{t.explorePanel.title}</span>
            <span className="mobile-explore-notice" aria-hidden="true"></span>
          </button>
        </div>
      </header>

      {isMobileControlsOpen && (
        <div
          className="control-menu-backdrop"
          onClick={closeControlMenu}
        >
          <section
            className="control-menu"
            role="dialog"
            aria-modal="false"
            aria-label={isExplorePanelOpen ? t.explorePanel.title : t.header.mobileControls}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="control-menu-header">
              {!isExplorePanelOpen && (
                <h2>{t.header.mobileControls}</h2>
              )}
              <button
                type="button"
                className="control-menu-close"
                onClick={closeControlMenu}
                aria-label="Close controls"
              >
                ×
              </button>
            </div>
            {isExplorePanelOpen ? (
              <div className="explore-panel-content">
                <p className="explore-panel-intro">{t.explorePanel.intro}</p>
                <div className="explore-panel-actions">
                  {exploreActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      className="control-menu-action explore-panel-action"
                      aria-label={`${action.label}: ${action.description}`}
                      onClick={() => selectControlMenuAction(action)}
                    >
                      <span className="control-menu-icon" aria-hidden="true">{action.icon}</span>
                      <span className="control-menu-copy">
                        <span className="control-menu-label">{action.label}</span>
                        <span className="control-menu-description">{action.description}</span>
                      </span>
                      <span className="explore-panel-try">{t.explorePanel.tryIt}</span>
                    </button>
                  ))}
                </div>
                <a
                  className="explore-docs-link"
                  href="https://github.com/georgieslab/lumen-ai/blob/main/README.md"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="control-menu-icon" aria-hidden="true">📘</span>
                  <span className="control-menu-copy">
                    <span className="control-menu-label">{t.explorePanel.docs}</span>
                    <span className="control-menu-description">{t.explorePanel.docsDescription}</span>
                  </span>
                  <span aria-hidden="true">↗</span>
                </a>
                <button
                  type="button"
                  className="explore-docs-link explore-settings-link"
                  onClick={() => setIsExplorePanelOpen(false)}
                >
                  <span className="control-menu-icon" aria-hidden="true">⚙️</span>
                  <span className="control-menu-copy">
                    <span className="control-menu-label">{t.header.mobileControls}</span>
                    <span className="control-menu-description">{t.header.mobileControlsTooltip}</span>
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            ) : (
              <>
                <div className="control-menu-grid">
                  {controlMenuActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      className="control-menu-action"
                      aria-label={`${action.label}: ${action.description}`}
                      title={action.description}
                      onClick={() => selectControlMenuAction(action)}
                    >
                      <span className="control-menu-icon" aria-hidden="true">{action.icon}</span>
                      <span className="control-menu-copy">
                        <span className="control-menu-label">{action.label}</span>
                        <span className="control-menu-description">{action.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* Main Focus Stage */}
      <main className={`lumen-main-stage ${showLogDrawer ? 'chat-open' : 'chat-closed'}`}>
        {/* Interactive Neural Morphing Sphere */}
        <AmbientSphere 
          isListening={isListening}
          isThinking={isThinking}
          isSpeaking={isSpeaking}
          isTaskComplete={isTaskComplete}
          isProcessingDoc={Boolean(isThinking && processingFile?.isPdf)}
          isProcessingImg={Boolean(isThinking && processingFile && !processingFile?.isPdf)}
          audioLevel={audioLevel}
          frequencyData={frequencyData}
          onToggleListen={handleToggleListen}
          activeLanguage={activeLanguage}
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
          activeLanguage={activeLanguage}
        />

        {/* Real-Time Ambient Live Bar & Interactive Glanceable Pills */}
        <div className="ambient-live-bar">
          <div className="ambient-glance-row">
            {ambientData.weather ? (
              <button
                type="button"
                className={`ambient-glance-pill weather-glance ${activeStageWidget?.widgetType === 'weather' ? 'active' : ''}`}
                onClick={() => setActiveStageWidget(activeStageWidget?.widgetType === 'weather' ? null : ambientData.weather)}
                title={t.glance.weatherTooltip}
              >
                <span className="glance-pulse"></span>
                <span className="glance-icon">{ambientData.weather.icon}</span>
                <span className="glance-title">{ambientData.weather.city?.split(',')[0]}</span>
                <span className="glance-value">{ambientData.weather.temp}°C</span>
                <span className="glance-sub">{ambientData.weather.condition}</span>
              </button>
            ) : (
              <button
                type="button"
                className="ambient-glance-pill placeholder"
                onClick={() => {
                  setActiveStageWidget({
                    widgetType: 'weather',
                    city: t.glance.searchAnyCity,
                    temp: '--',
                    condition: t.glance.liveGlobalWeather,
                    icon: '🌤️',
                    high: '--',
                    low: '--',
                    humidity: '--',
                    wind: '--',
                    forecast: [],
                    initialSearching: true
                  });
                }}
                title={t.glance.weatherSearchTooltip}
              >
                <span className="glance-pulse"></span>
                <span className="glance-icon">🌤️</span>
                <span className="glance-title">{t.glance.weatherTitle}</span>
              </button>
            )}

            {/* Career & Tech Radar Changeable Tile */}
            <button
              type="button"
              className={`ambient-glance-pill career-glance ${activeStageWidget?.widgetType === 'jobs' ? 'active' : ''}`}
              onClick={() => {
                setActiveStageWidget(activeStageWidget?.widgetType === 'jobs' ? null : {
                  widgetType: 'jobs',
                  role: jobFilter.role,
                  location: jobFilter.location
                });
              }}
              title={formatString(t.glance.jobsTooltip, { role: jobFilter.role, location: jobFilter.location })}
            >
              <span className="glance-pulse green"></span>
              <span className="glance-icon">💼</span>
              <span className="glance-title">{jobFilter.role.split(' ')[0]}</span>
              <span className="glance-sub positive">{jobFilter.location.split(',')[0]}</span>
            </button>
          </div>

          {/* Quick-action 1-tap intelligent starter chips (Option E) */}
          <div className="ambient-starter-chips">
            <button
              type="button"
              className="quick-chip research-chip"
              onClick={() => {
                setTextInput(t.starterChips.researchReportPrompt);
                textInputRef.current?.focus();
              }}
              title={t.starterChips.researchReportPrompt}
            >
              {t.starterChips.researchReport}
            </button>
            <button
              type="button"
              className="quick-chip search-city-chip"
              onClick={() => {
                setActiveStageWidget({
                  widgetType: 'weather',
                  city: ambientData.weather?.city || 'Vienna',
                  temp: ambientData.weather?.temp ?? '--',
                  condition: ambientData.weather?.condition || t.glance.liveGlobalWeather,
                  icon: ambientData.weather?.icon || '🌤️',
                  high: ambientData.weather?.high ?? '--',
                  low: ambientData.weather?.low ?? '--',
                  humidity: ambientData.weather?.humidity ?? '--',
                  wind: ambientData.weather?.wind ?? '--',
                  forecast: ambientData.weather?.forecast || [],
                  initialSearching: true
                });
              }}
              title={t.starterChips.cityWeatherTooltip}
            >
              {t.starterChips.cityWeather}
            </button>
            <button
              type="button"
              className="quick-chip pdf-chip"
              onClick={() => {
                if (messages.length > 1) {
                  handleSendMessage(t.starterChips.pdfSummaryRequest);
                } else {
                  const promptMsg = {
                    id: `prompt-${Date.now()}`,
                    role: 'assistant',
                    text: t.starterChips.pdfPromptQuestion,
                    timestamp: Date.now()
                  };
                  persistMessages([...messages, promptMsg]);
                  playBrowserSpeech(t.starterChips.pdfPromptQuestion);
                  setTextInput(t.starterChips.pdfPromptDefault);
                  setTimeout(() => {
                    if (textInputRef.current) {
                      textInputRef.current.focus();
                      const len = t.starterChips.pdfPromptDefault.length;
                      textInputRef.current.setSelectionRange(len, len);
                    }
                  }, 60);
                }
              }}
              title={t.starterChips.createPdfTooltip}
            >
              {t.starterChips.createPdf}
            </button>
            <button
              type="button"
              className="quick-chip jobs-chip"
              onClick={() => handleSendMessage(formatString(t.starterChips.jobsQuery, { role: jobFilter.role, location: jobFilter.location }))}
              title={formatString(t.starterChips.jobsChipTooltip || "Search active {role} jobs in {location}", { role: jobFilter.role, location: jobFilter.location })}
            >
              💼 {jobFilter.role.split(' ')[0]} in {jobFilter.location.split(',')[0]}
            </button>
            <button
              type="button"
              className="quick-chip ai-chip"
              onClick={() => handleSendMessage(t.starterChips.aiBreakthroughsQuery)}
              title={t.starterChips.aiBreakthroughsTooltip}
            >
              {t.starterChips.aiBreakthroughs}
            </button>
            <button
              type="button"
              className="quick-chip interview-chip"
              onClick={() => handleSendMessage(formatString(t.starterChips.mockInterviewQuery, { role: jobFilter.role }))}
              title={t.starterChips.mockInterviewTooltip}
            >
              {t.starterChips.mockInterview}
            </button>
            <button
              type="button"
              className="quick-chip spark-chip"
              onClick={() => handleSendMessage(t.starterChips.dailySparkQuery)}
              title={t.starterChips.dailySparkTooltip}
            >
              {t.starterChips.dailySpark}
            </button>
          </div>
        </div>

        {/* Active Floating VisionOS Stage Widget */}
        {activeStageWidget && (
          <div className="stage-active-widget animate-fade-in">
            <div className="stage-widget-header">
              <div className="stage-widget-title-wrap">
                <span className="stage-widget-indicator"></span>
                <span className="stage-widget-title">
                  {activeStageWidget.widgetType === 'weather' 
                    ? t.stageWidget.weatherHeader 
                    : activeStageWidget.widgetType === 'jobs'
                      ? t.stageWidget.jobsHeader
                      : activeStageWidget.widgetType === 'crypto' 
                        ? t.stageWidget.cryptoHeader 
                        : t.stageWidget.pdfHeader}
                </span>
              </div>
              <button
                type="button"
                className="stage-widget-close-btn"
                onClick={() => setActiveStageWidget(null)}
                title={t.stageWidget.dismissTooltip}
              >
                ✕
              </button>
            </div>

            <div className="stage-widget-content">
              {activeStageWidget.widgetType === 'weather' ? (
                <LiveWeatherCard 
                  data={activeStageWidget} 
                  onCityChange={handleCityChange}
                  initialSearching={Boolean(activeStageWidget.initialSearching || activeStageWidget.city === 'Search Any City' || activeStageWidget.city === t.glance.searchAnyCity)}
                  activeLanguage={activeLanguage}
                />
              ) : activeStageWidget.widgetType === 'jobs' ? (
                <LiveJobsRadarCard 
                  data={activeStageWidget}
                  onFilterChange={handleJobFilterChange}
                  activeLanguage={activeLanguage}
                  onSearchJobs={(targetRole, targetLoc) => {
                    handleSendMessage(formatString(t.jobsCard.searchJobsPrompt, { role: targetRole, location: targetLoc }));
                  }}
                  onMockInterview={(targetRole) => {
                    handleSendMessage(formatString(t.jobsCard.mockInterviewPrompt, { role: targetRole }));
                  }}
                  onGenerateDossier={(targetRole, targetLoc) => {
                    handleSendMessage(formatString(t.jobsCard.exportDossierPrompt, { role: targetRole, location: targetLoc }));
                  }}
                />
              ) : activeStageWidget.widgetType === 'crypto' ? (
                <LiveCryptoCard data={activeStageWidget} />
              ) : activeStageWidget.widgetType === 'pdf_document' ? (
                <LivePdfCard data={activeStageWidget} activeLanguage={activeLanguage} />
              ) : null}
            </div>

            <div className="stage-widget-footer">
              <button
                type="button"
                className="stage-widget-ask-btn"
                onClick={() => {
                  const q = activeStageWidget.widgetType === 'weather'
                    ? formatString(t.stageWidget.askWeatherPrompt, { city: activeStageWidget.city })
                    : activeStageWidget.widgetType === 'jobs'
                      ? formatString(t.stageWidget.askJobsPrompt, { role: jobFilter.role, location: jobFilter.location })
                      : activeStageWidget.widgetType === 'crypto'
                        ? formatString(t.stageWidget.askCryptoPrompt, { name: activeStageWidget.name, symbol: activeStageWidget.symbol })
                        : t.stageWidget.askPdfPrompt;
                  handleSendMessage(q);
                }}
              >
                {t.stageWidget.askLumenBtn}
              </button>
            </div>
          </div>
        )}

        {/* Conversation Feed Drawer (Toggleable) */}
        <div id="conversation-panel" className={`conversation-panel ${showLogDrawer ? 'open' : ''}`}>
          <ConversationFeed 
            messages={messages}
            liveTranscript={liveTranscript}
            isThinking={isThinking}
            onClearHistory={handleClearHistory}
            onExportPdf={handleExportConversationPdf}
            onSendMessage={handleSendMessage}
            activeLanguage={activeLanguage}
          />
        </div>
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
          <button
            type="button"
            className="bottom-spatial-attach-btn"
            onClick={() => setIsAttachmentMenuOpen(true)}
            title={t.footer.attachTooltip}
            disabled={isThinking}
            aria-label={t.footer.attachTooltip}
            aria-haspopup="dialog"
            aria-expanded={isAttachmentMenuOpen}
          >
            <span className="attachment-trigger-plus" aria-hidden="true">+</span>
          </button>

          <input 
            ref={textInputRef}
            type="text"
            className="bottom-text-field"
            placeholder={
              selectedFile 
                ? (selectedFile.isPdf ? t.footer.placeholderPdf : t.footer.placeholderImg) 
                : t.footer.placeholderNormal
            }
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
          />
          <button 
            type="submit" 
            className="bottom-submit-btn"
            disabled={(!textInput.trim() && !selectedFile) || isThinking}
            aria-label={t.footer.sendTooltip}
            title={t.footer.sendTooltip}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </footer>

      {isAttachmentMenuOpen && (
        <div
          className="attachment-sheet-backdrop"
          onClick={() => setIsAttachmentMenuOpen(false)}
        >
          <section
            className="attachment-sheet glass-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t.footer.attachTooltip}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="attachment-sheet-handle" aria-hidden="true"></div>
            <h2 className="attachment-sheet-title">{t.footer.attachTooltip}</h2>
            <button
              type="button"
              className="attachment-sheet-action"
              onClick={() => {
                setIsAttachmentMenuOpen(false);
                setIsWebcamOpen(true);
              }}
            >
              <span className="attachment-sheet-icon" aria-hidden="true">📷</span>
              <span>{t.footer.takePhoto}</span>
            </button>
            <button
              type="button"
              className="attachment-sheet-action"
              onClick={() => {
                setIsAttachmentMenuOpen(false);
                fileInputRef.current?.click();
              }}
            >
              <span className="attachment-sheet-icon" aria-hidden="true">▧</span>
              <span>{t.footer.chooseFile}</span>
            </button>
            <button
              type="button"
              className="attachment-sheet-cancel"
              onClick={() => setIsAttachmentMenuOpen(false)}
            >
              {t.footer.cancel}
            </button>
          </section>
        </div>
      )}

      {/* Full-screen Spatial Glass Drag Portal Overlay */}
      {isGlobalDragging && (
        <div className="spatial-drag-portal-overlay">
          <div className="spatial-drag-portal-card">
            <div className="portal-icon-aperture">
              <SpatialMediaIcon size={42} />
              <div className="portal-ambient-ring"></div>
            </div>
            <h3 className="portal-title">{t.scanner.portalTitle}</h3>
            <p className="portal-subtitle">{t.scanner.portalSubtitle}</p>
          </div>
        </div>
      )}

      {/* Collaboration & Sharing Workspace Modal */}
      <WorkspaceShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        messages={messages}
        currentUser={currentUser}
        activeLanguage={activeLanguage}
        currentTheme={currentTheme}
        onExportPdf={handleExportConversationPdf}
        onImportSession={handleImportSession}
      />

      {/* Spatial Vision Live Webcam Lens Modal */}
      <WebcamLensModal
        isOpen={isWebcamOpen}
        onClose={() => setIsWebcamOpen(false)}
        onCapture={(snapshotPayload) => {
          setSelectedFile(snapshotPayload);
          if (textInputRef.current) {
            textInputRef.current.focus();
          }
        }}
      />

      {/* Neural Voice Studio Modal */}
      <LumenVoiceModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        activeVoice={activeVoice}
        onSelectVoice={(voiceId) => {
          setActiveVoice(voiceId);
          try {
            localStorage.setItem('lumen_voice_setting', voiceId);
          } catch (_) {}
        }}
        activeLanguage={activeLanguage}
      />

      {/* System Architecture & Tech Stack Blueprint Modal */}
      <TechStackModal
        isOpen={isTechStackModalOpen}
        onClose={() => setIsTechStackModalOpen(false)}
        activeLanguage={activeLanguage}
        activeVoice={activeVoice}
      />
    </div>
  );
}
