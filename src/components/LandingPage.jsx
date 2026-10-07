import React, { useEffect, useRef, useState } from 'react';
import LumenLogo from './LumenLogo.jsx';
import './LandingPage.css';

const DEMO_MODES = [
  {
    id: 'voice',
    label: 'Talk it out',
    icon: 'voice',
    eyebrow: 'VOICE CONVERSATION',
    title: 'Think out loud.',
    detail: 'Speak naturally, hear Lumen respond, and keep the thread going without losing your place.',
    question: '“Can we think this through together?”'
  },
  {
    id: 'vision',
    label: 'Show and tell',
    icon: 'vision',
    eyebrow: 'IMAGES AND DOCUMENTS',
    title: 'Bring the context.',
    detail: 'Share an image or PDF and ask Lumen to help you understand what you are looking at.',
    question: '“What should I notice in this?”'
  },
  {
    id: 'research',
    label: 'Go deeper',
    icon: 'research',
    eyebrow: 'WEB RESEARCH',
    title: 'Follow your curiosity.',
    detail: 'Explore a topic with sourced web research, then turn the findings into a downloadable report.',
    question: '“Can you research this and make me a report?”'
  }
];

const FEATURES = [
  {
    id: 'voice',
    number: '01',
    icon: 'voice',
    title: 'Say what you’re thinking.',
    detail: 'Have a spoken conversation, or type when that feels more natural. Lumen is ready to follow your train of thought.',
    action: 'Explore voice',
    mode: 'voice'
  },
  {
    id: 'vision',
    number: '02',
    icon: 'vision',
    title: 'Let the details speak.',
    detail: 'Bring an image, a PDF, or a page you choose to share. Ask questions with the context already in view.',
    action: 'Explore vision',
    mode: 'vision'
  },
  {
    id: 'research',
    number: '03',
    icon: 'research',
    title: 'Turn curiosity into clarity.',
    detail: 'Research public web sources, get live information, and create a report you can take with you.',
    action: 'Explore research',
    mode: 'research'
  },
  {
    id: 'personalize',
    number: '04',
    icon: 'personalize',
    title: 'Make the space your own.',
    detail: 'Choose a voice, language, and response style. Review, edit, or pause saved memories whenever you like.',
    action: 'Meet your copilot',
    mode: null
  }
];

const FAQ_ITEMS = [
  {
    question: 'What is Lumen?',
    answer: 'Lumen is a voice- and vision-enabled AI copilot for conversation, image and PDF analysis, web research, and live information.'
  },
  {
    question: 'How do I use it?',
    answer: 'Open the copilot and ask by voice or text. You can attach an image or PDF, or ask Lumen to research a topic on the web.'
  },
  {
    question: 'Can I control what Lumen remembers?',
    answer: 'Yes. You can review, edit, or delete saved memories, and automatic memory can be paused from the account controls.'
  },
  {
    question: 'Does Lumen work offline?',
    answer: 'AI conversations and live-data features need an internet connection.'
  }
];

const WAVE_HEIGHTS = [12, 22, 16, 34, 24, 46, 27, 39, 17, 31, 48, 24, 38, 18, 44, 26, 36, 15, 29, 43, 21, 34, 13];

function ArrowIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

function FeatureIcon({ name, className = '' }) {
  const icons = {
    voice: (
      <>
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8" />
      </>
    ),
    vision: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <circle cx="9" cy="10" r="1.5" />
        <path d="m21 15-5-5L6 20" />
      </>
    ),
    research: (
      <>
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    personalize: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="9" cy="6" r="2" />
        <circle cx="15" cy="12" r="2" />
        <circle cx="10" cy="18" r="2" />
      </>
    )
  };

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

