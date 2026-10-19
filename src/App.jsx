
import React, { useState, useEffect, useRef } from 'react';
import AmbientSphere from './components/AmbientSphere';
import VisionScanner, { SpatialMediaIcon } from './components/VisionScanner';
import ConversationFeed, { LiveWeatherCard, LiveCryptoCard, LivePdfCard, LiveJobsRadarCard } from './components/ConversationFeed';
import LumenLogo from './components/LumenLogo';
import AccountAuthButton from './components/AccountAuthButton';
import FeedbackModal, { getFeedbackCopy } from './components/FeedbackModal';
import UserMemoryModal from './components/UserMemoryModal';
import WorkspaceShareModal from './components/WorkspaceShareModal';
import SharedTabChip from './components/SharedTabChip';
import OpenLinkApproval from './components/OpenLinkApproval';
import EmbeddedTabPanel from './components/EmbeddedTabPanel';
import HtmlWindowPanel from './components/HtmlWindowPanel';
import OpenWebPageButton from './components/OpenWebPageButton';
import DraggableDesktopPill from './components/DraggableDesktopPill';
import AgentActionModal from './components/AgentActionModal';
import { MissionHistoryDrawer } from './components/MissionRunControls';
import DeskWorkspace, { DeskIcon } from './components/DeskWorkspace';
import DesktopCustomizeDialog from './components/DesktopCustomizeDialog';
import MobileToolsSheet from './components/MobileToolsSheet';
import ReplyModePicker from './components/ReplyModePicker';
import { normalizeResponseStyle } from '../services/responsePreferences.js';
import { DESKTOP_ITEMS, loadDesktopVisibility, saveDesktopVisibility, normalizeDesktopVisibility, clearDesktopPositions, desktopPillPosition } from './services/desktopLayout.js';
import { DESK_ACTIONS, listProjects, listNotifications, pinProjectArtifact } from './services/deskWorkspace.js';
import { conversationForProject } from './services/conversationHistory.js';
import { applyMissionSnapshot, controlMissionRun, createMissionRun, getMissionRun, isMissionActive, listMissionRuns, watchMissionRun } from './services/missionRuns.js';
import { stoppedMessage } from './components/MissionCard';
import { planLabels } from './components/PlanCard';
import { briefLabels } from './components/BriefCard';
import { isPageRequest } from '../services/replyBudget.js';
import { buildPagePrompt } from '../services/pageBrief.js';
import {
  activityFromTools,
  applyProgress,
  applyToolResult,
  applyToolStart,
  createMission,
  finishMission,
  isAbortError,
  markWriting,
  missionActivity,
  researchTopic
} from './services/mission.js';
import { splitHtmlBlocks } from './services/htmlPage';
import { extractOpenLinkRequest } from './services/openLink';
import { captureSharedTabFrame, isTabCaptureSupported } from './services/tabCapture';
import WebcamLensModal from './components/WebcamLensModal';
import LumenVoiceModal, { VOICE_PERSONAS } from './components/LumenVoiceModal';
import TechStackModal from './components/TechStackModal';
import { useAudioVisualizer } from './hooks/useAudioVisualizer';
import { converseWithLumenStream, researchWithLumenStream, planResearchWithLumen, planPageWithLumen, processFile, fetchAmbientData, exportConversationPdfDirect, getAuthSession, getUserMemory } from './services/api';
import { getTranslations, formatString, DEFAULT_VOICES_BY_LANG } from './utils/translations';
import { PRESET_AURAS, getAuraById, getNextAuraId } from './services/auras';
import { buildConversationHistory, getAutomaticStageWidget, getConversationStorageKey, isFloatingStageWidget, mergeArtifactUpdates, restoreConversationMessages, updateMessageArtifact } from './services/conversationHistory.js';


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

const INTERACTION_TONES = ['friendly', 'casual', 'professional', 'formal'];

function loadPreference(key, options, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return options.includes(saved) ? saved : fallback;
  } catch (_) {
    return fallback;
  }
}

function loadResponseStyle() {
  try {
    const saved = localStorage.getItem('lumen_response_style');
    const normalized = normalizeResponseStyle(saved);
    if (saved && saved !== normalized) {
      try { localStorage.setItem('lumen_response_style', normalized); } catch (_) {}
    }
    return normalized;
  } catch (_) {
    return 'concise';
  }
}

function loadPersonaCardOffset() {
  try {
    const saved = JSON.parse(localStorage.getItem('lumen_persona_card_position') || 'null');
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      return { x: Math.max(-2000, Math.min(2000, saved.x)), y: Math.max(-2000, Math.min(2000, saved.y)) };
    }
  } catch (_) {}
  return { x: 0, y: 0 };
}

