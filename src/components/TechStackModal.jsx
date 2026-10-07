import React, { useState, useEffect } from 'react';
import { getTranslations } from '../utils/translations';

export default function TechStackModal({
  isOpen,
  onClose,
  activeLanguage = 'en-US',
  activeVoice = 'Joanna'
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [telemetry, setTelemetry] = useState(null);
  const [pingLatency, setPingLatency] = useState(null);
  const [isPinging, setIsPinging] = useState(false);
  const [pingError, setPingError] = useState(null);

  const t = getTranslations(activeLanguage).techStackModal || {
    badge: "ENGINEERING BLUEPRINT",
    title: "System Architecture & Tech Stack",
    subtitle: "Explore the cloud topology, frontier model pipelines, real-time streaming, and spatial client architecture powering Lumen AI.",
    flowchartTitle: "End-to-End System Data Flow",
    flowchartSubtitle: "Interactive topology connecting client SPA, Express edge gateway, Amazon Bedrock, Polly, and zero-key live services.",
    tabOverview: "Architecture Flowchart",
    tabLlm: "Amazon Bedrock Nova",
    tabSpeech: "Amazon Polly (19 Voices)",
    tabVision: "Multimodal Vision & PDF",
    tabLiveData: "Open-Meteo & Web Grounding",
    tabVisualizer: "Web Audio Visualizer",
    tabTelemetry: "Health & Ping Diagnostics",
    closeBtn: "Close Blueprint"
  };

  const fetchHealthTelemetry = async () => {
    setIsPinging(true);
    setPingError(null);
    const startTime = performance.now();
    try {
      const res = await fetch('/api/health');
      const endTime = performance.now();
      setPingLatency(Math.round(endTime - startTime));
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      } else {
        setPingError(`HTTP Error: ${res.status}`);
      }
    } catch (err) {
      setPingError(err.message || 'Network unreachable');
    } finally {
      setIsPinging(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealthTelemetry();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="tech-modal-backdrop animate-fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div className="tech-modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="tech-modal-header">
          <div>
            <div className="tech-modal-badge">
              <span className="badge-glow-dot"></span>
              <span>{t.badge}</span>
            </div>
            <h2 className="tech-modal-title">{t.title}</h2>
            <p className="tech-modal-subtitle">{t.subtitle}</p>
          </div>
          <button 
            type="button" 
            className="tech-modal-close-btn" 
            onClick={onClose} 
            title="Close modal"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Quick KPI Bar */}
        <div className="tech-kpi-bar">
          <div className="tech-kpi-item">
            <span className="kpi-icon">⚡</span>
            <div className="kpi-info">
              <span className="kpi-title">Core AI Engine</span>
              <span className="kpi-val highlight-cyan">Amazon Bedrock Nova</span>
            </div>
          </div>
          <div className="tech-kpi-item">
            <span className="kpi-icon">🎙️</span>
            <div className="kpi-info">
              <span className="kpi-title">Speech Engine</span>
              <span className="kpi-val highlight-purple">Amazon Polly Neural</span>
            </div>
          </div>
          <div className="tech-kpi-item">
            <span className="kpi-icon">📐</span>
            <div className="kpi-info">
              <span className="kpi-title">Canvas Downscaling</span>
              <span className="kpi-val highlight-green">640px / ~25KB JPEG</span>
            </div>
          </div>
          <div className="tech-kpi-item">
            <span className="kpi-icon">🛡️</span>
            <div className="kpi-info">
              <span className="kpi-title">Security Guard</span>
              <span className="kpi-val highlight-amber">SSRF RFC 1918 Block</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="tech-tab-nav">
          <button
            type="button"
            className={`tech-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            {t.tabOverview}
          </button>
          <button
            type="button"
            className={`tech-tab-btn ${activeTab === 'llm' ? 'active' : ''}`}
            onClick={() => setActiveTab('llm')}
          >
            {t.tabLlm}
          </button>
          <button
            type="button"
            className={`tech-tab-btn ${activeTab === 'speech' ? 'active' : ''}`}
            onClick={() => setActiveTab('speech')}
          >
            {t.tabSpeech}
          </button>
          <button
            type="button"
            className={`tech-tab-btn ${activeTab === 'vision' ? 'active' : ''}`}
            onClick={() => setActiveTab('vision')}
          >
            {t.tabVision}
          </button>
          <button
            type="button"
            className={`tech-tab-btn ${activeTab === 'livedata' ? 'active' : ''}`}
            onClick={() => setActiveTab('livedata')}
          >
            {t.tabLiveData}
          </button>
          <button
            type="button"
            className={`tech-tab-btn ${activeTab === 'visualizer' ? 'active' : ''}`}
            onClick={() => setActiveTab('visualizer')}
          >
            {t.tabVisualizer}
          </button>
          <button
            type="button"
            className={`tech-tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
            onClick={() => setActiveTab('telemetry')}
          >
            {t.tabTelemetry}
          </button>
          <button
            type="button"
            className={`tech-tab-btn ${activeTab === 'news' ? 'active' : ''}`}
            onClick={() => setActiveTab('news')}
          >
            📰 What's New
          </button>
        </div>

        {/* Tab Body */}
        <div className="tech-tab-body">
          {/* TAB 1: OVERVIEW / FLOWCHART */}
          {activeTab === 'overview' && (
            <div className="tech-flowchart-section animate-fade-in">
              <div className="tech-section-header">
                <h3>{t.flowchartTitle}</h3>
                <p>{t.flowchartSubtitle}</p>
              </div>

              <div className="tech-diagram-container">
                {/* TIER 1: CLIENT SPA */}
                <div className="tech-diagram-tier tier-client">
                  <div className="tier-header">
                    <span className="tier-badge">CLIENT TIER</span>
                    <h4>Frontend Single Page Application (React 18 & visionOS UI)</h4>
                  </div>
                  <div className="tier-cards-grid">
                    <div className="diagram-card">
                      <div className="card-top">
                        <span className="card-icon">🎙️</span>
                        <span className="card-tag">Web Speech API</span>
                      </div>
                      <h5>Real-Time Voice Dictation</h5>
                      <p>Hardware speech recognizer with continuous silence detection and auto-dispatch.</p>
                    </div>

                    <div className="diagram-card">
                      <div className="card-top">
                        <span className="card-icon">📷</span>
                        <span className="card-tag">HTML5 Canvas</span>
                      </div>
                      <h5>Client-Side Downscaling</h5>
                      <p>Downscales phone camera photos to <code>640px / ~25KB</code> before dispatching over the wire.</p>
                    </div>

                    <div className="diagram-card">
                      <div className="card-top">
                        <span className="card-icon">🔮</span>
                        <span className="card-tag">Web Audio API</span>
                      </div>
                      <h5>3D Ambient Particle Sphere</h5>
                      <p>300 orbital nodes pulsating in exact sync with acoustic frequency energy.</p>
                    </div>
                  </div>
                </div>

                {/* CONNECTOR HUB 1 */}
                <div className="diagram-connector-hub">
                  <div className="connector-line">
                    <span className="pulse-dot"></span>
                    <span className="connector-label">HTTP POST /api/converse/stream (Base64 JPEG / PDF Payload & Audio Stream)</span>
                  </div>
                  <div className="connector-line reverse">
                    <span className="pulse-dot"></span>
                    <span className="connector-label">SSE Token Streaming & Amazon Polly MP3 Audio Stream</span>
                  </div>
                </div>

                {/* TIER 2: EXPRESS EDGE GATEWAY */}
                <div className="tech-diagram-tier tier-gateway">
                  <div className="tier-header">
                    <span className="tier-badge">EDGE BACKEND</span>
                    <h4>Node.js Express Server & Proxy Pipeline</h4>
                  </div>
                  <div className="tier-cards-grid">
                    <div className="diagram-card">
                      <div className="card-top">
                        <span className="card-icon">🛡️</span>
                        <span className="card-tag">Security Guard</span>
                      </div>
                      <h5>SSRF Protection Engine</h5>
                      <p>Blocks private networks, localhost loopback, and cloud metadata (<code>169.254.169.254</code>).</p>
                    </div>

                    <div className="diagram-card">
                      <div className="card-top">
                        <span className="card-icon">⚡</span>
                        <span className="card-tag">SSE Protocol</span>
                      </div>
                      <h5>Real-Time Token Streaming</h5>
                      <p>Filters internal Nova <code>&lt;thinking&gt;...&lt;/thinking&gt;</code> tokens on the fly.</p>
                    </div>

                    <div className="diagram-card">
                      <div className="card-top">
                        <span className="card-icon">📄</span>
                        <span className="card-tag">pdf-lib</span>
                      </div>
                      <h5>PDF Document Compiler</h5>
                      <p>Generates downloadable styled PDF briefs with executive summaries and sections.</p>
                    </div>
                  </div>
                </div>

                {/* CONNECTOR HUB 2 */}
                <div className="diagram-connector-hub">
                  <div className="connector-line">
                    <span className="pulse-dot"></span>
                    <span className="connector-label">AWS Bedrock Converse API + Amazon Polly Neural Cluster</span>
                  </div>
                </div>

                {/* TIER 3: CLOUD & FRONTIER AI */}
                <div className="tech-diagram-tier tier-cloud">
                  <div className="tier-header">
                    <span className="tier-badge">CLOUD & FRONTIER AI</span>
                    <h4>Amazon Bedrock, Polly & Live Zero-Key Services</h4>
                  </div>
                  <div className="tier-cards-grid">
                    <div className="diagram-card">
                      <div className="card-top">
                        <span className="card-icon">🧠</span>
                        <span className="card-tag">Amazon Bedrock</span>
                      </div>
                      <h5>Nova Multimodal Intelligence</h5>
                      <p>Autonomous tool calling (Weather, Crypto, Search, PDF) with multi-turn loop and fallback cascade.</p>
                    </div>

                    <div className="diagram-card">
                      <div className="card-top">
                        <span className="card-icon">🗣️</span>
                        <span className="card-tag">Amazon Polly</span>
                      </div>
                      <h5>19 Neural Voice Personas</h5>
                      <p>Multilingual speech engine deployed in eu-west-1 Ireland across 6 distinct languages.</p>
                    </div>

                    <div className="diagram-card">
                      <div className="card-top">
                        <span className="card-icon">🌐</span>
                        <span className="card-tag">Zero-Key Data</span>
                      </div>
                      <h5>Open-Meteo & Binance APIs</h5>
                      <p>Live global weather geocoding and real-time financial market ticker streams.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AMAZON BEDROCK NOVA */}
          {activeTab === 'llm' && (
            <div className="tech-detail-section animate-fade-in">
              <div className="detail-hero">
                <span className="detail-hero-icon">🧠</span>
                <div className="detail-hero-text">
                  <h3>Amazon Bedrock Converse API & Autonomous Tools</h3>
                  <p>
                    Lumen uses AWS Bedrock's next-generation <code>ConverseCommand</code> and <code>ConverseStreamCommand</code> architecture with Amazon Nova models. It supports native tool execution, strict JSON schema validation, and multi-turn autonomous tool resolution loops.
                  </p>
                </div>
              </div>

              <div className="tech-specs-grid">
                <div className="spec-card">
                  <h4>Target Model ID</h4>
                  <div className="spec-value"><code>amazon.nova-lite-v1:0</code></div>
                  <p className="spec-desc">High-speed multimodal foundation model with native document & image parsing.</p>
                </div>

                <div className="spec-card">
                  <h4>Tool Calling Protocol</h4>
                  <div className="spec-value">toolConfig JSON Schema</div>
                  <p className="spec-desc">Autonomous tool invocation with client parameter verification and multi-turn loops.</p>
                </div>

                <div className="spec-card">
                  <h4>Failover Cascade</h4>
                  <div className="spec-value">Nova Lite ➔ Nova Pro ➔ OpenAI Direct</div>
                  <p className="spec-desc">Automatic multi-engine fallback ensuring 99.9% conversation availability.</p>
                </div>

                <div className="spec-card">
                  <h4>Stream Filtering</h4>
                  <div className="spec-value">Regex Chain-of-Thought Stripper</div>
                  <p className="spec-desc">Hides internal <code>&lt;thinking&gt;</code> markers from user transcript in real time.</p>
                </div>
              </div>

              <div className="tech-code-box">
                <div className="code-box-title">Autonomous Bedrock Tool Schema Sample</div>
                <pre>{`{
  "toolSpec": {
    "name": "get_live_weather",
    "description": "Get current real-time weather and forecast for any city or location worldwide",
    "inputSchema": {
      "json": {
        "type": "object",
        "properties": { "city": { "type": "string" } },
        "required": ["city"]
      }
    }
  }
}`}</pre>
              </div>
            </div>
          )}

          {/* TAB 3: AMAZON POLLY */}
          {activeTab === 'speech' && (
            <div className="tech-detail-section animate-fade-in">
              <div className="detail-hero">
                <span className="detail-hero-icon">🎙️</span>
                <div className="detail-hero-text">
                  <h3>Amazon Polly Neural Engine (19 Personas)</h3>
                  <p>
                    High-definition vocal synthesis deployed on AWS Polly's neural voice cluster in Ireland (<code>eu-west-1</code>). Features natural conversational cadences, multilingual multi-accent personas, and real-time speech sanitization.
                  </p>
                </div>
              </div>

              <div className="tech-voice-matrix">
                <h4>Supported Multilingual Vocal Catalog</h4>
                <div className="voice-matrix-grid">
                  <div className="matrix-item">🇺🇸 <span>US English:</span> Joanna, Matthew, Ruth, Stephen, Danielle, Gregory</div>
                  <div className="matrix-item">🇬🇧 <span>UK English:</span> Amy, Arthur</div>
                  <div className="matrix-item">🇦🇺 <span>Australian:</span> Olivia</div>
                  <div className="matrix-item">🇩🇪 <span>Deutsch:</span> Vicki, Daniel</div>
                  <div className="matrix-item">🇫🇷 <span>Français:</span> Léa, Rémi</div>
                  <div className="matrix-item">🇪🇸 <span>Español:</span> Lucía, Sergio</div>
                  <div className="matrix-item">🇮🇹 <span>Italiano:</span> Bianca, Adriano</div>
                  <div className="matrix-item">🇯🇵 <span>日本語:</span> Kazuha, Takumi</div>
                </div>
              </div>

              <div className="tech-specs-grid">
                <div className="spec-card">
                  <h4>Active Selected Voice</h4>
                  <div className="spec-value highlight-purple">{activeVoice}</div>
                  <p className="spec-desc">Vocal persona synced with selected language and natural language intent switching.</p>
                </div>

                <div className="spec-card">
                  <h4>Speech Optimization</h4>
                  <div className="spec-value">Regex Pre-processing</div>
                  <p className="spec-desc">Strips markdown, raw URLs, and code blocks before dispatch to ensure natural speech cadence.</p>
                </div>

                <div className="spec-card">
                  <h4>Delivery Format</h4>
                  <div className="spec-value">MP3 (Base64 Stream)</div>
                  <p className="spec-desc">Low-latency buffer delivery with browser Web Speech API fallback.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VISION & MULTIMODAL */}
          {activeTab === 'vision' && (
            <div className="tech-detail-section animate-fade-in">
              <div className="detail-hero">
                <span className="detail-hero-icon">📷</span>
                <div className="detail-hero-text">
                  <h3>Client-Side Canvas Downscaling & Document Inspection</h3>
                  <p>
                    High-performance multimodal pipeline capable of processing user photos, receipts, architecture diagrams, handwritten notes, and full multi-page PDF documents.
                  </p>
                </div>
              </div>

              <div className="tech-specs-grid">
                <div className="spec-card">
                  <h4>HTML5 Canvas Compression</h4>
                  <div className="spec-value">640px Max Dimension</div>
                  <p className="spec-desc">Converts multi-megabyte photos to ~25KB JPEG payloads, cutting upload latency by ~40%.</p>
                </div>

                <div className="spec-card">
                  <h4>Native PDF Ingestion</h4>
                  <div className="spec-value">Amazon Nova PDF Parser</div>
                  <p className="spec-desc">Direct PDF ingestion up to 100 pages for resume review, study briefs, and document analysis.</p>
                </div>

                <div className="spec-card">
                  <h4>Spatial Webcam Aperture</h4>
                  <div className="spec-value">Live Frame Grabber</div>
                  <p className="spec-desc">Webcam snapshot modal with front camera mirroring and instant compression.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: WHAT'S NEW */}
          {activeTab === 'news' && (
            <div className="tech-detail-section animate-fade-in">
              <div className="detail-hero">
                <span className="detail-hero-icon">📰</span>
                <div className="detail-hero-text">
                  <h3>What's New in Lumen</h3>
                  <p>Lumen can now work with web pages, always with your approval before anything opens.</p>
                </div>
              </div>

              <div className="tech-specs-grid">
                <div className="spec-card">
                  <h4>Open web page</h4>
                  <div className="spec-value">Your click is the approval</div>
                  <p className="spec-desc">Type an address and the page opens inside Lumen. Links Lumen suggests appear as an approval card first.</p>
                </div>

                <div className="spec-card">
                  <h4>Share a tab</h4>
                  <div className="spec-value">Snapshot or read-only extension</div>
                  <p className="spec-desc">Use + → Share a tab or window, or the Chrome/Edge extension, so Lumen can read the page. It never clicks or types for you.</p>
                </div>

                <div className="spec-card">
                  <h4>Lumen writes web pages</h4>
                  <div className="spec-value">Runs in a sandbox</div>
                  <p className="spec-desc">Ask for a page, button or animation. It opens in a square window over the orb, with preview, new tab and download.</p>
                </div>

                <div className="spec-card">
                  <h4>Copy any answer</h4>
                  <div className="spec-value">One-click ⧉ Copy</div>
                  <p className="spec-desc">Every finished Lumen answer has a copy button in its header.</p>
                </div>

                <div className="spec-card">
                  <h4>Longer answers</h4>
                  <div className="spec-value">3× output limit</div>
                  <p className="spec-desc">Replies and generated pages are no longer cut off mid-way.</p>
                </div>

                <div className="spec-card">
                  <h4>Weather tile</h4>
                  <div className="spec-value">Bigger, with ⚙ Change city</div>
                  <p className="spec-desc">Pick any city from the tile's settings button.</p>
                </div>
              </div>
            </div>
          )}
          {/* TAB 5: LIVE DATA & GROUNDING */}
          {activeTab === 'livedata' && (
            <div className="tech-detail-section animate-fade-in">
              <div className="detail-hero">
                <span className="detail-hero-icon">⚡</span>
                <div className="detail-hero-text">
                  <h3>Live Weather, Financial Markets & SSRF-Protected Web</h3>
                  <p>
                    Zero-setup, high-reliability live data layer operating without costly third-party API keys, protected by strict server-side request forgery (SSRF) guards.
                  </p>
                </div>
              </div>

              <div className="tech-specs-grid">
                <div className="spec-card">
                  <h4>Global Weather</h4>
                  <div className="spec-value">Open-Meteo Geocoding</div>
                  <p className="spec-desc">Population-weighted geocoding disambiguation with WMO condition codes and 3-day forecast.</p>
                </div>

                <div className="spec-card">
                  <h4>Crypto & Markets</h4>
                  <div className="spec-value">CoinGecko & Binance</div>
                  <p className="spec-desc">Real-time prices, 24h gain/loss, high/low ranges, and SVG intraday trend sparklines.</p>
                </div>

                <div className="spec-card">
                  <h4>SSRF Guard Engine</h4>
                  <div className="spec-value">RFC 1918 & Cloud Metadata Guard</div>
                  <p className="spec-desc">Blocks localhost, private IP subnets, and cloud instance metadata (169.254.169.254).</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: WEB AUDIO VISUALIZER */}
          {activeTab === 'visualizer' && (
            <div className="tech-detail-section animate-fade-in">
              <div className="detail-hero">
                <span className="detail-hero-icon">📊</span>
                <div className="detail-hero-text">
                  <h3>Real Web Audio API Frequency Analysis</h3>
                  <p>
                    Custom React hook (<code>useAudioVisualizer</code>) interfacing directly with the browser's hardware <code>AudioContext</code> and <code>AnalyserNode</code>.
                  </p>
                </div>
              </div>

              <div className="tech-specs-grid">
                <div className="spec-card">
                  <h4>FFT Analysis Size</h4>
                  <div className="spec-value">64 Frequency Bins</div>
                  <p className="spec-desc">Smoothing constant 0.8 with logarithmic loudness compensation for natural human speech.</p>
                </div>

                <div className="spec-card">
                  <h4>Equalizer Waveform</h4>
                  <div className="spec-value">8 Reactive Frequency Bars</div>
                  <p className="spec-desc">Sub-band grouping mapped to CSS dynamic heights and opacity transitions.</p>
                </div>

                <div className="spec-card">
                  <h4>3D Particle Scene</h4>
                  <div className="spec-value">300 Spheroid Nodes</div>
                  <p className="spec-desc">Hardware-accelerated CSS 3D spherical projection responding to vocal acoustic energy.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: TELEMETRY & HEALTH */}
          {activeTab === 'telemetry' && (
            <div className="tech-detail-section animate-fade-in">
              <div className="telemetry-action-bar">
                <button
                  type="button"
                  className="telemetry-ping-btn"
                  onClick={fetchHealthTelemetry}
                  disabled={isPinging}
                >
                  {isPinging ? 'Pinging Gateway...' : '🔄 Ping Edge Gateway'}
                </button>
                {pingLatency !== null && (
                  <span className="telemetry-latency-badge">
                    Latency: <strong>{pingLatency} ms</strong> (Round-Trip)
                  </span>
                )}
              </div>

              {pingError && (
                <div className="telemetry-error-banner">
                  ⚠️ {pingError}
                </div>
              )}

              <div className="telemetry-results-grid">
                <div className="telemetry-card">
                  <span className="t-label">SERVICE NAME</span>
                  <span className="t-val">{telemetry?.service || 'Lumen AI Copilot'}</span>
                </div>
                <div className="telemetry-card">
                  <span className="t-label">GATEWAY STATUS</span>
                  <span className="t-val highlight-green">{telemetry?.status?.toUpperCase() || 'OK'}</span>
                </div>
                <div className="telemetry-card">
                  <span className="t-label">ACTIVE LLM MODEL</span>
                  <span className="t-val highlight-cyan">{telemetry?.llmModel || 'amazon.nova-lite-v1:0'}</span>
                </div>
                <div className="telemetry-card">
                  <span className="t-label">AWS BEDROCK STATUS</span>
                  <span className={`t-val ${telemetry?.bedrockConfigured ? 'highlight-green' : 'highlight-amber'}`}>
                    {telemetry?.bedrockConfigured ? 'Connected (IAM Verified)' : 'Simulated / Direct API'}
                  </span>
                </div>
                <div className="telemetry-card">
                  <span className="t-label">SPEECH SYNTHESIS</span>
                  <span className="t-val">{telemetry?.speechEngine || 'Amazon Polly Neural (19 personas)'}</span>
                </div>
                <div className="telemetry-card">
                  <span className="t-label">CURRENT VOICE</span>
                  <span className="t-val highlight-purple">{activeVoice}</span>
                </div>
                <div className="telemetry-card">
                  <span className="t-label">CLOUD REGION</span>
                  <span className="t-val">{telemetry?.region || 'eu-north-1 / eu-west-1'}</span>
                </div>
                <div className="telemetry-card">
                  <span className="t-label">RUNTIME NODE</span>
                  <span className="t-val">{telemetry?.nodeVersion || 'v20.x'}</span>
                </div>
                <div className="telemetry-card">
                  <span className="t-label">SERVER UPTIME</span>
                  <span className="t-val">
                    {telemetry?.uptimeSeconds ? `${Math.floor(telemetry.uptimeSeconds / 60)}m ${telemetry.uptimeSeconds % 60}s` : 'Active'}
                  </span>
                </div>
                <div className="telemetry-card">
                  <span className="t-label">BEDROCK TOOLS</span>
                  <span className="t-val">{telemetry?.toolsAvailable ? `${telemetry.toolsAvailable.length} Registered Tools` : '6 Registered Tools'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="tech-modal-footer">
          <div className="tech-footer-meta">
            <span>Built with precision by <strong>Georgie Akopashvili</strong></span>
            <span>•</span>
            <span>Apple visionOS Liquid Glass Design System</span>
          </div>
          <button type="button" className="tech-footer-close-btn" onClick={onClose}>
            {t.closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

