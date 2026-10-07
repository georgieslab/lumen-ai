import React, { useEffect, useRef, useState } from 'react';
import LumenLogo from './LumenLogo.jsx';
import { LANDING_COPY, LANDING_LANGUAGES, detectLandingLanguage, saveLandingLanguage } from './landingCopy.js';
import './LandingPage.css';

const MODE_IDS = ['voice', 'vision', 'research'];
const FEATURE_META = [
  { id: 'voice', number: '01', icon: 'voice', mode: 'voice' },
  { id: 'vision', number: '02', icon: 'vision', mode: 'vision' },
  { id: 'research', number: '03', icon: 'research', mode: 'research' },
  { id: 'personalize', number: '04', icon: 'personalize', mode: null }
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

function FeatureArtwork({ type, coverUrl, t }) {
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
        <div className="lp-feature-report">{t.art.research} <span>↗</span></div>
      </div>
    );
  }

  return (
    <div className="lp-feature-art lp-feature-art--personalize" aria-hidden="true">
      <div className="lp-mini-setting"><span>{t.art.voice}</span><strong>{t.art.voiceName}</strong><span className="lp-setting-chevron">⌄</span></div>
      <div className="lp-mini-setting"><span>{t.art.replyStyle}</span><strong>{t.art.replyStyleName}</strong><span className="lp-setting-chevron">⌄</span></div>
      <div className="lp-mini-setting lp-mini-setting--memory"><span>{t.art.memoryControls}</span><span className="lp-mini-switch"><i /></span></div>
    </div>
  );
}

function ModeArtwork({ mode, coverUrl, t }) {
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
        <span className="lp-mode-caption"><i /> {t.art.conversation}</span>
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
          <div><strong>{t.art.yourContext}</strong><span>{t.art.imageOrPdf}</span></div>
          <span className="lp-context-plus">+</span>
        </div>
        <span className="lp-context-tag">{t.art.askAbout}</span>
      </div>
    );
  }

  return (
    <div className="lp-mode-art lp-mode-art--research" aria-hidden="true">
      <div className="lp-research-window">
        <div className="lp-research-window-head">
          <span className="lp-window-dot" /><span className="lp-window-dot" /><span className="lp-window-dot" />
          <span>{t.art.researchNotes}</span>
        </div>
        <div className="lp-research-query"><FeatureIcon name="research" /><span>{t.art.exploreQuestion}</span><span className="lp-query-arrow">↗</span></div>
        <div className="lp-research-source">
          <span className="lp-source-index">01</span>
          <span className="lp-research-lines"><i /><i /><i /></span>
          <span className="lp-source-status">{t.art.source}</span>
        </div>
        <div className="lp-research-source lp-research-source--second">
          <span className="lp-source-index">02</span>
          <span className="lp-research-lines"><i /><i /><i /></span>
          <span className="lp-source-status">{t.art.source}</span>
        </div>
        <div className="lp-research-export"><span className="lp-export-icon">PDF</span><span><strong>{t.art.report}</strong><small>{t.art.reportSub}</small></span><span className="lp-export-arrow">↗</span></div>
      </div>
      <div className="lp-research-spark">✦</div>
    </div>
  );
}