function loadWeatherTileOffset() {
  try {
    const saved = JSON.parse(localStorage.getItem('lumen_weather_tile_position') || 'null');
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      return { x: Math.max(-2000, Math.min(2000, saved.x)), y: Math.max(-2000, Math.min(2000, saved.y)) };
    }
  } catch (_) {}
  return { x: 0, y: 0 };
}

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [decisionMissionDraft, setDecisionMissionDraft] = useState(false);
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
  const [interactionTone, setInteractionTone] = useState(() =>
    loadPreference('lumen_interaction_tone', INTERACTION_TONES, 'friendly')
  );
  const [responseStyle, setResponseStyle] = useState(loadResponseStyle);
  const [showLogDrawer, setShowLogDrawer] = useState(false);
  const [showMissions, setShowMissions] = useState(false);
  const [savedMissions, setSavedMissions] = useState([]);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [missionsError, setMissionsError] = useState('');
  const [chatWindowOffset, setChatWindowOffset] = useState(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    try {
      const isSmall = window.innerWidth <= 768;
      if (isSmall) return { x: 0, y: 0 };
      const saved = JSON.parse(localStorage.getItem('lumen_chat_window_position') || 'null');
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        return { x: Math.max(-1400, Math.min(1400, saved.x)), y: Math.max(-1000, Math.min(1000, saved.y)) };
      }
    } catch (_) {}
    return { x: 0, y: 0 };
  });
  const [isChatWindowDragging, setIsChatWindowDragging] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);
  const [isExplorePanelOpen, setIsExplorePanelOpen] = useState(false);
  const [triedExploreActionIds, setTriedExploreActionIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('lumen_explore_tried_actions') || '[]');
      return new Set(Array.isArray(saved) ? saved : []);
    } catch (_) {
      return new Set();
    }
  });
  const [canInstallApp, setCanInstallApp] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  );
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);
  const [isQuickStartVisible, setIsQuickStartVisible] = useState(() => {
    try {
      return localStorage.getItem('lumen_quick_start_dismissed') !== 'true';
    } catch (_) {
      return true;
    }
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('lumen_theme_setting');
      return (saved && saved !== 'visionos') ? saved : 'midnight-nebula';
    } catch (_) {
      return 'midnight-nebula';
    }
  });
  const [isAuraMenuOpen, setIsAuraMenuOpen] = useState(false);
  const auraMenuRef = useRef(null);
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
  const [sharedTab, setSharedTab] = useState(null);
  const [pendingOpenUrl, setPendingOpenUrl] = useState(null);
  const [openWebPageRequest, setOpenWebPageRequest] = useState(0);
  const [embeddedUrl, setEmbeddedUrl] = useState(null);
  const [htmlWindow, setHtmlWindow] = useState(null);
  const [activeAgentAction, setActiveAgentAction] = useState(null);
  const [agentActionOriginRect, setAgentActionOriginRect] = useState(null);

  const handleOpenAgentAction = (actionId, originRect = null) => {
    setAgentActionOriginRect(originRect);
    setActiveAgentAction(actionId);
  };

  // Receive a tab the user explicitly shared through the Lumen browser extension
  useEffect(() => {
    const onBridgeMessage = (event) => {
      const data = event.data;
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (!data || data.channel !== 'lumen-tab-bridge') return;
      if (data.type === 'TAB_SHARED' && data.payload && typeof data.payload.text === 'string') {
        setSharedTab({
          title: String(data.payload.title || '').slice(0, 200),
          url: String(data.payload.url || '').slice(0, 500),
          text: data.payload.text.slice(0, 20000),
          sharedAt: Date.now()
        });
      } else if (data.type === 'TAB_STOPPED') {
        setSharedTab(null);
      }
    };
    window.addEventListener('message', onBridgeMessage);
    return () => window.removeEventListener('message', onBridgeMessage);
  }, []);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [memoryNotice, setMemoryNotice] = useState('');
  const [isTechStackModalOpen, setIsTechStackModalOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
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
  const [currentUser, setCurrentUser] = useState(null);
  const [deskAction, setDeskAction] = useState(null);
  const [desktopVisibility, setDesktopVisibility] = useState(loadDesktopVisibility);
  const [showDesktopCustomize, setShowDesktopCustomize] = useState(false);
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1024px)');
    const onChange = () => { if (!query.matches) setIsMobileToolsOpen(false); };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const [desktopLayoutVersion, setDesktopLayoutVersion] = useState(0);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [projectSummaries, setProjectSummaries] = useState([]);
  const [deskNotificationCount, setDeskNotificationCount] = useState(0);
  const [personaCard, setPersonaCard] = useState(null);
  const [personaCardOffset, setPersonaCardOffset] = useState(loadPersonaCardOffset);
  const [isPersonaDragging, setIsPersonaDragging] = useState(false);
  const personaDragRef = useRef(null);
  const suppressPersonaClickRef = useRef(false);
  const [weatherTileOffset, setWeatherTileOffset] = useState(loadWeatherTileOffset);
  const [isWeatherTileDragging, setIsWeatherTileDragging] = useState(false);
  const weatherTileDragRef = useRef(null);
  const suppressWeatherTileClickRef = useRef(false);
  const [showWelcomeGreeting, setShowWelcomeGreeting] = useState(false);
  const workspaceHeaderRef = useRef(null);
  const composerFooterRef = useRef(null);
  const personaElementRef = useRef(null);
  const weatherElementRef = useRef(null);

  const t = getTranslations(activeLanguage);
  const feedbackCopy = getFeedbackCopy(activeLanguage);

  // The fixed composer grows with its mode toolbar, attachments, and typed text.
  // Reserve its actual height in the mobile transcript instead of a fixed gap.
  useEffect(() => {
    const footer = composerFooterRef.current;
    const stage = footer?.closest('.lumen-app-stage');
    if (!footer || !stage) return;
    const measure = () => stage.style.setProperty('--lumen-composer-footer-height', `${footer.offsetHeight}px`);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(footer);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      stage.style.removeProperty('--lumen-composer-footer-height');
    };
  }, []);

  // Saved drag positions must remain usable after a resize or a taller header.
  useEffect(() => {
    let frame;
    const clampFloatingCards = () => {
      const header = workspaceHeaderRef.current;
      const stage = header?.closest('.lumen-app-stage');
      if (!header || !stage) return;
      const headerRect = header.getBoundingClientRect();
      const zoomStyle = getComputedStyle(document.documentElement).zoom;
      const zoomValue = parseFloat(zoomStyle);
      const scale = zoomStyle.endsWith('%') ? zoomValue / 100 : zoomValue || 1;
      stage.style.setProperty('--workspace-header-bottom', `${(headerRect.bottom - stage.getBoundingClientRect().top) / scale}px`);
      const clamp = (element, setter, storageKey, dragging) => {
        if (!element || dragging) return;
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const minTop = headerRect.bottom + 12;
        const targetTop = Math.max(minTop, Math.min(Math.max(minTop, window.innerHeight - rect.height - 12), rect.top));
        const targetLeft = Math.max(12, Math.min(Math.max(12, window.innerWidth - rect.width - 12), rect.left));
        const dx = (targetLeft - rect.left) / scale;
        const dy = (targetTop - rect.top) / scale;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        setter(previous => {
          const next = { x: previous.x + dx, y: previous.y + dy };
          try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch (_) {}
          return next;
        });
      };
      clamp(personaElementRef.current, setPersonaCardOffset, 'lumen_persona_card_position', isPersonaDragging);
      clamp(weatherElementRef.current, setWeatherTileOffset, 'lumen_weather_tile_position', isWeatherTileDragging);
    };
    const scheduleClamp = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(clampFloatingCards); };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleClamp) : null;
    [workspaceHeaderRef.current, personaElementRef.current, weatherElementRef.current].filter(Boolean).forEach(element => observer?.observe(element));
    window.addEventListener('resize', scheduleClamp);
    scheduleClamp();
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', scheduleClamp); };
  }, [personaCard, ambientData.weather, showLogDrawer, isQuickStartVisible, isPersonaDragging, isWeatherTileDragging]);

  useEffect(() => {
    try {
      localStorage.removeItem('lumen_google_user');
    } catch (_) {}
    getAuthSession()
      .then(({ user }) => setCurrentUser(user || null))
      .catch(error => console.warn('Could not restore the signed-in account:', error.message));
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setShowWelcomeGreeting(false);
      return undefined;
    }
    setShowWelcomeGreeting(true);
    const timer = window.setTimeout(() => setShowWelcomeGreeting(false), 12000);
    return () => window.clearTimeout(timer);
  }, [currentUser?.id]);

  useEffect(() => {
    let active = true;
    if (!currentUser) {
      setPersonaCard(null);
      return () => { active = false; };
    }
    getUserMemory()
      .then(data => {
        if (active) setPersonaCard(data.personaCard || null);
      })
      .catch(error => console.warn('Could not load the saved Persona Card:', error.message));
    return () => { active = false; };
  }, [currentUser?.id]);

  const handlePersonaDragStart = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const card = event.currentTarget.closest('.persona-profile-card');
    const stage = card?.closest('.lumen-app-stage');
    if (!card || !stage) return;

    const zoomStyle = getComputedStyle(document.documentElement).zoom;
    const parsedZoom = parseFloat(zoomStyle);
    const scale = zoomStyle.endsWith('%') ? parsedZoom / 100 : parsedZoom || 1;
    personaDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cardRect: card.getBoundingClientRect(),
      stageRect: stage.getBoundingClientRect(),
      startOffset: personaCardOffset,
      nextOffset: personaCardOffset,
      scale: scale > 0 ? scale : 1,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePersonaDragMove = (event) => {
    const drag = personaDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rawX = event.clientX - drag.startX;
    const rawY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(rawX, rawY) < 5) return;
    if (!drag.moved) setIsPersonaDragging(true);
    drag.moved = true;

    const margin = 12;
    const minX = drag.stageRect.left + margin - drag.cardRect.left;
    const maxX = drag.stageRect.right - margin - drag.cardRect.right;
    const minY = Math.max(drag.stageRect.top, workspaceHeaderRef.current?.getBoundingClientRect().bottom || 0) + margin - drag.cardRect.top;
    const maxY = drag.stageRect.bottom - margin - drag.cardRect.bottom;
    const deltaX = Math.max(minX, Math.min(maxX, rawX));
    const deltaY = Math.max(minY, Math.min(maxY, rawY));
    drag.nextOffset = {
      x: drag.startOffset.x + deltaX / drag.scale,
      y: drag.startOffset.y + deltaY / drag.scale
    };
    setPersonaCardOffset(drag.nextOffset);
  };

  const handlePersonaDragEnd = (event) => {
    const drag = personaDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    personaDragRef.current = null;
    if (!drag.moved) return;

    setIsPersonaDragging(false);
    setPersonaCardOffset(drag.nextOffset);
    try {
      localStorage.setItem('lumen_persona_card_position', JSON.stringify(drag.nextOffset));
    } catch (_) {}
    suppressPersonaClickRef.current = true;
    window.setTimeout(() => { suppressPersonaClickRef.current = false; }, 0);
  };

  const handleWeatherTileDragStart = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const tile = event.currentTarget.closest('.weather-tile-wrap');
    const stage = tile?.closest('.lumen-app-stage');
    if (!tile || !stage) return;

    const zoomStyle = getComputedStyle(document.documentElement).zoom;
    const parsedZoom = parseFloat(zoomStyle);
    const scale = zoomStyle.endsWith('%') ? parsedZoom / 100 : parsedZoom || 1;
    weatherTileDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      tileRect: tile.getBoundingClientRect(),
      stageRect: stage.getBoundingClientRect(),
      startOffset: weatherTileOffset,
      nextOffset: weatherTileOffset,
      scale: scale > 0 ? scale : 1,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleWeatherTileDragMove = (event) => {
    const drag = weatherTileDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rawX = event.clientX - drag.startX;
    const rawY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(rawX, rawY) < 5) return;
    if (!drag.moved) setIsWeatherTileDragging(true);
    drag.moved = true;

    const margin = 12;
    const minX = drag.stageRect.left + margin - drag.tileRect.left;
    const maxX = drag.stageRect.right - margin - drag.tileRect.right;
    const minY = Math.max(drag.stageRect.top, workspaceHeaderRef.current?.getBoundingClientRect().bottom || 0) + margin - drag.tileRect.top;
    const maxY = drag.stageRect.bottom - margin - drag.tileRect.bottom;
    const deltaX = Math.max(minX, Math.min(maxX, rawX));
    const deltaY = Math.max(minY, Math.min(maxY, rawY));
    drag.nextOffset = {
      x: drag.startOffset.x + deltaX / drag.scale,
      y: drag.startOffset.y + deltaY / drag.scale
    };
    setWeatherTileOffset(drag.nextOffset);
  };

  const handleWeatherTileDragEnd = (event) => {
    const drag = weatherTileDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    weatherTileDragRef.current = null;
    if (!drag.moved) return;

    setIsWeatherTileDragging(false);
    setWeatherTileOffset(drag.nextOffset);
    try {
      localStorage.setItem('lumen_weather_tile_position', JSON.stringify(drag.nextOffset));
    } catch (_) {}
    suppressWeatherTileClickRef.current = true;
    window.setTimeout(() => { suppressWeatherTileClickRef.current = false; }, 0);
  };

  const currentAura = getAuraById(currentTheme);

  const handleSelectAura = (auraId) => {
    setCurrentTheme(auraId);
    try {
      localStorage.setItem('lumen_theme_setting', auraId);
    } catch (_) {}
  };

  const handleCycleAura = () => {
    const next = getNextAuraId(currentTheme);
    setCurrentTheme(next);
    try {
      localStorage.setItem('lumen_theme_setting', next);
    } catch (_) {}
  };

  const handleCycleTheme = handleCycleAura;

  const getThemeInfo = () => {
    return { icon: currentAura.icon, label: currentAura.name };
  };

  useEffect(() => {
    if (!isAuraMenuOpen) return;
    const handleClickOutside = (e) => {
      if (auraMenuRef.current && !auraMenuRef.current.contains(e.target)) {
        setIsAuraMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsAuraMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAuraMenuOpen]);

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
    updateMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'lumen-welcome') {
        return [{
          ...prev[0],
          text: getTranslations(next).welcome
        }];
      }
      return prev;
    });
  };

  const handleCycleInteractionTone = () => {
    const next = INTERACTION_TONES[(INTERACTION_TONES.indexOf(interactionTone) + 1) % INTERACTION_TONES.length];
    setInteractionTone(next);
    try {
      localStorage.setItem('lumen_interaction_tone', next);
    } catch (_) {}
  };

  const handleResponseStyleChange = value => {
    const next = normalizeResponseStyle(value);
    setResponseStyle(next);
    try {
      localStorage.setItem('lumen_response_style', next);
    } catch (_) {}
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
      persistMessages(restoreConversationMessages(importedMessages, stoppedMessage(activeLanguage)));
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
  const runInProgress = isThinking || messages.some(message => message.isStreaming);
  const scopedMessages = conversationForProject(messages, currentProjectId);
  const messagesRef = useRef(messages);
  const missionViewsRef = useRef(new Map());
  const missionAutoConnectedRef = useRef(new Set());
  const missionEpochRef = useRef(0);
  const activeDurableRef = useRef(null);
  const pendingMissionControlRef = useRef(new Map());
  // Stream callbacks and artifact edits may arrive between renders. Keep their shared state current.
  const updateMessages = (next) => {
    const updated = typeof next === 'function' ? next(messagesRef.current) : next;
    messagesRef.current = updated;
    setMessages(updated);
    return updated;
  };

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
  const installPromptRef = useRef(null);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Auto-grow chat textarea height as user types or text expands
  useEffect(() => {
    const textarea = textInputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    if (scrollHeight > 0) {
      textarea.style.height = `${Math.min(scrollHeight, 180)}px`;
    }
  }, [textInput]);

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      installPromptRef.current = event;
      setCanInstallApp(true);
    };
    const handleAppInstalled = () => {
      installPromptRef.current = null;
      setCanInstallApp(false);
      setIsAppInstalled(true);
      setShowInstallInstructions(false);
    };
    const handleDisplayModeChange = (event) => {
      setIsAppInstalled(event.matches || window.navigator.standalone === true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    displayMode.addEventListener?.('change', handleDisplayModeChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      displayMode.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

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

  const handleShareTabSnapshot = async () => {
    setIsAttachmentMenuOpen(false);
    try {
      setSelectedFile(await processFile(await captureSharedTabFrame()));
    } catch (err) {
      console.warn('Tab share cancelled or failed:', err);
    }
  };

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
    disconnectMissionViews();
    setSavedMissions([]);
    setShowMissions(false);
    setMissionsLoading(false);
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    setIsThinking(false);
    try {
      const storageKey = getConversationStorageKey(currentUser);
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          updateMessages(restoreConversationMessages(parsed, stoppedMessage(activeLanguage)));
          return;
        }
      }
      updateMessages([{
        id: 'lumen-welcome', role: 'assistant',
        text: currentUser?.givenName || currentUser?.name
          ? `Welcome back, ${currentUser.givenName || currentUser.name}. Your personal neural workspace is connected. How can I assist you today?`
          : getTranslations(activeLanguage).welcome,
        timestamp: Date.now()
      }]);
    } catch (err) {
      console.warn("Could not load saved conversation:", err);
    }
  }, [currentUser?.provider, currentUser?.id, currentUser?.email]);

  // Save history to localStorage
  const persistMessages = (newMsgs) => {
    const updated = updateMessages(newMsgs);
    try {
      const sanitised = updated.slice(-15).map(m => ({
        ...m,
        image: m.image && m.image.length > 10000 ? null : m.image
      }));
      const storageKey = getConversationStorageKey(currentUser);
      localStorage.setItem(storageKey, JSON.stringify(sanitised));
    } catch (err) {
      console.warn("Storage write error:", err);
    }
  };

  const handleArtifactUpdate = (messageId, widgetIndex, widget) => {
    persistMessages(current => updateMessageArtifact(current, messageId, widgetIndex, widget));
  };

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const key = `${getConversationStorageKey(currentUser)}_project`;
    let savedProject = null;
    try { savedProject = localStorage.getItem(key) || null; } catch (_) {}
    setCurrentProjectId(savedProject); setDeskAction(null); setProjectSummaries([]); setDeskNotificationCount(0);
    const refresh = async () => {
      const results = await Promise.allSettled([listProjects(false, { signal: controller.signal }), listNotifications({ signal: controller.signal })]);
      if (!active) return;
      if (results[0].status === 'fulfilled') {
        const projects = results[0].value.projects || [];
        setProjectSummaries(projects);
        setCurrentProjectId(previous => previous && !projects.some(project => project.id === previous) ? null : previous);
      }
      if (results[1].status === 'fulfilled') setDeskNotificationCount((results[1].value.notifications || []).filter(item => !item.readAt).length);
    };
    void refresh();
    const timer = setInterval(refresh, 30000);
    return () => { active = false; controller.abort(); clearInterval(timer); };
  }, [currentUser?.provider, currentUser?.id]);

  const selectDeskProject = id => {
    const epoch = missionEpochRef.current;
    setCurrentProjectId(id || null);
    try { localStorage.setItem(`${getConversationStorageKey(currentUser)}_project`, id || ''); } catch (_) {}
    void listProjects().then(result => { if (epoch === missionEpochRef.current) setProjectSummaries(result.projects || []); }).catch(() => {});
  };
  const openDeskAction = action => {
    setDeskAction(action); setShowMissions(false); closeControlMenu(); setIsAuraMenuOpen(false); setIsMobileToolsOpen(false);
  };
  const toggleDesktopItem = (id, visible) => setDesktopVisibility(previous => saveDesktopVisibility({ ...previous, [id]: visible }));
  const openDesktopCustomize = () => { closeControlMenu(); setIsAuraMenuOpen(false); setDeskAction(null); setShowDesktopCustomize(true); };
  const resetDesktop = () => {
    clearDesktopPositions(); setPersonaCardOffset({ x: 0, y: 0 }); setWeatherTileOffset({ x: 0, y: 0 });
    setDesktopLayoutVersion(version => version + 1);
    setDesktopVisibility(saveDesktopVisibility(normalizeDesktopVisibility(null)));
  };
  const runDeskMission = async (prompt, options) => {
    if (runAbortRef.current) throw new Error('Pause the current request before starting another mission.');
    setDeskAction(null); setShowLogDrawer(true);
    await handleSendMessage(prompt, null, options);
  };
  const pinDeskOutput = async (messageId, index) => {
    const message = messagesRef.current.find(item => item.id === messageId);
    if (!currentProjectId || !message?.serverMissionId) return;
    const widget = index === 'mission' ? null : message.widgets?.[index];
    const widgetId = index === 'mission' ? 'mission' : widget?.artifactId || widget?.id || widget?.checklistId || widget?.scheduleId || widget?.budgetId || widget?.comparisonId || widget?.briefId || widget?.reportId || widget?.fileName || `${widget?.widgetType}:${index}`;
    try {
      await pinProjectArtifact(currentProjectId, { missionId: message.serverMissionId, widgetId });
      persistMessages(current => current.map(item => item.id === messageId ? { ...item, projectPinNotice: 'Pinned to this project.' } : item));
    } catch (error) {
      persistMessages(current => current.map(item => item.id === messageId ? { ...item, projectPinNotice: error.message } : item));
    }
  };

  // A stream is only a view of a durable run. Closing it never pauses or cancels the run.
  const disconnectMissionViews = () => {
    missionEpochRef.current += 1;
    missionViewsRef.current.forEach(controller => controller.abort());
    missionViewsRef.current.clear();
    missionAutoConnectedRef.current.clear();
    pendingMissionControlRef.current.clear();
    activeDurableRef.current = null;
  };

  const receiveMissionSnapshot = (messageId, snapshot, announce = false) => {
    const previous = messagesRef.current.find(message => message.id === messageId);
    if (!previous) return;
    const updated = applyMissionSnapshot(previous, snapshot);
    if (updated === previous) return;
    persistMessages(current => current.map(message => message.id === messageId ? updated : message));
    if (snapshot.replyText || !isMissionActive(snapshot)) setIsThinking(false);
    if (snapshot.status !== 'completed' || previous.serverMission?.status === 'completed') return;
    const stageWidget = getAutomaticStageWidget(updated.widgets);
    if (stageWidget) {
      setActiveStageWidget(stageWidget);
      if (stageWidget.widgetType === 'weather') handleCityChange(stageWidget);
    }
    const writtenPage = splitHtmlBlocks(updated.text).find(segment => segment.type === 'html');
    if (writtenPage) setHtmlWindow(writtenPage.content);
    if (announce) {
      if (snapshot.voiceChanged) {
        const voiceId = typeof snapshot.voiceChanged === 'string' ? snapshot.voiceChanged : snapshot.activeVoice;
        if (voiceId) {
          setActiveVoice(voiceId);
          try { localStorage.setItem('lumen_voice_setting', voiceId); } catch (_) {}
        }
      }
      if (snapshot.memoryStatus) {
        const status = snapshot.memoryStatus;
        setMemoryNotice(status.error ? t.memoryManager.autoSaveError
          : status.saved ? formatString(t.memoryManager.autoSaved, { count: status.saved }) : '');
      }
      setIsTaskComplete(true);
      setTimeout(() => setIsTaskComplete(false), 2800);
      if (snapshot.audioBase64) playAudioBuffer(snapshot.audioBase64);
      else if (snapshot.replyText) playBrowserSpeech(snapshot.briefSummary || snapshot.replyText);
    }
  };

  const connectMissionView = async (messageId, snapshot, { announce = false, controller = new AbortController() } = {}) => {
    const epoch = missionEpochRef.current;
    const old = missionViewsRef.current.get(messageId);
    if (old && old !== controller) old.abort();
    missionViewsRef.current.set(messageId, controller);
    if (!runAbortRef.current || runAbortRef.current === old || runAbortRef.current === controller) {
      runAbortRef.current = controller;
      activeDurableRef.current = { messageId, id: snapshot.id };
    }
    const receive = next => {
      if (epoch === missionEpochRef.current && !controller.signal.aborted) receiveMissionSnapshot(messageId, next, announce);
    };
    receive(snapshot);
    try {
      if (isMissionActive(snapshot)) await watchMissionRun(snapshot.id, receive, { signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted || epoch !== missionEpochRef.current) return;
      persistMessages(current => current.map(message => message.id === messageId ? {
        ...message, isStreaming: false, missionConnectionError: error.message
      } : message));
    } finally {
      if (missionViewsRef.current.get(messageId) === controller) missionViewsRef.current.delete(messageId);
      if (runAbortRef.current === controller) {
        runAbortRef.current = null;
        activeDurableRef.current = null;
        setIsThinking(false);
      }
    }
  };

  const startDurableMission = async (messageId, payload, announce = true) => {
    const controller = new AbortController();
    const epoch = missionEpochRef.current;
    runAbortRef.current = controller;
    activeDurableRef.current = { messageId, id: null };
    try {
      let snapshot = await createMissionRun(payload, { signal: controller.signal });
      if (controller.signal.aborted || epoch !== missionEpochRef.current) return;
      const pendingAction = pendingMissionControlRef.current.get(messageId);
      if (pendingAction) {
        pendingMissionControlRef.current.delete(messageId);
        snapshot = await controlMissionRun(snapshot.id, pendingAction, { signal: controller.signal });
      }
      missionAutoConnectedRef.current.add(messageId);
      await connectMissionView(messageId, snapshot, { controller, announce });
    } catch (error) {
      if (epoch !== missionEpochRef.current) return;
      persistMessages(current => current.map(message => message.id === messageId ? {
        ...message, isStreaming: false,
        missionConnectionError: `Could not confirm the saved mission: ${error.message}. Recover uses the same request ID to avoid repeating your work.`
      } : message));
    } finally {
      if (runAbortRef.current === controller) {
        runAbortRef.current = null;
        activeDurableRef.current = null;
        setIsThinking(false);
      }
    }
  };

  const handleMissionAction = async (messageId, action) => {
    const message = messagesRef.current.find(entry => entry.id === messageId);
    if (!message || message.missionActionPending) return;
    if (action === 'resume' && runAbortRef.current && activeDurableRef.current?.messageId !== messageId) {
      persistMessages(current => current.map(entry => entry.id === messageId ? { ...entry, missionActionError: 'Pause the current request before resuming this mission.' } : entry));
      return;
    }
    const epoch = missionEpochRef.current;
    persistMessages(current => current.map(entry => entry.id === messageId ? { ...entry, missionActionPending: true, missionActionError: null } : entry));
    try {
      if (!message.serverMissionId && message.missionRequest) {
        if (action === 'pause' || action === 'cancel') {
          pendingMissionControlRef.current.set(messageId, action);
          if (!runAbortRef.current) void startDurableMission(messageId, message.missionRequest, false);
        } else if (!runAbortRef.current) {
          void startDurableMission(messageId, message.missionRequest, false);
        }
        return;
      }
      const snapshot = action === 'reconnect'
        ? await getMissionRun(message.serverMissionId)
        : await controlMissionRun(message.serverMissionId, action);
      if (epoch !== missionEpochRef.current) return;
      receiveMissionSnapshot(messageId, snapshot);
      if (!isMissionActive(snapshot)) {
        missionViewsRef.current.get(messageId)?.abort();
      } else if (!missionViewsRef.current.has(messageId) || action === 'resume') {
        // Do not hold the action button pending for the lifetime of the stream.
        void connectMissionView(messageId, snapshot);
      }
    } catch (error) {
      if (epoch !== missionEpochRef.current) return;
      persistMessages(current => current.map(entry => entry.id === messageId ? { ...entry, missionActionError: error.message } : entry));
    } finally {
      if (epoch === missionEpochRef.current) persistMessages(current => current.map(entry => entry.id === messageId ? { ...entry, missionActionPending: false } : entry));
    }
  };

  useEffect(() => {
    messages.forEach(message => {
      if (!message.serverMissionId || missionAutoConnectedRef.current.has(message.id)) return;
      missionAutoConnectedRef.current.add(message.id);
      void handleMissionAction(message.id, 'reconnect');
    });
  }, [messages]);

  useEffect(() => () => {
    missionEpochRef.current += 1;
    missionViewsRef.current.forEach(controller => controller.abort());
  }, []);

  const refreshSavedMissions = async () => {
    const epoch = missionEpochRef.current;
    setMissionsLoading(true);
    setMissionsError('');
    try {
      const missions = await listMissionRuns();
      if (epoch === missionEpochRef.current) setSavedMissions(missions);
    } catch (error) {
      if (epoch === missionEpochRef.current) setMissionsError(error.message);
    } finally {
      if (epoch === missionEpochRef.current) setMissionsLoading(false);
    }
  };

  const openSavedMission = snapshot => {
    if (Object.hasOwn(snapshot, 'projectId')) selectDeskProject(snapshot.projectId || null);
    const existing = messagesRef.current.find(message => message.serverMissionId === snapshot.id);
    const messageId = existing?.id || `saved-mission-${snapshot.id}`;
    if (!existing) {
      const prompt = snapshot.transcript || snapshot.title;
      const reopened = applyMissionSnapshot({ id: messageId, role: 'assistant', timestamp: snapshot.createdAt || Date.now(), projectId: snapshot.projectId || null }, snapshot);
      persistMessages(current => [...current,
        ...(prompt ? [{ id: `saved-prompt-${snapshot.id}`, role: 'user', text: prompt, projectId: snapshot.projectId || null, timestamp: snapshot.createdAt || Date.now() }] : []),
        reopened
      ]);
    } else {
      persistMessages(current => [...current.filter(message => message.id !== messageId), existing]);
    }
    setShowMissions(false);
    setShowLogDrawer(true);
    missionAutoConnectedRef.current.add(messageId);
    void handleMissionAction(messageId, 'reconnect');
  };

  const handleUserLogout = () => {
    disconnectMissionViews();
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    setIsThinking(false);
    setProcessingFile(null);
    setCurrentUser(null);
    setMemoryNotice('');
    try {
      localStorage.removeItem('lumen_google_user');
      const saved = localStorage.getItem('lumen_standalone_history');
      if (saved) {
        updateMessages(restoreConversationMessages(JSON.parse(saved), stoppedMessage(activeLanguage)));
      } else {
        updateMessages([{
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
  const runAbortRef = useRef(null);

  // Stop whatever Lumen is currently working on (the Stop button and Escape both land here).
  const handleStopRun = () => {
    if (activeDurableRef.current) {
      void handleMissionAction(activeDurableRef.current.messageId, 'pause');
      return;
    }
    runAbortRef.current?.abort();
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && runAbortRef.current) {
        if (activeDurableRef.current) void handleMissionAction(activeDurableRef.current.messageId, 'pause');
        else runAbortRef.current.abort();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
  const handleSendMessage = async (textToSend, filePayload = selectedFile, options = {}) => {
    if (runAbortRef.current) return;
    // Set when the user approved a research plan or a page brief: the question is already in the conversation.
    const approvedPlan = options.plan || null;
    const approvedBrief = options.brief || null;
    const resumed = Boolean(options.baseMessages);
    const selectedProjectId = options.projectId === undefined ? currentProjectId : options.projectId;
    const requestedDecisionMission = Boolean(options.decisionMission || (!resumed && !textToSend && decisionMissionDraft));
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
      projectId: selectedProjectId || null,
      displayTitle: options.actionKind === 'day' ? `Plan my day · ${options.actionData.date}` : options.actionKind === 'decision' ? options.actionData.question : options.actionKind === 'verify' ? options.actionData.content : null,
      text: userPrompt,
      image: filePayload && !filePayload.isPdf ? filePayload.dataUrl : null,
      fileName: filePayload?.name,
      isPdf: Boolean(filePayload?.isPdf),
      timestamp: Date.now()
    };

    if (!resumed) setPendingOpenUrl(extractOpenLinkRequest(userPrompt));
    const nextMessages = resumed ? options.baseMessages : [...messages, userMessage];
    const scopedHistory = conversationForProject(nextMessages, selectedProjectId);
    persistMessages(nextMessages);

    if (!resumed) {
      setLiveTranscript('');
      setTextInput('');
      setDecisionMissionDraft(false);
      if (filePayload) {
        setProcessingFile(filePayload);
      }
      setSelectedFile(null);
    }
    setIsThinking(true);
    setIsTaskComplete(false);

    // A research request first becomes a plan the user reviews; nothing is searched until they approve it.
    if (!options.actionKind && !resumed && (requestedDecisionMission || isResearchReportRequest(userPrompt)) && !filePayload) {
      const planController = new AbortController();
      runAbortRef.current = planController;
      try {
        const plan = await planResearchWithLumen({ transcript: userPrompt, language: activeLanguage, signal: planController.signal });
        if (runAbortRef.current !== planController || planController.signal.aborted) return;
        persistMessages(current => [...current, {
          id: `plan-${Date.now()}`,
          role: 'assistant',
          text: '',
          planCard: { prompt: userPrompt, plan },
          projectId: selectedProjectId || null,
          timestamp: Date.now()
        }]);
      } catch (err) {
        if (!isAbortError(err)) console.warn('Could not prepare a research plan:', err);
      } finally {
        if (runAbortRef.current === planController) {
          runAbortRef.current = null;
          setIsThinking(false);
        }
      }
      return;
    }

    // A request to build a page first becomes a design brief the user reviews, unless they are changing a page
    // Lumen just wrote. Nothing is written until they approve it.
    const editingPage = scopedHistory.slice(-3).some((message) => message.role === 'assistant' && /```html/i.test(message.text || ''));
    if (!options.actionKind && !resumed && !filePayload && !editingPage && isPageRequest(userPrompt)) {
      const briefController = new AbortController();
      runAbortRef.current = briefController;
      try {
        const brief = await planPageWithLumen({ transcript: userPrompt, language: activeLanguage, signal: briefController.signal });
        if (runAbortRef.current !== briefController || briefController.signal.aborted) return;
        persistMessages(current => [...current, {
          id: `brief-${Date.now()}`,
          role: 'assistant',
          text: '',
          briefCard: { prompt: userPrompt, brief },
          projectId: selectedProjectId || null,
          timestamp: Date.now()
        }]);
      } catch (err) {
        if (!isAbortError(err)) console.warn('Could not prepare a design brief:', err);
      } finally {
        if (runAbortRef.current === briefController) {
          runAbortRef.current = null;
          setIsThinking(false);
        }
      }
      return;
    }

    // Text-only requests run on the server and survive browser disconnects.
    if (!filePayload && !approvedPlan) {
      const messageId = `ast-${crypto.randomUUID()}`;
      const payload = {
        requestId: crypto.randomUUID(),
        transcript: approvedBrief ? buildPagePrompt(userPrompt, approvedBrief) : userPrompt,
        history: buildConversationHistory(scopedHistory), webMode: ['decision', 'verify'].includes(options.actionKind) ? 'always' : webMode, language: activeLanguage, voiceId: activeVoice,
        projectId: selectedProjectId || null, actionKind: options.actionKind || null, actionData: options.actionData || null,
        tone: interactionTone, responseStyle, pageContext: sharedTab,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      // Persist the exact request before sending. Recovery reuses this ID and input.
      persistMessages(current => [...current, {
        id: messageId, role: 'assistant', text: '', widgets: [], isStreaming: true, projectId: selectedProjectId || null,
        missionRequest: payload, timestamp: Date.now()
      }]);
      await startDurableMission(messageId, payload);
      return;
    }

    // Initialize Assistant Streaming Message Bubble
    const assistantMsgId = `ast-${Date.now()}`;
    let accumulatedText = "";
    const accumulatedWidgets = [];
    let audioPlayed = false;

    const isResearchRun = Boolean(approvedPlan) || ((requestedDecisionMission || isResearchReportRequest(userPrompt)) && !filePayload);
    const controller = new AbortController();
    runAbortRef.current = controller;
    const startedAt = Date.now();
    let mission = isResearchRun
      ? createMission({ kind: 'research', title: researchTopic(userPrompt), now: startedAt })
      : approvedBrief
        ? createMission({ kind: 'page', title: approvedBrief.title, now: startedAt })
        : null;
    let runFinished = false;

    const assistantPlaceholder = {
      id: assistantMsgId,
      role: 'assistant',
      text: '',
      webSources: [],
      webType: null,
      widgets: [],
      isStreaming: true,
      mission,
      projectId: selectedProjectId || null,
      timestamp: Date.now()
    };

    updateMessages([...nextMessages, assistantPlaceholder]);

    const persistRunMessage = (message) => {
      persistMessages(current => current.map(entry => entry.id === assistantMsgId ? { ...message, projectId: selectedProjectId || null } : entry));
    };
    const currentRunWidgets = () => messagesRef.current.find(entry => entry.id === assistantMsgId)?.widgets || [];

    const updateMission = (next) => {
      if (next === mission) return;
      mission = next;
      updateMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, mission: next } : m));
    };

    // The user pressed Stop (or Escape): keep what has streamed so far and record that the run was stopped.
    const finishStopped = () => {
      if (runFinished || runAbortRef.current !== controller) return;
      runFinished = true;
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (currentAudioRef.current) currentAudioRef.current.pause();
      setIsSpeaking(false);
      const stopped = finishMission(mission || createMission({ kind: 'chat', now: startedAt }), { status: 'stopped' });
      persistRunMessage({
        id: assistantMsgId,
        role: 'assistant',
        text: accumulatedText || stoppedMessage(activeLanguage),
        webSources: [],
        webType: accumulatedWidgets.length ? 'live_widget' : null,
        widgets: mergeArtifactUpdates(accumulatedWidgets, currentRunWidgets()),
        isStreaming: false,
        isStopped: true,
        activity: missionActivity(stopped),
        timestamp: Date.now()
      });
      setIsThinking(false);
      setIsTaskComplete(false);
      setProcessingFile(null);
    };

    const completeResponse = (data) => {
      if (runFinished || runAbortRef.current !== controller) return;
      runFinished = true;
      setIsThinking(false);
      if (data.voiceChanged) {
        setActiveVoice(data.voiceChanged);
        try {
          localStorage.setItem('lumen_voice_setting', data.voiceChanged);
        } catch (_) {}
      }
      const finalText = data.replyText || accumulatedText || "I am present and listening.";
      const finalWidgets = mergeArtifactUpdates(
        (Array.isArray(data.widgets) && data.widgets.length > 0) ? data.widgets : accumulatedWidgets,
        currentRunWidgets()
      );
      const finalSources = data.webSources || [];

      const completedMessage = {
        id: assistantMsgId,
        role: 'assistant',
        text: finalText,
        webSources: finalSources,
        webType: data.webType || (finalWidgets.length ? 'live_widget' : null),
        widgets: finalWidgets,
        isStreaming: false,
        activity: mission
          ? missionActivity(finishMission(mission, { status: 'done' }))
          : activityFromTools(data.toolsUsed, Date.now() - startedAt),
        timestamp: Date.now()
      };

      persistRunMessage(completedMessage);
      const writtenPage = splitHtmlBlocks(finalText).find((seg) => seg.type === 'html');
      if (writtenPage) setHtmlWindow(writtenPage.content);

      const stageWidget = getAutomaticStageWidget(finalWidgets);
      if (stageWidget && data.webType !== 'research_report') {
        setActiveStageWidget(stageWidget);
        if (stageWidget.widgetType === 'weather') {
          handleCityChange(stageWidget);
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
      if (isResearchRun) {
        await researchWithLumenStream({
          signal: controller.signal,
          plan: approvedPlan,
          transcript: userPrompt,
          history: scopedHistory,
          language: activeLanguage,
          tone: interactionTone,
          responseStyle,
          onMemoryStatus: (status) => setMemoryNotice(status.error
            ? t.memoryManager.autoSaveError
            : status.saved
              ? formatString(t.memoryManager.autoSaved, { count: status.saved })
              : ''),
          onProgress: (progress) => {
            setIsThinking(true);
            mission = applyProgress(mission, progress);
            updateMessages(prev => prev.map(message => message.id === assistantMsgId
              ? { ...message, taskProgress: progress, mission }
              : message));
          },
          onDone: completeResponse
        });
      } else {
        await converseWithLumenStream({
          signal: controller.signal,
          transcript: approvedBrief ? buildPagePrompt(userPrompt, approvedBrief) : userPrompt,
          history: scopedHistory,
          file: filePayload,
          webMode,
          language: activeLanguage,
          voiceId: activeVoice,
          tone: interactionTone,
          responseStyle,
          pageContext: sharedTab,
          onMemoryStatus: (status) => setMemoryNotice(status.error
            ? t.memoryManager.autoSaveError
            : status.saved
              ? formatString(t.memoryManager.autoSaved, { count: status.saved })
              : ''),
          onToolStart: (event) => updateMission(applyToolStart(mission, event)),
          onToolResult: (event) => updateMission(applyToolResult(mission, event)),
          onAbort: finishStopped,
          onToken: (token) => {
            accumulatedText += token;
            updateMission(markWriting(mission));
            setIsThinking(false);
            updateMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, text: accumulatedText } : m));
          },
          onWidget: (widget) => {
            if (widget && !accumulatedWidgets.some(w => w.widgetType === widget.widgetType && w.city === widget.city && w.symbol === widget.symbol && w.title === widget.title)) {
              accumulatedWidgets.push(widget);
              if (getAutomaticStageWidget([widget])) setActiveStageWidget(widget);
              updateMessages(prev => prev.map(m => m.id === assistantMsgId
                ? { ...m, widgets: mergeArtifactUpdates([...accumulatedWidgets], m.widgets) } : m));
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
      if (isAbortError(err) || controller.signal.aborted) {
        finishStopped();
        return;
      }
      if (runAbortRef.current !== controller) return;
      console.error("Converse error:", err);
      runFinished = true;
      const failedMission = mission
        ? finishMission(mission, { status: 'failed' })
        : null;
      const errorMessage = {
        id: assistantMsgId,
        role: 'assistant',
        isError: true,
        webSources: Array.isArray(err.webSources) ? err.webSources : [],
        activity: failedMission ? missionActivity(failedMission) : null,
        widgets: mergeArtifactUpdates(accumulatedWidgets, currentRunWidgets()),
        isStreaming: false,
        text: (accumulatedText ? `${accumulatedText}\n\n` : '') + (isResearchRun
          ? `I couldn’t complete that research task${err.stage ? ` during ${err.stage}` : ''}: ${err.message}. Any sources collected so far are listed below. Your request is still in the conversation; please try again.`
          : `I couldn’t complete that request: ${err.message}. You can try again. Any partial output above has been kept.`),
        timestamp: Date.now()
      };
      persistRunMessage(errorMessage);
      setIsTaskComplete(false);
      setProcessingFile(null);
    } finally {
      if (runAbortRef.current === controller) {
        runAbortRef.current = null;
        setIsThinking(false);
      }
    }
  };

  // The user approved (possibly edited) the plan: drop the plan card and run the research.
  const handleStartPlan = (messageId, plan) => {
    if (runAbortRef.current) return;
    const index = messages.findIndex((message) => message.id === messageId);
    const card = index >= 0 ? messages[index].planCard : null;
    if (!card) return;
    const baseMessages = messages.slice(0, index);
    persistMessages(baseMessages);
    handleSendMessage(card.prompt, null, { plan, baseMessages, projectId: messages[index].projectId || null });
  };

  // The user approved (or skipped) the design brief: drop the brief card and build the page.
  const handleStartBrief = (messageId, brief) => {
    if (runAbortRef.current) return;
    const index = messages.findIndex((message) => message.id === messageId);
    const card = index >= 0 ? messages[index].briefCard : null;
    if (!card) return;
    const baseMessages = messages.slice(0, index);
    persistMessages(baseMessages);
    handleSendMessage(card.prompt, null, { brief: brief || null, baseMessages, projectId: messages[index].projectId || null });
  };

  const handleCancelBrief = (messageId) => {
    persistMessages(messages.map((message) => (message.id === messageId
      ? { id: message.id, projectId: message.projectId || null, role: 'assistant', text: briefLabels(activeLanguage).cancelledText, isNotice: true, timestamp: Date.now() }
      : message)));
  };

  const handleCancelPlan = (messageId) => {
    persistMessages(messages.map((message) => (message.id === messageId
      ? { id: message.id, projectId: message.projectId || null, role: 'assistant', text: planLabels(activeLanguage).cancelledText, isNotice: true, timestamp: Date.now() }
      : message)));
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

  useEffect(() => {
    const handleSpacebar = (event) => {
      if (event.code !== 'Space' || event.repeat || event.defaultPrevented) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('input, textarea, select, button, a, [role="button"], [role="textbox"], [contenteditable]')) return;
      if (document.querySelector('[aria-modal="true"]')) return;

      event.preventDefault();
      handleToggleListen();
    };

    window.addEventListener('keydown', handleSpacebar);
    return () => window.removeEventListener('keydown', handleSpacebar);
  }, [handleToggleListen]);

  const handleClearHistory = () => {
    if (confirm("Clear this conversation? Saved missions remain available in Missions and continue running.")) {
      disconnectMissionViews();
      runAbortRef.current?.abort();
      runAbortRef.current = null;
      setIsThinking(false);
      setProcessingFile(null);
      const otherProjects = messagesRef.current.filter(message => !conversationForProject([message], currentProjectId).length);
      const reset = [...otherProjects, {
        id: 'lumen-welcome',
        role: 'assistant',
        projectId: currentProjectId || null,
        text: getTranslations(activeLanguage).welcome,
        timestamp: Date.now()
      }];
      persistMessages(reset);
    }
  };

  const controlMenuActions = [
    { icon: '◫', label: 'Customize desktop', description: 'Show, hide, and arrange your action pills', onSelect: openDesktopCustomize },
    {
      icon: getLanguageInfo().flag,
      label: `Language · ${getLanguageInfo().code}`,
      description: t.header.languageTooltip,
      onSelect: handleCycleLanguage,
      keepOpen: true
    },
    {
      icon: '🗣️',
      label: t.personalization.tone,
      description: `${t.personalization.tones[interactionTone]} · ${t.personalization.toneHint}`,
      onSelect: handleCycleInteractionTone,
      keepOpen: true
    },
    {
      icon: '🎙️',
      label: activeVoice,
      description: formatString(t.header.voiceTooltip, { voice: activeVoice }),
      onSelect: () => setIsVoiceModalOpen(true),
      keepOpen: true
    },
    {
      icon: '🌐',
      label: t.header.webModes[webMode] || webMode,
      description: formatString(t.header.webTooltip, { mode: t.header.webModes[webMode] || webMode.toUpperCase() }),
      onSelect: handleCycleWebMode,
      keepOpen: true
    },
    {
      icon: '🔗',
      label: t.header.share,
      description: t.header.shareTooltip,
      onSelect: () => setIsShareModalOpen(true)
    },
    {
      icon: currentAura.icon,
      label: `Aura · ${currentAura.name}`,
      description: 'Choose your workspace lighting and color palette',
      onSelect: () => setIsAuraMenuOpen(true)
    },
    {
      icon: getCircadianInfo().icon,
      label: t.header.atmosphere,
      description: getCircadianInfo().label,
      onSelect: handleCycleCircadian,
      keepOpen: true
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
      icon: '💡',
      label: feedbackCopy.action,
      description: feedbackCopy.description,
      onSelect: () => setIsFeedbackOpen(true)
    },
    {
      icon: '⌘',
      label: 'GitHub',
      description: t.header.githubTooltip,
      onSelect: () => window.open('https://github.com/georgieslab', '_blank', 'noopener,noreferrer')
    }
  ];
  const prepareDecisionMission = () => {
    setDecisionMissionDraft(true);
    setTextInput(t.starterChips.decisionMissionPrompt);
    textInputRef.current?.focus();
  };

  const legacyDesktopActions = [
    { id: 'code-analysis', icon: '</>', label: t.desktopPills.codeAnalysis, description: t.desktopPills.codeAnalysisTooltip },
    { id: 'seo-analysis', icon: '⌕', label: t.starterChips.seoInspect, description: t.starterChips.seoInspectTooltip },
    { id: 'daily-brief', icon: '☀', label: t.desktopPills.dailyBrief, description: t.desktopPills.dailyBriefTooltip },
    { id: 'budget-planner', icon: '€', label: t.desktopPills?.budgetPlanner || 'Budget planner', description: t.desktopPills?.budgetPlannerTooltip || 'Plan expenses and budgets' },
    { id: 'day-schedule', icon: '▦', label: t.desktopPills?.daySchedule || 'Day schedule', description: t.desktopPills?.dayScheduleTooltip || 'Create a timeline with calendar export' },
    { id: 'open-web-page', icon: '↗', label: t.header.openWebPageLabel, description: t.header.openWebPageDescription }
  ].map(action => ({ ...action, onSelect: rect => handleOpenAgentAction(action.id, rect?.width !== undefined ? rect : { x: window.innerWidth / 2, y: window.innerHeight / 2, width: 0, height: 0 }) }));
  const desktopActions = [...DESK_ACTIONS.map(action => ({ ...action, label: action.title, icon: <DeskIcon name={action.icon} />, onSelect: () => openDeskAction(action.id) })), ...legacyDesktopActions]
    .map((action, index) => ({ ...action, position: desktopPillPosition(index, index < 5 ? 5 : 11) }));
  const visibleDesktopActions = desktopActions.filter(action => desktopVisibility[action.id]);
  const mobileUtilityActions = [
    { id: 'weather', icon: '☀', label: 'Live weather', description: 'Weather for any city', onSelect: () => setActiveStageWidget(ambientData.weather || { widgetType: 'weather', city: 'Choose a city', initialSearching: true }) },
    { id: 'persona', icon: '✦', label: 'Persona & memory', description: 'Your saved context', onSelect: () => setIsMemoryModalOpen(true) }
  ];
  const exploreActions = [
    ...DESK_ACTIONS.map(action => ({ id: `desk-${action.id}`, icon: '✦', label: action.title, description: action.description, onSelect: () => openDeskAction(action.id) })),
    ...legacyDesktopActions,
    {
      id: 'voice',
      icon: '🎙️',
      label: t.sphere.tapToConverse,
      description: t.explorePanel.voiceDescription,
      onSelect: handleToggleListen
    },
    {
      id: 'inspect',
      icon: '👁️',
      label: t.scanner.inspectTitle,
      description: t.scanner.portalSubtitle,
      onSelect: () => fileInputRef.current?.click()
    },
    {
      id: 'research',
      icon: '🔎',
      label: t.starterChips.aiBreakthroughs,
      description: t.starterChips.aiBreakthroughsTooltip,
      onSelect: () => handleSendMessage(t.starterChips.aiBreakthroughsQuery)
    },
    {
      id: 'decision-mission',
      icon: '🧭',
      label: t.starterChips.decisionMission,
      description: t.starterChips.decisionMissionTooltip,
      onSelect: prepareDecisionMission
    },
    {
      id: 'weather',
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
      id: 'pdf',
      icon: '📄',
      label: t.starterChips.createPdf,
      description: t.starterChips.createPdfTooltip,
      onSelect: () => handleSendMessage(`${t.starterChips.pdfPromptDefault}Lumen AI`)
    }
  ];
  const selectControlMenuAction = (action) => {
    if (!action.keepOpen) setIsMobileControlsOpen(false);
    action.onSelect();
  };

  const selectExploreAction = (action) => {
    const nextTriedActions = new Set(triedExploreActionIds).add(action.id);
    setTriedExploreActionIds(nextTriedActions);
    try {
      localStorage.setItem('lumen_explore_tried_actions', JSON.stringify([...nextTriedActions]));
    } catch (_) {}
    selectControlMenuAction(action);
  };

  const closeControlMenu = () => {
    setIsMobileControlsOpen(false);
    setIsExplorePanelOpen(false);
  };

  const openExplorePanel = () => {
    setIsExplorePanelOpen(true);
    setIsMobileControlsOpen(true);
  };

  const navigationActions = [
    {
      id: 'explore',
      icon: '✦',
      label: t.explorePanel.title,
      description: t.explorePanel.intro,
      onSelect: openExplorePanel
    },
    {
      id: 'open-web-page',
      icon: '🌐',
      label: t.header.openWebPageLabel,
      description: t.header.openWebPageDescription,
      onSelect: () => {
        setIsMobileControlsOpen(false);
        setOpenWebPageRequest((request) => request + 1);
      }
    },
    {
      id: 'memory',
      icon: currentUser ? '🧠' : '🔐',
      label: currentUser ? t.memoryManager.launcher : t.memoryManager.signInTitle,
      description: currentUser ? t.memoryManager.launcherHint : t.memoryManager.signInHint,
      onSelect: () => {
        setIsMobileControlsOpen(false);
        setIsMemoryModalOpen(true);
      }
    }
  ];

  const dismissQuickStart = () => {
    setIsQuickStartVisible(false);
    try {
      localStorage.setItem('lumen_quick_start_dismissed', 'true');
    } catch (_) {}
  };

  const handleQuickStartAction = (onSelect) => {
    dismissQuickStart();
    onSelect();
  };

  const handleInstallApp = async () => {
    const installPrompt = installPromptRef.current;
    if (installPrompt) {
      setShowInstallInstructions(false);
      try {
        await installPrompt.prompt();
        await installPrompt.userChoice;
        installPromptRef.current = null;
        setCanInstallApp(false);
      } catch (err) {
        console.warn('Could not open the app install prompt:', err);
        setShowInstallInstructions(true);
      }
      return;
    }

    setShowInstallInstructions((visible) => !visible);
  };

  const isIosDevice = /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const greetingName = String(currentUser?.givenName || currentUser?.name || '').trim().split(/\s+/)[0];
  const prepareDesktopPillPrompt = (prompt) => {
    setTextInput(prompt);
    setTimeout(() => {
      const input = textInputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }, 0);
  };

  return (
    <div 
      className={`lumen-app-stage ${selectedFile || processingFile ? 'has-active-doc' : ''} ${textInput.trim() ? 'has-typing' : ''} ${isThinking ? 'is-thinking' : ''} ${isListening ? 'is-listening' : ''} ${isSpeaking ? 'is-speaking' : ''} ${isTaskComplete ? 'is-complete' : ''}`}
      data-circadian={activeCircadian}
      data-theme={currentTheme}
      data-aura={currentTheme}
      style={{
        '--aura-color-1': currentAura.colors[0],
        '--aura-color-2': currentAura.colors[1],
        '--aura-color-3': currentAura.colors[2],
        '--aura-accent': currentAura.accent,
      }}
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

      {/* Workspace navigation: primary work views stay visible at every width. */}
      <header className="lumen-header workspace-header" ref={workspaceHeaderRef}>
        <div className="header-brand">
          <LumenLogo size={34} />
          <div className="header-brand-copy"><h1 className="brand-title">LUMEN</h1><span className="header-brand-caption">{projectSummaries.find(project => project.id === currentProjectId)?.name || 'Your AI workspace'}</span></div>
        </div>

        <nav className="header-primary-nav" aria-label="Workspace views">
          <button type="button" className={`header-nav-button ${showLogDrawer ? 'is-active' : ''}`}
            onClick={() => { setShowMissions(false); setShowLogDrawer(open => !open); }}
            aria-expanded={showLogDrawer} aria-controls="conversation-panel"
            title={showLogDrawer ? t.header.transcriptClose : t.header.transcriptOpen}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 10h8M8 13.5h5"/></svg>
            <span>{t.header.transcriptOpen.replace(/^💬\s*/, '')}</span>
            {(isThinking || messages.some(message => message.isStreaming)) && <span className="header-work-indicator" aria-label="Work in progress" />}
          </button>
          <button type="button" className={`header-nav-button mission-history-toggle ${showMissions ? 'is-active' : ''}`}
            onClick={() => { setShowMissions(open => !open); if (!showMissions) void refreshSavedMissions(); }}
            aria-expanded={showMissions} aria-controls="saved-missions-panel" title="Reopen saved work and resume missions">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>
            <span>Missions</span>
          </button>
        </nav>

        <div className="header-utilities">
          <div className="header-quick-preferences" aria-label="Quick preferences">
            <button type="button" className="header-preference-button" onClick={handleCycleLanguage}
              title={t.header.languageTooltip} aria-label={t.header.languageTooltip}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5h12M9 3v2M6 5c0 5 3 8 7 10M12 5c0 5-3 8-8 11M14 21l4-11 4 11M15.5 17h5"/></svg>
              <span>{getLanguageInfo().code}</span>
            </button>
            <button type="button" className="header-preference-button header-voice-preference" onClick={() => setIsVoiceModalOpen(true)}
              title={formatString(t.header.voiceTooltip, { voice: activeVoice })} aria-label={`Voice: ${activeVoice}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8"/></svg>
              <span>{activeVoice}</span>
            </button>
            <button type="button" className={`header-preference-button header-web-preference mode-${webMode}`} onClick={handleCycleWebMode}
              title={formatString(t.header.webTooltip, { mode: t.header.webModes[webMode] || webMode })}
              aria-label={formatString(t.header.webTooltip, { mode: t.header.webModes[webMode] || webMode })}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></svg>
              <span>{t.header.webModes[webMode] || webMode}</span>
            </button>
          </div>
          {/* Ambient Aura Selector System */}
          <div className="aura-btn-container" ref={auraMenuRef}>
            <button 
              type="button" 
              className={`aura-toggle-btn header-icon-button aura-${currentAura.id}`}
              onClick={() => { closeControlMenu(); setIsAuraMenuOpen((open) => !open); }}
              title={`Aura: ${currentAura.name} — Switch ambient lighting mood`}
              aria-label={`Aura: ${currentAura.name}`}
              aria-expanded={isAuraMenuOpen}
              aria-haspopup="dialog"
            >
              <span 
                className="aura-dot-glow" 
                style={{ 
                  background: `linear-gradient(135deg, ${currentAura.colors[0]}, ${currentAura.colors[1]})`,
                  boxShadow: `0 0 10px ${currentAura.accent}`
                }} 
              />
              <span className="aura-icon">{currentAura.icon}</span>
              <span className="aura-label">Aura</span>
              <span className="aura-active-name">{currentAura.name}</span>
              <span className={`aura-chevron ${isAuraMenuOpen ? 'is-open' : ''}`}>▾</span>
            </button>

            {isAuraMenuOpen && (
              <div 
                className="aura-picker-popover animate-fade-in"
                role="dialog"
                aria-label="Aura Presets"
              >
                <div className="aura-picker-header">
                  <div className="aura-picker-title-wrap">
                    <span className="aura-picker-badge">✨ AMBIENT AURA</span>
                    <h3 className="aura-picker-title">Aura Presets</h3>
                    <p className="aura-picker-subtitle">Select an ambient visual lighting mood</p>
                  </div>
                  <button
                    type="button"
                    className="aura-cycle-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCycleAura();
                    }}
                    title="Cycle to next aura"
                  >
                    ↻ Next
                  </button>
                </div>

                <div className="aura-grid">
                  {PRESET_AURAS.map((aura) => {
                    const isSelected = aura.id === currentAura.id;
                    return (
                      <button
                        key={aura.id}
                        type="button"
                        className={`aura-card ${isSelected ? 'is-active' : ''}`}
                        onClick={() => handleSelectAura(aura.id)}
                      >
                        <div className="aura-card-orb-wrap">
                          <span 
                            className="aura-card-orb"
                            style={{
                              background: `linear-gradient(135deg, ${aura.colors[0]}, ${aura.colors[1]}, ${aura.colors[2]})`,
                              boxShadow: isSelected ? `0 0 16px ${aura.accent}` : `0 0 8px rgba(0,0,0,0.4)`
                            }}
                          />
                          <span className="aura-card-icon">{aura.icon}</span>
                        </div>
                        <div className="aura-card-info">
                          <div className="aura-card-name-row">
                            <span className="aura-card-name">{aura.name}</span>
                            {isSelected && <span className="aura-active-check">✓</span>}
                          </div>
                          <span className="aura-card-desc">{aura.description}</span>
                          <div className="aura-palette-swatches">
                            {aura.colors.map((c, i) => (
                              <span key={i} className="aura-swatch-dot" style={{ backgroundColor: c }} />
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="aura-picker-footer">
                  <button
                    type="button"
                    className={`aura-circadian-sync-btn ${circadianSetting === 'auto' ? 'is-synced' : ''}`}
                    onClick={() => {
                      const nextSetting = circadianSetting === 'auto' ? activeCircadian : 'auto';
                      setCircadianSetting(nextSetting);
                      try { localStorage.setItem('lumen_circadian_setting', nextSetting); } catch (_) {}
                    }}
                    title="Automatically adjust atmosphere lighting with time of day"
                  >
                    <span className="sync-icon">{circadianSetting === 'auto' ? '☀️' : '🌙'}</span>
                    <span className="sync-text">
                      {circadianSetting === 'auto' ? 'Daylight Time Sync: ON' : 'Daylight Time Sync: Manual'}
                    </span>
                    <span className="sync-toggle-pill">{circadianSetting === 'auto' ? 'AUTO' : 'MANUAL'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>


          <button type="button" className={`header-icon-button header-explore-button ${isMobileControlsOpen && isExplorePanelOpen ? 'is-active' : ''}`}
            onClick={() => { setIsAuraMenuOpen(false); if (isMobileControlsOpen && isExplorePanelOpen) closeControlMenu(); else openExplorePanel(); }}
            title={t.explorePanel.title} aria-label={t.explorePanel.title} aria-haspopup="dialog" aria-expanded={isMobileControlsOpen && isExplorePanelOpen}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z"/></svg>
            <span className="header-explore-label">{t.explorePanel.title}</span>
          </button>
          <button type="button" className={`header-icon-button header-mobile-tools-button ${isMobileToolsOpen ? 'is-active' : ''}`}
            onClick={() => { closeControlMenu(); setIsAuraMenuOpen(false); setIsMobileToolsOpen(open => !open); }}
            title="Open tools" aria-label="Open tools" aria-haspopup="dialog" aria-expanded={isMobileToolsOpen}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></svg><span className="header-mobile-tools-label">Tools</span>
          </button>
          <div className="header-account-zone">
            <AccountAuthButton currentUser={currentUser} memoryLabel={t.memoryManager.launcher}
              onLogout={handleUserLogout} onOpenMemory={() => setIsMemoryModalOpen(true)}
              onOpenSettings={() => { setIsAuraMenuOpen(false); setIsExplorePanelOpen(false); setIsMobileControlsOpen(open => !(open && !isExplorePanelOpen)); }}
              conversationCount={Math.max(0, messages.length - 1)} />
          </div>
        </div>
      </header>

      {isQuickStartVisible && (
        <aside className="quick-start-guide" aria-labelledby="quick-start-title">
          <div className="quick-start-guide-header">
            <h2 id="quick-start-title">{t.quickStart.title}</h2>
            <button
              type="button"
              className="quick-start-dismiss"
              onClick={dismissQuickStart}
              aria-label={t.quickStart.dismiss}
              title={t.quickStart.dismiss}
            >
              ×
            </button>
          </div>
          <div className="quick-start-actions">
            <button
              type="button"
              className="quick-start-action"
              onClick={() => handleQuickStartAction(handleToggleListen)}
            >
              <span className="quick-start-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8" />
                </svg>
              </span>
              <span>{t.quickStart.sphere}</span>
            </button>
            <button
              type="button"
              className="quick-start-action"
              onClick={() => handleQuickStartAction(() => setShowLogDrawer(true))}
            >
              <span className="quick-start-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6a7.5 7.5 0 1 1 17-3.5Z" />
                  <path d="M8 10h8M8 13.5h5" />
                </svg>
              </span>
              <span>{t.quickStart.chat}</span>
            </button>
            <button
              type="button"
              className="quick-start-action"
              onClick={() => handleQuickStartAction(openExplorePanel)}
            >
              <span aria-hidden="true">✦</span>
              <span>{t.quickStart.explore}</span>
            </button>
            <button
              type="button"
              className="quick-start-action"
              onClick={() => handleQuickStartAction(() => setIsAttachmentMenuOpen(true))}
            >
              <span aria-hidden="true">＋</span>
              <span>{t.quickStart.attach}</span>
            </button>
          </div>
        </aside>
      )}

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
                      onClick={() => selectExploreAction(action)}
                    >
                      <span className="control-menu-icon" aria-hidden="true">{action.icon}</span>
                      <span className="control-menu-copy">
                        <span className="control-menu-label">{action.label}</span>
                        <span className="control-menu-description">{action.description}</span>
                      </span>
                      {!triedExploreActionIds.has(action.id) && (
                        <span className="explore-panel-try">{t.explorePanel.tryIt}</span>
                      )}
                    </button>
                  ))}
                </div>
                <section className="pwa-install-card" aria-label={t.explorePanel.installTitle}>
                  <span className="control-menu-icon" aria-hidden="true">📲</span>
                  <div className="control-menu-copy pwa-install-copy">
                    <span className="control-menu-label">{t.explorePanel.installTitle}</span>
                    <span className="control-menu-description">
                      {isAppInstalled
                        ? t.explorePanel.installed
                        : t.explorePanel.installDescription}
                    </span>
                    {!isAppInstalled && showInstallInstructions && (
                      <span className="pwa-install-steps" role="status">
                        {isIosDevice
                          ? t.explorePanel.installIosSteps
                          : t.explorePanel.installBrowserSteps}
                      </span>
                    )}
                  </div>
                  {!isAppInstalled && (
                    <button
                      type="button"
                      className="pwa-install-button"
                      onClick={handleInstallApp}
                      aria-expanded={showInstallInstructions}
                    >
                      {canInstallApp
                        ? t.explorePanel.installNow
                        : isIosDevice
                          ? t.explorePanel.installHowTo
                          : showInstallInstructions
                            ? t.explorePanel.installHide
                            : t.explorePanel.installButton}
                    </button>
                  )}
                </section>
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
                <ReplyModePicker inline value={responseStyle} onChange={handleResponseStyleChange} copy={t.personalization} />
                <section className="control-menu-nav-section" aria-labelledby="control-menu-nav-title">
                  <h3 id="control-menu-nav-title" className="control-menu-section-title">{t.header.navigationTitle}</h3>
                  <div className="control-menu-grid control-menu-nav-grid">
                    {navigationActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className="control-menu-action"
                        aria-label={`${action.label}: ${action.description}`}
                        title={action.description}
                        onClick={action.onSelect}
                      >
                        <span className="control-menu-icon" aria-hidden="true">{action.icon}</span>
                        <span className="control-menu-copy">
                          <span className="control-menu-label">{action.label}</span>
                          <span className="control-menu-description">{action.description}</span>
                        </span>
                        <span className="control-menu-nav-arrow" aria-hidden="true">→</span>
                      </button>
                    ))}
                  </div>
                </section>
                <div className="control-menu-section-divider" aria-hidden="true" />
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
      {showWelcomeGreeting && currentUser && !showLogDrawer && (
        <aside className="welcome-greeting" role="status" aria-live="polite">
          <span className="welcome-greeting-spark" aria-hidden="true">✦</span>
          <span className="welcome-greeting-text">
            {formatString(
              greetingName ? t.returningGreeting : t.returningGreetingGeneric,
              { name: greetingName }
            )}
          </span>
          <button
            type="button"
            className="welcome-greeting-dismiss"
            onClick={() => setShowWelcomeGreeting(false)}
            aria-label={t.dismissGreeting}
            title={t.dismissGreeting}
          >×</button>
        </aside>
      )}

      <main
        className={`lumen-main-stage ${showLogDrawer ? 'chat-open' : 'chat-closed'}`}
        onClick={(event) => {
          if (typeof window !== 'undefined' && window.__lumen_is_resizing_chat) {
            return;
          }
          if (
            showLogDrawer &&
            !event.target.closest('#conversation-panel, .mission-history-drawer, .desktop-pill-wrapper, .desktop-customize-trigger, .chat-corner-handle, .desk-workspace-backdrop')
          ) {
            setShowLogDrawer(false);
          }
        }}
      >
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

        <SharedTabChip tab={sharedTab} onDisconnect={() => setSharedTab(null)} />
        <OpenLinkApproval url={pendingOpenUrl} onDismiss={() => setPendingOpenUrl(null)} onOpenInLumen={(u) => { setEmbeddedUrl(u); setPendingOpenUrl(null); }} />
        <EmbeddedTabPanel url={embeddedUrl} onClose={() => setEmbeddedUrl(null)} />
        <HtmlWindowPanel html={htmlWindow} onClose={() => setHtmlWindow(null)} />
        <div className="open-web-dock">
          <OpenWebPageButton triggerOnly openRequest={openWebPageRequest} onOpen={(u) => { setPendingOpenUrl(null); setEmbeddedUrl(u); }} />
        </div>

        {desktopVisibility.persona && (
          <button
            type="button"
            ref={personaElementRef}
            className={`persona-profile-card ${isPersonaDragging ? 'is-dragging' : ''}`}
            style={{
              '--persona-drag-x': `${personaCardOffset.x}px`,
              '--persona-drag-y': `${personaCardOffset.y}px`
            }}
            onClick={(event) => {
              if (suppressPersonaClickRef.current) {
                event.preventDefault();
                event.stopPropagation();
                suppressPersonaClickRef.current = false;
                return;
              }
              setIsMemoryModalOpen(true);
            }}
            title={personaCard?.summary || t.memoryManager.launcherHint}
            aria-label={t.memoryManager.personaLauncher}
          >
            <span
              className="persona-profile-head persona-profile-drag-handle"
              onPointerDown={handlePersonaDragStart}
              onPointerMove={handlePersonaDragMove}
              onPointerUp={handlePersonaDragEnd}
              onPointerCancel={handlePersonaDragEnd}
              title={t.personaDragHint}
            >
              <span className="persona-profile-mark" aria-hidden="true">✦</span>
              <span className="persona-profile-title">
                <strong>{t.memoryManager.personaLauncher}</strong>
                <small>{personaCard ? t.memoryManager.personaSummary : currentUser ? t.memoryManager.personaCreate : t.memoryManager.signInTitle}</small>
              </span>
              <span className="persona-profile-open" aria-hidden="true">⠿</span>
            </span>
            {personaCard ? (
              <>
                <span className="persona-profile-summary">{personaCard.summary}</span>
                {personaCard.currentFocus?.length > 0 && (
                  <span className="persona-profile-info">
                    <small>{t.memoryManager.personaFocus}</small>
                    <span>{personaCard.currentFocus.slice(0, 2).join(' · ')}</span>
                  </span>
                )}
                {personaCard.preferences?.length > 0 && (
                  <span className="persona-profile-info">
                    <small>{t.memoryManager.personaPreferences}</small>
                    <span>{personaCard.preferences.slice(0, 2).join(' · ')}</span>
                  </span>
                )}
                {personaCard.worksBest?.length > 0 && (
                  <span className="persona-profile-info persona-profile-works">
                    <small>{t.memoryManager.personaWorksBest}</small>
                    <span>{personaCard.worksBest[0]}</span>
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="persona-profile-empty">{currentUser ? t.memoryManager.personaNeedsKnowledge : t.memoryManager.signInHint}</span>
                <span className="persona-profile-cta">{currentUser ? t.memoryManager.personaCreate : t.memoryManager.signInTitle} <span aria-hidden="true">→</span></span>
              </>
            )}
          </button>
        )}

        {desktopVisibility.weather && ambientData.weather && (
          <div
            ref={weatherElementRef}
            className={`weather-tile-wrap weather-desktop-widget ${isWeatherTileDragging ? 'is-dragging' : ''}`}
            style={{
              '--weather-drag-x': `${weatherTileOffset.x}px`,
              '--weather-drag-y': `${weatherTileOffset.y}px`
            }}
          >
            <button
              type="button"
              className={`ambient-glance-pill weather-glance ${activeStageWidget?.widgetType === 'weather' ? 'active' : ''}`}
              onClick={(event) => {
                if (suppressWeatherTileClickRef.current) {
                  event.preventDefault();
                  event.stopPropagation();
                  suppressWeatherTileClickRef.current = false;
                  return;
                }
                setActiveStageWidget(activeStageWidget?.widgetType === 'weather' ? null : ambientData.weather);
              }}
              title={t.glance.weatherTooltip}
            >
              <span
                className="weather-drag-handle"
                aria-hidden="true"
                onPointerDown={handleWeatherTileDragStart}
                onPointerMove={handleWeatherTileDragMove}
                onPointerUp={handleWeatherTileDragEnd}
                onPointerCancel={handleWeatherTileDragEnd}
                title={t.weatherDragHint}
              >⠿</span>
              <span className="glance-pulse"></span>
              <span className="glance-icon">{ambientData.weather.icon}</span>
              <span className="glance-title">{ambientData.weather.city?.split(',')[0]}</span>
              <span className="glance-value">{ambientData.weather.temp}°C</span>
              <span className="glance-sub">{ambientData.weather.condition}</span>
            </button>
            <button
              type="button"
              className="weather-settings-btn"
              aria-label="Change city"
              title="Change city"
              onClick={() => setActiveStageWidget({
                widgetType: 'weather',
                city: ambientData.weather.city || 'Vienna',
                temp: ambientData.weather.temp ?? '--',
                condition: ambientData.weather.condition || t.glance.liveGlobalWeather,
                icon: ambientData.weather.icon || '🌤️',
                high: ambientData.weather.high ?? '--',
                low: ambientData.weather.low ?? '--',
                humidity: ambientData.weather.humidity ?? '--',
                wind: ambientData.weather.wind ?? '--',
                forecast: ambientData.weather.forecast || [],
                initialSearching: true
              })}
            >⚙</button>
          </div>
        )}

        {visibleDesktopActions.map(action => <DraggableDesktopPill key={`${action.id}-${desktopLayoutVersion}`} id={action.id}
          label={action.label} title={action.description} icon={action.icon} position={action.position}
          isActive={deskAction === action.id || activeAgentAction === action.id} badge={action.id === 'watches' ? deskNotificationCount : 0}
          onSelect={action.onSelect} onHide={id => toggleDesktopItem(id, false)} />)}
        <button type="button" className="desktop-customize-trigger" onClick={openDesktopCustomize} aria-label="Customize desktop" title="Customize desktop">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><path d="M17.5 14v7M14 17.5h7" /></svg>
        </button>

        {/* Real-Time Ambient Live Bar & Interactive Glanceable Pills */}
        <div className="ambient-live-bar">
          <div className="ambient-glance-row">
            {desktopVisibility.weather && !ambientData.weather && (
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
          </div>
        </div>

        {/* Active Floating VisionOS Stage Widget */}
        {isFloatingStageWidget(activeStageWidget) && (
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
                aria-label={t.stageWidget.dismissTooltip}
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
            onClose={() => setShowLogDrawer(false)}
            messages={scopedMessages}
            projectName={projectSummaries.find(project => project.id === currentProjectId)?.name}
            liveTranscript={liveTranscript}
            isThinking={isThinking}
            onClearHistory={handleClearHistory}
            onExportPdf={handleExportConversationPdf}
            onSendMessage={handleSendMessage}
            onStop={handleStopRun}
            onMissionAction={handleMissionAction}
            onPlanStart={handleStartPlan}
            onPlanCancel={handleCancelPlan}
            onBriefBuild={handleStartBrief}
            onBriefSkip={(messageId) => handleStartBrief(messageId, null)}
            onBriefCancel={handleCancelBrief}
            onArtifactUpdate={handleArtifactUpdate}
            onPinArtifact={pinDeskOutput}
            currentProjectId={currentProjectId}
            onTriggerAgentAction={(actionKey, rect) => handleOpenAgentAction(actionKey, rect)}
            activeLanguage={activeLanguage}
            windowOffset={chatWindowOffset}
            onWindowOffsetChange={setChatWindowOffset}
            onWindowDraggingChange={setIsChatWindowDragging}
          />
        </div>
        {showMissions && <div id="saved-missions-panel"><MissionHistoryDrawer missions={savedMissions} loading={missionsLoading} error={missionsError}
          onClose={() => setShowMissions(false)} onRefresh={refreshSavedMissions} onOpen={openSavedMission} /></div>}
      </main>

      {deskAction && <DeskWorkspace open action={deskAction} onClose={() => setDeskAction(null)} onRun={runDeskMission}
        onOpenMission={snapshot => { setDeskAction(null); openSavedMission(snapshot); }}
        currentProjectId={currentProjectId} onProjectChange={selectDeskProject} messages={scopedMessages} activeLanguage={activeLanguage} />}
      {showDesktopCustomize && <DesktopCustomizeDialog visibility={desktopVisibility} onToggle={toggleDesktopItem}
        onSetAll={visible => setDesktopVisibility(saveDesktopVisibility(Object.fromEntries(DESKTOP_ITEMS.map(item => [item.id, visible]))))}
        onReset={resetDesktop} onClose={() => setShowDesktopCustomize(false)} />}
      {isMobileToolsOpen && <MobileToolsSheet actions={desktopActions} utilityActions={mobileUtilityActions}
        onSelect={action => { setIsMobileToolsOpen(false); action.onSelect(); }} onClose={() => setIsMobileToolsOpen(false)}
        onSettings={() => { setIsMobileToolsOpen(false); setIsExplorePanelOpen(false); setIsMobileControlsOpen(true); }} />}

      {/* Bottom Spatial Command Bar */}
      <footer 
        ref={composerFooterRef}
        className={`lumen-footer ${isChatWindowDragging ? 'is-chat-window-dragging' : ''}`}
        style={{
          '--chat-window-drag-x': `${showLogDrawer ? chatWindowOffset.x : 0}px`,
          '--chat-window-drag-y': `${showLogDrawer ? chatWindowOffset.y : 0}px`
        }}
      >
        <div className="lumen-composer"
          style={{
            transform: (showLogDrawer && chatWindowOffset.x)
              ? `translateX(clamp(calc(-50vw + 290px), ${chatWindowOffset.x}px, calc(50vw - 290px)))`
              : undefined
          }}
        >
          <form
            className="bottom-input-form"
            onPointerMove={event => {
              if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
              const form = event.currentTarget;
              const rect = form.getBoundingClientRect();
              if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
              form.style.setProperty('--composer-glow-x', `${Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))}%`);
              form.style.setProperty('--composer-glow-y', `${Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100))}%`);
            }}
            onPointerLeave={event => {
              event.currentTarget.style.removeProperty('--composer-glow-x');
              event.currentTarget.style.removeProperty('--composer-glow-y');
            }}
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
              disabled={runInProgress}
              aria-label={t.footer.attachTooltip}
              aria-haspopup="dialog"
              aria-expanded={isAttachmentMenuOpen}
            >
              <span className="attachment-trigger-plus" aria-hidden="true">+</span>
            </button>

            <textarea
              ref={textInputRef}
              rows={1}
              className="bottom-text-field"
              placeholder={
                selectedFile
                  ? (selectedFile.isPdf ? t.footer.placeholderPdf : t.footer.placeholderImg)
                  : t.footer.placeholderNormal
              }
              value={textInput}
              onChange={(event) => {
                setTextInput(event.target.value);
                if (!event.target.value.trim()) setDecisionMissionDraft(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  if ((textInput.trim() || selectedFile) && !runInProgress) {
                    handleSendMessage();
                  }
                }
              }}
            />
            <ReplyModePicker value={responseStyle} onChange={handleResponseStyleChange} copy={t.personalization} />
            <button
              type="submit"
              className="bottom-submit-btn"
              disabled={(!textInput.trim() && !selectedFile) || runInProgress}
              aria-label={t.footer.sendTooltip}
              title={t.footer.sendTooltip}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
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
              title={t.footer.takePhoto}
              aria-label={t.footer.takePhoto}
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
              title={t.footer.chooseFile}
              aria-label={t.footer.chooseFile}
            >
              <span className="attachment-sheet-icon" aria-hidden="true">▧</span>
              <span>{t.footer.chooseFile}</span>
            </button>
            {isTabCaptureSupported() && (
              <button type="button" className="attachment-sheet-action" onClick={handleShareTabSnapshot} title="Capture one frame of a tab, window, or screen for Lumen to inspect." aria-label="Capture one screen snapshot">
                <span className="attachment-sheet-icon" aria-hidden="true">🖥️</span>
                <span>Share a tab or window (snapshot)</span>
              </button>
            )}
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

      <UserMemoryModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        activeLanguage={activeLanguage}
        statusNotice={memoryNotice}
        isSignedIn={Boolean(currentUser)}
        onPersonaCardChange={setPersonaCard}
      />

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        activeLanguage={activeLanguage}
      />

      {/* Dedicated Agent Action Modal Launcher with Morph Transition */}
      <AgentActionModal
        action={activeAgentAction}
        originRect={agentActionOriginRect}
        onClose={() => {
          setActiveAgentAction(null);
          setAgentActionOriginRect(null);
        }}
        onExecute={(prompt) => {
          setShowLogDrawer(true);
          handleSendMessage(prompt);
        }}
        onOpenWebPage={(u) => {
          setPendingOpenUrl(null);
          setEmbeddedUrl(u);
        }}
        activeLanguage={activeLanguage}
        defaultCity={ambientData.weather?.city || 'Vienna'}
        targetRole={jobFilter.role}
      />
    </div>
  );
}