function Reveal({ children, className = '', delay = 0 }) {
  const elementRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (
      !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -36px 0px' }
    );

    if (elementRef.current) observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={elementRef}
      className={`lp-reveal ${isVisible ? 'is-visible' : ''} ${className}`}
      style={{ '--lp-reveal-delay': `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function FeatureArtwork({ type, coverUrl }) {
  if (type === 'voice') {
    return (
      <div className="lp-feature-art lp-feature-art--voice" aria-hidden="true">
        <div className="lp-feature-orb"><LumenLogo size={68} /></div>
        <div className="lp-feature-wave">
          {WAVE_HEIGHTS.slice(0, 17).map((height, index) => (
            <span key={index} style={{ height: `${height}px`, animationDelay: `${-index * 0.07}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (type === 'vision') {
    return (
      <div className="lp-feature-art lp-feature-art--vision" aria-hidden="true">
        <div className="lp-feature-photo">
          <img src={coverUrl} alt="" />
          <span className="lp-photo-corner lp-photo-corner--tl" />
          <span className="lp-photo-corner lp-photo-corner--tr" />
          <span className="lp-photo-corner lp-photo-corner--bl" />
          <span className="lp-photo-corner lp-photo-corner--br" />
        </div>
        <div className="lp-feature-file">
          <span className="lp-file-glyph">PDF</span>
          <span className="lp-file-lines"><i /><i /><i /></span>
          <span className="lp-file-check">✓</span>
        </div>
      </div>
    );
  }

  if (type === 'research') {
    return (
      <div className="lp-feature-art lp-feature-art--research" aria-hidden="true">
        <div className="lp-source-card lp-source-card--back"><span /><i /><i /></div>
        <div className="lp-source-card lp-source-card--front">
          <span className="lp-source-number">01</span>
          <span className="lp-source-copy"><i /><i /><i /></span>
          <span className="lp-source-check">✓</span>
        </div>
        <div className="lp-feature-report">RESEARCH <span>↗</span></div>
      </div>
    );
  }

  return (
    <div className="lp-feature-art lp-feature-art--personalize" aria-hidden="true">
      <div className="lp-mini-setting"><span>Voice</span><strong>Joanna</strong><span className="lp-setting-chevron">⌄</span></div>
      <div className="lp-mini-setting"><span>Reply style</span><strong>Thoughtful</strong><span className="lp-setting-chevron">⌄</span></div>
      <div className="lp-mini-setting lp-mini-setting--memory"><span>Memory controls</span><span className="lp-mini-switch"><i /></span></div>
    </div>
  );
}

function ModeArtwork({ mode, coverUrl }) {
  if (mode === 'voice') {
    return (
      <div className="lp-mode-art lp-mode-art--voice" aria-hidden="true">
        <div className="lp-mode-glow" />
        <div className="lp-mode-logo"><LumenLogo size={90} /></div>
        <div className="lp-mode-wave">
          {WAVE_HEIGHTS.map((height, index) => (
            <span key={index} style={{ height: `${height}px`, animationDelay: `${-index * 0.045}s` }} />
          ))}
        </div>
        <span className="lp-mode-caption"><i /> A conversation, at your pace</span>
      </div>
    );
  }

  if (mode === 'vision') {
    return (
      <div className="lp-mode-art lp-mode-art--vision" aria-hidden="true">
        <div className="lp-mode-orbit lp-mode-orbit--one" />
        <div className="lp-mode-orbit lp-mode-orbit--two" />
        <div className="lp-context-image"><img src={coverUrl} alt="" /></div>
        <div className="lp-context-doc">
          <div className="lp-context-doc-icon"><FeatureIcon name="vision" /></div>
          <div><strong>Your context</strong><span>Image or PDF</span></div>
          <span className="lp-context-plus">+</span>
        </div>
        <span className="lp-context-tag">ASK ABOUT WHAT YOU SEE</span>
      </div>
    );
  }

  return (
    <div className="lp-mode-art lp-mode-art--research" aria-hidden="true">
      <div className="lp-research-window">
        <div className="lp-research-window-head">
          <span className="lp-window-dot" /><span className="lp-window-dot" /><span className="lp-window-dot" />
          <span>RESEARCH NOTES</span>
        </div>
        <div className="lp-research-query"><FeatureIcon name="research" /><span>Explore a question</span><span className="lp-query-arrow">↗</span></div>
        <div className="lp-research-source">
          <span className="lp-source-index">01</span>
          <span className="lp-research-lines"><i /><i /><i /></span>
          <span className="lp-source-status">SOURCE</span>
        </div>
        <div className="lp-research-source lp-research-source--second">
          <span className="lp-source-index">02</span>
          <span className="lp-research-lines"><i /><i /><i /></span>
          <span className="lp-source-status">SOURCE</span>
        </div>
        <div className="lp-research-export"><span className="lp-export-icon">PDF</span><span><strong>Research report</strong><small>Ready to take with you</small></span><span className="lp-export-arrow">↗</span></div>
      </div>
      <div className="lp-research-spark">✦</div>
    </div>
  );
}

export default function LandingPage() {
  const [activeMode, setActiveMode] = useState('voice');
  const [openFaq, setOpenFaq] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const heroVisualRef = useRef(null);
  const coverUrl = `${import.meta.env.BASE_URL}share-cover.png`;
  const selectedMode = DEMO_MODES.find((mode) => mode.id === activeMode) || DEMO_MODES[0];

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const handleHeroPointerMove = (event) => {
    if (
      !heroVisualRef.current ||
      event.pointerType === 'touch' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const bounds = heroVisualRef.current.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    heroVisualRef.current.style.setProperty('--lp-pointer-x', `${(x * 12).toFixed(1)}px`);
    heroVisualRef.current.style.setProperty('--lp-pointer-y', `${(y * 12).toFixed(1)}px`);
  };

  const resetHeroPointer = () => {
    if (!heroVisualRef.current) return;
    heroVisualRef.current.style.setProperty('--lp-pointer-x', '0px');
    heroVisualRef.current.style.setProperty('--lp-pointer-y', '0px');
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="lp-site" id="top">
      <div className="lp-atmosphere" aria-hidden="true">
        <span className="lp-atmosphere-glow lp-atmosphere-glow--one" />
        <span className="lp-atmosphere-glow lp-atmosphere-glow--two" />
        <span className="lp-atmosphere-glow lp-atmosphere-glow--three" />
      </div>

      <a className="lp-skip-link" href="#main-content">Skip to content</a>

      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <a className="lp-brand" href="#top" aria-label="Lumen AI home" onClick={closeMenu}>
            <LumenLogo size={36} />
            <span>LUMEN</span>
          </a>

          <nav id="lp-primary-nav" className={`lp-nav-links ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
            <a href="#capabilities" onClick={closeMenu}>Capabilities</a>
            <a href="#experience" onClick={closeMenu}>The experience</a>
            <a href="#faq" onClick={closeMenu}>FAQ</a>
            <a className="lp-mobile-cta" href="#app" onClick={closeMenu}>
              Open the copilot <ArrowIcon />
            </a>
          </nav>

          <div className="lp-header-actions">
            <a className="lp-header-cta" href="#app">
              Open Lumen <ArrowIcon />
            </a>
            <button
              className={`lp-menu-toggle ${menuOpen ? 'is-open' : ''}`}
              type="button"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
              aria-controls="lp-primary-nav"
              onClick={() => setMenuOpen((isOpen) => !isOpen)}
            >
              <span /><span /><span />
              <i>{menuOpen ? 'Close' : 'Menu'}</i>
            </button>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <div className="lp-container lp-hero-grid">
            <Reveal className="lp-hero-copy">
              <div className="lp-eyebrow"><span className="lp-eyebrow-dot" /> A NEW WAY TO THINK WITH AI</div>
              <h1 id="lp-hero-title">Your thoughts,<br />in a <span>new light.</span></h1>
              <p className="lp-hero-intro">
                Meet Lumen: an ambient AI companion for real conversations, curious questions, and the things you want to understand.
              </p>
              <div className="lp-hero-actions">
                <a className="lp-button lp-button--primary" href="#app">
                  Talk with Lumen <ArrowIcon />
                </a>
                <a className="lp-button lp-button--quiet" href="#capabilities">
                  Discover what’s possible <span className="lp-down-arrow">↓</span>
                </a>
              </div>
              <div className="lp-hero-note">
                <span className="lp-note-stars" aria-hidden="true">✦</span>
                <span>Voice, vision, and research—in one thoughtful space.</span>
              </div>
            </Reveal>

            <Reveal className="lp-hero-art-wrap" delay={150}>
              <figure
                className="lp-hero-art"
                ref={heroVisualRef}
                onPointerMove={handleHeroPointerMove}
                onPointerLeave={resetHeroPointer}
              >
                <img
                  className="lp-hero-cover"
                  src={coverUrl}
                  alt="A luminous Lumen orb, woven from cyan, violet, and rose light."
                  fetchPriority="high"
                  decoding="async"
                />
                <span className="lp-hero-orbit lp-hero-orbit--one" aria-hidden="true" />
                <span className="lp-hero-orbit lp-hero-orbit--two" aria-hidden="true" />
                <div className="lp-float-card lp-float-card--voice" aria-hidden="true">
                  <span className="lp-float-icon"><FeatureIcon name="voice" /></span>
                  <span className="lp-float-copy"><strong>Always in the conversation</strong><small>Voice · text · your pace</small></span>
                  <span className="lp-float-live"><i /></span>
                </div>
                <div className="lp-float-card lp-float-card--vision" aria-hidden="true">
                  <span className="lp-float-spark">✦</span>
                  <span className="lp-float-copy"><strong>Ideas, brought into focus</strong><small>Look closer with Lumen</small></span>
                </div>
              </figure>
              <figcaption className="lp-art-caption">
                <span><i /> A little more light on what’s next</span>
                <span className="lp-art-index">LUMEN / 001</span>
              </figcaption>
            </Reveal>
          </div>
          <a className="lp-scroll-cue" href="#capabilities" aria-label="Scroll to explore Lumen">
            <span>SCROLL TO EXPLORE</span><i />
          </a>
        </section>

        <section className="lp-signal-strip" aria-label="Lumen at a glance">
          <div className="lp-container lp-signal-inner">
            <span className="lp-signal-label">ONE COPILOT, MORE WAYS TO THINK</span>
            <div className="lp-signal-items">
              <span><FeatureIcon name="voice" /> VOICE</span>
              <i />
              <span><FeatureIcon name="vision" /> VISION</span>
              <i />
              <span><FeatureIcon name="research" /> RESEARCH</span>
              <i />
              <span><FeatureIcon name="personalize" /> YOUR PACE</span>
            </div>
          </div>
        </section>

        <section className="lp-section lp-capabilities" id="capabilities" aria-labelledby="lp-capabilities-title">
          <div className="lp-container">
            <Reveal className="lp-section-heading">
              <div>
                <p className="lp-section-kicker"><span /> A COMPANION THAT KEEPS UP</p>
                <h2 id="lp-capabilities-title">More than an answer.<br /><span>A space to explore.</span></h2>
              </div>
              <p className="lp-section-intro">
                Start with a thought, a picture, or a question. Lumen brings the right kind of attention to the moment.
              </p>
            </Reveal>

            <div className="lp-feature-grid">
              {FEATURES.map((feature, index) => (
                <Reveal
                  key={feature.id}
                  className={`lp-feature-card lp-feature-card--${feature.id}`}
                  delay={(index % 2) * 90}
                >
                  <article>
                    <div className="lp-feature-topline">
                      <span>{feature.number} <i /> LUMEN CAPABILITY</span>
                      <FeatureIcon name={feature.icon} className="lp-feature-icon" />
                    </div>
                    <div className="lp-feature-copy">
                      <h3>{feature.title}</h3>
                      <p>{feature.detail}</p>
                    </div>
                    <FeatureArtwork type={feature.id} coverUrl={coverUrl} />
                    <a
                      className="lp-feature-link"
                      href={feature.mode ? '#experience' : '#app'}
                      onClick={() => feature.mode && setActiveMode(feature.mode)}
                    >
                      {feature.action} <ArrowIcon />
                    </a>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section lp-experience" id="experience" aria-labelledby="lp-experience-title">
          <div className="lp-container">
            <Reveal className="lp-experience-heading">
              <p className="lp-section-kicker"><span /> ONE SPACE, MANY STARTING POINTS</p>
              <h2 id="lp-experience-title">However you arrive,<br /><span>there’s room to go deeper.</span></h2>
              <p>Choose a path to preview how Lumen can meet you there.</p>
            </Reveal>

            <Reveal className="lp-experience-grid" delay={90}>
              <div className="lp-mode-picker" role="group" aria-label="Choose a Lumen capability to preview">
                {DEMO_MODES.map((mode, index) => (
                  <button
                    className={`lp-mode-button ${activeMode === mode.id ? 'is-active' : ''}`}
                    type="button"
                    key={mode.id}
                    aria-pressed={activeMode === mode.id}
                    onClick={() => setActiveMode(mode.id)}
                  >
                    <span className="lp-mode-number">0{index + 1}</span>
                    <span className="lp-mode-icon-wrap"><FeatureIcon name={mode.icon} /></span>
                    <span className="lp-mode-name">{mode.label}<small>{mode.eyebrow}</small></span>
                    <ArrowIcon className="lp-mode-arrow" />
                  </button>
                ))}
                <div className="lp-mode-note">
                  <span className="lp-mode-note-icon">✦</span>
                  <p>Move between voice, vision, and research as your question takes shape.</p>
                </div>
              </div>

              <div className={`lp-mode-panel lp-mode-panel--${selectedMode.id}`} role="region" aria-label={`${selectedMode.label} preview`} aria-live="polite">
                <div className="lp-mode-copy">
                  <span className="lp-mode-eyebrow"><i /> {selectedMode.eyebrow}</span>
                  <h3>{selectedMode.title}</h3>
                  <p>{selectedMode.detail}</p>
                  <div className="lp-example-question">
                    <span>AN EXAMPLE QUESTION</span>
                    <p>{selectedMode.question}</p>
                    <ArrowIcon />
                  </div>
                </div>
                <ModeArtwork mode={selectedMode.id} coverUrl={coverUrl} />
                <div className="lp-preview-disclaimer">A glimpse of what you can explore with Lumen</div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="lp-section lp-personalization" aria-labelledby="lp-personal-title">
          <div className="lp-container">
            <Reveal className="lp-personal-card">
              <div className="lp-personal-copy">
                <p className="lp-section-kicker"><span /> BUILT AROUND YOU</p>
                <h2 id="lp-personal-title">Your voice.<br />Your way of thinking.</h2>
                <p>
                  Choose how Lumen speaks and responds. Keep saved memories useful, manageable, and on your terms.
                </p>
                <a className="lp-text-link" href="#app">Make it yours <ArrowIcon /></a>
              </div>
              <div className="lp-settings-preview" aria-hidden="true">
                <div className="lp-settings-head"><span className="lp-settings-spark">✦</span><span>YOUR LUMEN</span><span className="lp-settings-dots">•••</span></div>
                <div className="lp-settings-row"><span className="lp-settings-row-icon"><FeatureIcon name="voice" /></span><span className="lp-settings-field"><small>VOICE</small><strong>Choose the voice that feels right</strong></span><span className="lp-settings-chevron">↗</span></div>
                <div className="lp-settings-row"><span className="lp-settings-row-icon"><FeatureIcon name="personalize" /></span><span className="lp-settings-field"><small>RESPONSE STYLE</small><strong>Shape how Lumen replies</strong></span><span className="lp-settings-chevron">↗</span></div>
                <div className="lp-settings-memory"><span><strong>Memory, with your say</strong><small>Review, edit, or pause anytime</small></span><span className="lp-memory-control"><i /></span></div>
                <div className="lp-settings-foot"><span><i /> YOUR PREFERENCES, YOURS TO CHANGE</span><span>↗</span></div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="lp-section lp-faq" id="faq" aria-labelledby="lp-faq-title">
          <div className="lp-container lp-faq-grid">
            <Reveal className="lp-faq-heading">
              <p className="lp-section-kicker"><span /> GOOD TO KNOW</p>
              <h2 id="lp-faq-title">A few things<br /><span>you might wonder.</span></h2>
              <p>Still curious? Start a conversation and see where it takes you.</p>
              <a className="lp-text-link" href="#app">Ask Lumen <ArrowIcon /></a>
            </Reveal>

            <Reveal className="lp-faq-list" delay={90}>
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaq === index;
                const questionId = `lp-faq-question-${index}`;
                const answerId = `lp-faq-answer-${index}`;

                return (
                  <div className={`lp-faq-item ${isOpen ? 'is-open' : ''}`} key={item.question}>
                    <h3>
                      <button
                        id={questionId}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={answerId}
                        onClick={() => setOpenFaq(isOpen ? -1 : index)}
                      >
                        <span className="lp-faq-number">0{index + 1}</span>
                        <span>{item.question}</span>
                        <i className="lp-faq-toggle" aria-hidden="true" />
                      </button>
                    </h3>
                    <div
                      className="lp-faq-answer"
                      id={answerId}
                      role="region"
                      aria-labelledby={questionId}
                      hidden={!isOpen}
                    >
                      <p>{item.answer}</p>
                    </div>
                  </div>
                );
              })}
            </Reveal>
          </div>
        </section>

        <section className="lp-final-cta" aria-labelledby="lp-final-title">
          <div className="lp-container">
            <Reveal className="lp-final-card">
              <div className="lp-final-glow" aria-hidden="true" />
              <div className="lp-final-mark"><LumenLogo size={82} /></div>
              <p className="lp-section-kicker"><span /> THE NEXT QUESTION IS YOURS</p>
              <h2 id="lp-final-title">Let’s see where<br /><span>your curiosity goes.</span></h2>
              <p className="lp-final-description">A thought, a question, a whole new perspective. Start anywhere.</p>
              <a className="lp-button lp-button--primary" href="#app">
                Talk with Lumen <ArrowIcon />
              </a>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <a className="lp-brand lp-footer-brand" href="#top" aria-label="Lumen AI home">
            <LumenLogo size={30} />
            <span>LUMEN</span>
          </a>
          <p>Ambient intelligence, with room to think.</p>
          <div className="lp-footer-links">
            <a href="#capabilities">Capabilities</a>
            <a href="#faq">FAQ</a>
            <a href="https://github.com/georgieslab/lumen-ai" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
          </div>
          <span className="lp-copyright">© {new Date().getFullYear()} Lumen AI</span>
        </div>
      </footer>
    </div>
  );
}