export default function LandingPage() {
  const [activeMode, setActiveMode] = useState('voice');
  const [openFaq, setOpenFaq] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lang, setLang] = useState(detectLandingLanguage);
  const t = LANDING_COPY[lang];
  const heroVisualRef = useRef(null);
  const coverUrl = `${import.meta.env.BASE_URL}share-cover.png`;
  const demoModes = MODE_IDS.map((id, index) => ({ id, icon: id, ...t.modes[index] }));
  const features = FEATURE_META.map((meta, index) => ({ ...meta, ...t.features[index] }));
  const selectedMode = demoModes.find((mode) => mode.id === activeMode) || demoModes[0];

  useEffect(() => {
    document.documentElement.lang = t.htmlLang;
  }, [t.htmlLang]);

  const changeLanguage = (next) => {
    setLang(next);
    saveLandingLanguage(next);
  };

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

      <a className="lp-skip-link" href="#main-content">{t.skip}</a>

      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <a className="lp-brand" href="#top" aria-label={t.homeLabel} onClick={closeMenu}>
            <LumenLogo size={36} />
            <span>LUMEN</span>
          </a>

          <nav id="lp-primary-nav" className={`lp-nav-links ${menuOpen ? 'is-open' : ''}`} aria-label={t.navLabel}>
            <a href="#capabilities" onClick={closeMenu}>{t.nav.capabilities}</a>
            <a href="#experience" onClick={closeMenu}>{t.nav.experience}</a>
            <a href="#faq" onClick={closeMenu}>{t.nav.faq}</a>
            <a className="lp-mobile-cta" href="#app" onClick={closeMenu}>
              {t.openCopilot} <ArrowIcon />
            </a>
          </nav>

          <div className="lp-header-actions">
            <div className="lp-lang-switch" role="group" aria-label={t.langLabel}>
              {LANDING_LANGUAGES.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={lang === code ? 'is-active' : ''}
                  aria-pressed={lang === code}
                  lang={code}
                  onClick={() => changeLanguage(code)}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
            <a className="lp-header-cta" href="#app">
              {t.openLumen} <ArrowIcon />
            </a>
            <button
              className={`lp-menu-toggle ${menuOpen ? 'is-open' : ''}`}
              type="button"
              aria-label={menuOpen ? t.menuClose : t.menuOpen}
              aria-expanded={menuOpen}
              aria-controls="lp-primary-nav"
              onClick={() => setMenuOpen((isOpen) => !isOpen)}
            >
              <span /><span /><span />
              <i>{menuOpen ? t.menuCloseShort : t.menuOpenShort}</i>
            </button>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <div className="lp-container lp-hero-grid">
            <Reveal className="lp-hero-copy">
              <div className="lp-eyebrow"><span className="lp-eyebrow-dot" /> {t.hero.eyebrow}</div>
              <h1 id="lp-hero-title">{t.hero.title1}<br />{t.hero.title2}<span>{t.hero.title3}</span></h1>
              <p className="lp-hero-intro">
                {t.hero.intro}
              </p>
              <div className="lp-hero-actions">
                <a className="lp-button lp-button--primary" href="#app">
                  {t.hero.primary} <ArrowIcon />
                </a>
                <a className="lp-button lp-button--quiet" href="#capabilities">
                  {t.hero.quiet} <span className="lp-down-arrow">↓</span>
                </a>
              </div>
              <div className="lp-hero-note">
                <span className="lp-note-stars" aria-hidden="true">✦</span>
                <span>{t.hero.note}</span>
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
                  alt={t.hero.coverAlt}
                  fetchPriority="high"
                  decoding="async"
                />
                <span className="lp-hero-orbit lp-hero-orbit--one" aria-hidden="true" />
                <span className="lp-hero-orbit lp-hero-orbit--two" aria-hidden="true" />
                <div className="lp-float-card lp-float-card--voice" aria-hidden="true">
                  <span className="lp-float-icon"><FeatureIcon name="voice" /></span>
                  <span className="lp-float-copy"><strong>{t.hero.cardVoiceTitle}</strong><small>{t.hero.cardVoiceSub}</small></span>
                  <span className="lp-float-live"><i /></span>
                </div>
                <div className="lp-float-card lp-float-card--vision" aria-hidden="true">
                  <span className="lp-float-spark">✦</span>
                  <span className="lp-float-copy"><strong>{t.hero.cardVisionTitle}</strong><small>{t.hero.cardVisionSub}</small></span>
                </div>
              </figure>
              <figcaption className="lp-art-caption">
                <span><i /> {t.hero.caption}</span>
                <span className="lp-art-index">LUMEN / 001</span>
              </figcaption>
            </Reveal>
          </div>
          <a className="lp-scroll-cue" href="#capabilities" aria-label={t.hero.scrollLabel}>
            <span>{t.hero.scroll}</span><i />
          </a>
        </section>

        <section className="lp-signal-strip" aria-label={t.signal.aria}>
          <div className="lp-container lp-signal-inner">
            <span className="lp-signal-label">{t.signal.label}</span>
            <div className="lp-signal-items">
              <span><FeatureIcon name="voice" /> {t.signal.voice}</span>
              <i />
              <span><FeatureIcon name="vision" /> {t.signal.vision}</span>
              <i />
              <span><FeatureIcon name="research" /> {t.signal.research}</span>
              <i />
              <span><FeatureIcon name="personalize" /> {t.signal.pace}</span>
            </div>
          </div>
        </section>

        <section className="lp-section lp-capabilities" id="capabilities" aria-labelledby="lp-capabilities-title">
          <div className="lp-container">
            <Reveal className="lp-section-heading">
              <div>
                <p className="lp-section-kicker"><span /> {t.capabilities.kicker}</p>
                <h2 id="lp-capabilities-title">{t.capabilities.title1}<br /><span>{t.capabilities.title2}</span></h2>
              </div>
              <p className="lp-section-intro">
                {t.capabilities.intro}
              </p>
            </Reveal>

            <div className="lp-feature-grid">
              {features.map((feature, index) => (
                <Reveal
                  key={feature.id}
                  className={`lp-feature-card lp-feature-card--${feature.id}`}
                  delay={(index % 2) * 90}
                >
                  <article>
                    <div className="lp-feature-topline">
                      <span>{feature.number} <i /> {t.capabilities.topline}</span>
                      <FeatureIcon name={feature.icon} className="lp-feature-icon" />
                    </div>
                    <div className="lp-feature-copy">
                      <h3>{feature.title}</h3>
                      <p>{feature.detail}</p>
                    </div>
                    <FeatureArtwork type={feature.id} coverUrl={coverUrl} t={t} />
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
              <p className="lp-section-kicker"><span /> {t.experience.kicker}</p>
              <h2 id="lp-experience-title">{t.experience.title1}<br /><span>{t.experience.title2}</span></h2>
              <p>{t.experience.intro}</p>
            </Reveal>

            <Reveal className="lp-experience-grid" delay={90}>
              <div className="lp-mode-picker" role="group" aria-label={t.experience.pickerLabel}>
                {demoModes.map((mode, index) => (
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
                  <p>{t.experience.note}</p>
                </div>
              </div>

              <div className={`lp-mode-panel lp-mode-panel--${selectedMode.id}`} role="region" aria-label={`${selectedMode.label} ${t.experience.previewSuffix}`} aria-live="polite">
                <div className="lp-mode-copy">
                  <span className="lp-mode-eyebrow"><i /> {selectedMode.eyebrow}</span>
                  <h3>{selectedMode.title}</h3>
                  <p>{selectedMode.detail}</p>
                  <div className="lp-example-question">
                    <span>{t.experience.exampleLabel}</span>
                    <p>{selectedMode.question}</p>
                    <ArrowIcon />
                  </div>
                </div>
                <ModeArtwork mode={selectedMode.id} coverUrl={coverUrl} t={t} />
                <div className="lp-preview-disclaimer">{t.experience.disclaimer}</div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="lp-section lp-personalization" aria-labelledby="lp-personal-title">
          <div className="lp-container">
            <Reveal className="lp-personal-card">
              <div className="lp-personal-copy">
                <p className="lp-section-kicker"><span /> {t.personal.kicker}</p>
                <h2 id="lp-personal-title">{t.personal.title1}<br />{t.personal.title2}</h2>
                <p>
                  {t.personal.body}
                </p>
                <a className="lp-text-link" href="#app">{t.personal.link} <ArrowIcon /></a>
              </div>
              <div className="lp-settings-preview" aria-hidden="true">
                <div className="lp-settings-head"><span className="lp-settings-spark">✦</span><span>{t.personal.head}</span><span className="lp-settings-dots">•••</span></div>
                <div className="lp-settings-row"><span className="lp-settings-row-icon"><FeatureIcon name="voice" /></span><span className="lp-settings-field"><small>{t.personal.voiceLabel}</small><strong>{t.personal.voiceText}</strong></span><span className="lp-settings-chevron">↗</span></div>
                <div className="lp-settings-row"><span className="lp-settings-row-icon"><FeatureIcon name="personalize" /></span><span className="lp-settings-field"><small>{t.personal.styleLabel}</small><strong>{t.personal.styleText}</strong></span><span className="lp-settings-chevron">↗</span></div>
                <div className="lp-settings-memory"><span><strong>{t.personal.memoryTitle}</strong><small>{t.personal.memorySub}</small></span><span className="lp-memory-control"><i /></span></div>
                <div className="lp-settings-foot"><span><i /> {t.personal.foot}</span><span>↗</span></div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="lp-section lp-faq" id="faq" aria-labelledby="lp-faq-title">
          <div className="lp-container lp-faq-grid">
            <Reveal className="lp-faq-heading">
              <p className="lp-section-kicker"><span /> {t.faq.kicker}</p>
              <h2 id="lp-faq-title">{t.faq.title1}<br /><span>{t.faq.title2}</span></h2>
              <p>{t.faq.intro}</p>
              <a className="lp-text-link" href="#app">{t.faq.link} <ArrowIcon /></a>
            </Reveal>

            <Reveal className="lp-faq-list" delay={90}>
              {t.faq.items.map((item, index) => {
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
              <p className="lp-section-kicker"><span /> {t.final.kicker}</p>
              <h2 id="lp-final-title">{t.final.title1}<br /><span>{t.final.title2}</span></h2>
              <p className="lp-final-description">{t.final.body}</p>
              <a className="lp-button lp-button--primary" href="#app">
                {t.final.cta} <ArrowIcon />
              </a>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <a className="lp-brand lp-footer-brand" href="#top" aria-label={t.homeLabel}>
            <LumenLogo size={30} />
            <span>LUMEN</span>
          </a>
          <p>{t.footer.tagline}</p>
          <div className="lp-footer-links">
            <a href="#capabilities">{t.nav.capabilities}</a>
            <a href="#faq">{t.nav.faq}</a>
            <a href="https://github.com/georgieslab/lumen-ai" target="_blank" rel="noopener noreferrer">{t.footer.github} <span aria-hidden="true">↗</span></a>
          </div>
          <span className="lp-copyright">© {new Date().getFullYear()} Lumen AI</span>
        </div>
      </footer>
    </div>
  );
}
