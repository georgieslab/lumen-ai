# Lumen AI: capability inventory and agentic roadmap

Reviewed 17 October 2026. This is an analysis and proposal; application code was not changed.

**Assessment:** Lumen already combines a distinctive voice/visual interface, public-web tools, approved research plans, generated pages, and user memory. Its next useful evolution is an ambient mission workspace: a user describes an outcome, Lumen plans and performs bounded work, produces editable artifacts, checks the result, and retains progress across sessions.

The most immediate opportunity is connecting existing product work. Several polished cards and their tested builders are disconnected from the production tool registry.

## What was inspected and verified

- Read the React frontend, Express API, backend services, extension, configuration examples, and tests. Did not inspect private `.env` values.
- `npm test`: **125 passed, 0 failed**.
- `npm run build`: **passed**. Vite warns about a minified JavaScript chunk of roughly **577 kB**, before gzip. This is a bundle-size observation, not a measured performance score.
- Opened the deployed app linked in the README: [Lumen](https://lumen-ai-0cje.onrender.com/). It initially displayed Render's application wake-up page, then loaded the app.
- Inspected the workspace, Explore menu, and Budget Planner form. Submitted the form's generic $3,000 example: it produced a streamed text allocation, **without the implemented BudgetCard**.
- Requested a fictional photography portfolio. Received an editable page brief. Clicking **Cancel** left the brief visible; code inspection identifies its missing callback binding.
- Local Vite and API processes could start, but local HTTP connections were inaccessible in this session. Interactive observations above use the deployment. The deployed asset filename matched the build output; that is consistent with the same frontend bundle, but does not establish backend revision identity.
- Account login/cloud memory, microphone/camera permissions, extension installation, external writes, and every possible provider failure were not exercised. Their availability below is established by code, rather than a complete live acceptance test.

## Capability inventory

“Connected” means a production code path exists. It does not mean every provider-dependent behavior was independently tested live.

| Area | Existing features | State and evidence |
| --- | --- | --- |
| Entry and onboarding | English/German marketing page, `#app` routing, quick-start guide, Explore examples, tried-example tracking | Connected. [main.jsx](C:/Users/georg/georgiescoding/lumen-ai/src/main.jsx:9), [Explore actions](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:1479) |
| Conversation | Typed chat, streamed text, Markdown/tables, copy answer, source links, contextual follow-up prompts, Stop/Escape | Connected. [ConversationFeed](C:/Users/georg/georgiescoding/lumen-ai/src/components/ConversationFeed.jsx:874), [Stop](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:856) |
| Conversation workspace | Floating, draggable, resizable and expandable transcript; search/navigation; local history; clear history | Connected, with account-history clearing defect. [ConversationFeed](C:/Users/georg/georgiescoding/lumen-ai/src/components/ConversationFeed.jsx:1016), [history storage](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:818) |
| Voice input | Browser speech recognition, interim transcript, submit after silence, orb and Spacebar control | Connected. [recognition](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:872). README claims an AWS Transcribe fallback, but no implementation was found. |
| Voice output | Amazon Polly audio, browser speech-synthesis fallback, playback control and reactive visualization | Connected, provider/browser dependent. [playback](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:1271) |
| Voice studio | 19 curated voices, language/gender filters, audition phrase, previews and selection | Connected. [voice modal](C:/Users/georg/georgiescoding/lumen-ai/src/components/LumenVoiceModal.jsx:5) |
| Personalization | Six app languages: English, Spanish, French, German, Japanese, Italian; four tones and four response styles; language-linked default voice | Connected; newer cards/forms contain English-only copy. [preferences](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:63), [language switching](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:467) |
| Ambient identity | State/audio-reactive orb, frequency visualizer, eight aura presets, automatic/manual morning/day/evening/night atmosphere, fullscreen | Connected. [auras](C:/Users/georg/georgiescoding/lumen-ai/src/services/auras.js:6), [ambience](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:590) |
| Workspace positioning | Draggable action pills, weather tile, Persona Card, saved positions | Connected. [action pill](C:/Users/georg/georgiescoding/lumen-ai/src/components/DraggableDesktopPill.jsx:18), [workspace](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:2245) |
| Images and documents | Image/PDF attachments, image downscaling, file drag/drop, multimodal model requests | Connected. [file processing](C:/Users/georg/georgiescoding/lumen-ai/src/services/api.js:58), [input handlers](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:734) |
| Camera and screen | Webcam capture with camera switching; one-frame tab/window/screen capture that stops capture afterward | Connected; not a continuous screen observer. [webcam](C:/Users/georg/georgiescoding/lumen-ai/src/components/WebcamLensModal.jsx:67), [screen capture](C:/Users/georg/georgiescoding/lumen-ai/src/services/tabCapture.js:1) |
| Public-web assistance | Automatic/always/off web setting; heuristic URL reading/search grounding; model-selected search and browse tools; source links | Connected. [grounding](C:/Users/georg/georgiescoding/lumen-ai/services/webSearch.js:371), [tool definitions](C:/Users/georg/georgiescoding/lumen-ai/server.js:486) |
| Decision/research missions | Mission starter; editable questions; page cap; optional one-query adaptive follow-up; approved execution; concurrent search/read; partial failure reporting; synthesis and PDF | Connected and the strongest existing agent workflow. Up to five initial queries and eight pages. [plan limits](C:/Users/georg/georgiescoding/lumen-ai/services/missionPlan.js:5), [runner](C:/Users/georg/georgiescoding/lumen-ai/services/researchRunner.js:41), [endpoint](C:/Users/georg/georgiescoding/lumen-ai/server.js:950) |
| Mission visibility | Search/read/synthesis/PDF stages, tool activity, elapsed time, Stop, compact activity record kept with replies | Connected, but not a durable server-side mission system; tool-result handling is incomplete. [mission state](C:/Users/georg/georgiescoding/lumen-ai/src/services/mission.js:32) |
| Generated HTML | Editable design brief: title, style, colors and elements; build/skip; self-contained generated HTML; isolated preview/window/new tab/download; recent-page follow-ups | Connected. Brief generation verified live; Cancel defect verified. [brief flow](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:993), [page rendering](C:/Users/georg/georgiescoding/lumen-ai/src/components/HtmlPageCard.jsx:5) |
| Weather | Ambient city tile, city search, forecast card, direct weather API and weather tool | Connected. [weather UI](C:/Users/georg/georgiescoding/lumen-ai/src/components/ConversationFeed.jsx:89), [live services](C:/Users/georg/georgiescoding/lumen-ai/services/liveData.js:1) |
| Cryptocurrency | Price cards and market data tool | Connected. The displayed 24-hour curve is synthesized from current/high/low values, rather than actual historical observations. [curve](C:/Users/georg/georgiescoding/lumen-ai/src/components/ConversationFeed.jsx:258) |
| PDFs | Generate documents, preview/download cards, research report PDF, export conversation PDF | Connected. [PDF service](C:/Users/georg/georgiescoding/lumen-ai/services/pdfGenerator.js:1), [export](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:570) |
| Accounts | GitHub OAuth, provider availability checks, signed HttpOnly session cookie, account menu and sign-out | Connected; GitHub sign-in does not provide repository integration. [auth routes](C:/Users/georg/georgiescoding/lumen-ai/server.js:2272), [sessions](C:/Users/georg/georgiescoding/lumen-ai/services/authSession.js:1) |
| Personal memory | DynamoDB profile and memories; text/Markdown/JSON profile upload; editing; manual memory CRUD; automatic memory extraction and pause; save/error notices | Connected and account scoped. Conversations themselves remain browser local. [memory UI](C:/Users/georg/georgiescoding/lumen-ai/src/components/UserMemoryModal.jsx:17), [storage](C:/Users/georg/georgiescoding/lumen-ai/services/userMemory.js:49) |
| Persona and imports | Persona Card generated from saved profile/memories; editable profile context imported through a copy/paste prompt to another AI | Connected; this is user-mediated import, not an external account connector. [persona endpoint](C:/Users/georg/georgiescoding/lumen-ai/server.js:2413), [profile UI](C:/Users/georg/georgiescoding/lumen-ai/src/components/UserMemoryModal.jsx:144) |
| Session portability | Markdown transcript copy, JSON snapshot export/import, conversation PDF | Connected. No shared live collaboration/session backend found. [share modal](C:/Users/georg/georgiescoding/lumen-ai/src/components/WorkspaceShareModal.jsx:18) |
| Browser viewing | Approved URL opening, embedded cross-origin iframe, external-tab fallback; separate **Agent Browse** option submits a URL for reading through chat | Connected. Viewing an iframe alone does not attach its page contents to the model. [modal](C:/Users/georg/georgiescoding/lumen-ai/src/components/AgentActionModal.jsx:293), [Agent Browse](C:/Users/georg/georgiescoding/lumen-ai/src/components/AgentActionModal.jsx:826) |
| Extension context | Explicit active-tab sharing; selection or visible page text, capped at 20,000 characters; shared-tab chip and disconnect; untrusted-content fencing | Connected MVP; read only, snapshot at share time, no click/type/navigation executor. New-tab onboarding may open the landing page rather than the app. [extension](C:/Users/georg/georgiescoding/lumen-ai/extension/popup.js:8), [bridge](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:208) |
| Action presets | Code Analysis, SEO Audit, Daily Brief, Budget Planner, Day Schedule, Open Web Page; forms expose relevant options and construct prompts | Connected launchers, mostly ordinary chat underneath. Code/SEO do not run a repository workflow or measured browser audit. [prompt construction](C:/Users/georg/georgiescoding/lumen-ai/src/components/AgentActionModal.jsx:222), [execution callback](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:2801) |
| Installation | PWA manifest, install prompt, Android/iOS instructions, standalone display | Connected install surface; AI/live data require connectivity; no offline app-shell caching. [install flow](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:689) |
| Diagnostics and feedback | Architecture explainer, API health/ping display, GitHub feedback issue draft | Connected UI. Opening an issue draft does not submit an issue. [diagnostics](C:/Users/georg/georgiescoding/lumen-ai/src/components/TechStackModal.jsx:32), [feedback](C:/Users/georg/georgiescoding/lumen-ai/src/components/FeedbackModal.jsx:37) |

### Implemented components that are not complete product capabilities

| Existing investment | Missing connection |
| --- | --- |
| ChecklistCard and checklist builder | No registered tool produces the widget; completion state is component local. |
| ComparisonCard and decision-matrix builder | No registered tool or production parser invocation creates it from normal chat. |
| ScheduleCard, schedule builder and ICS exporters | No registered tool produces it; completion is ephemeral; exports omit event start/end dates and times. |
| BudgetCard, budget builder and text extractor | No registered tool or production extraction path. The live Budget Planner test returned prose. |
| DailyBriefCard, briefing builder and extractor | UI asks for `create_daily_brief`, but this tool is absent. Empty-data builder also invents fallback news and uses unsupported “Verified Source” labels. |
| Computation service | Arithmetic, loan payments, compound interest and statistics have tests, but the model cannot call this service. |
| Jobs Radar | Role/location controls, search/interview/dossier buttons and card UI exist; no normal backend emission of a jobs widget. Transcript rendering also omits its action callbacks. |
| Extra onboarding/pointer components | `UserOnboarding`, `LiquidGlassPointer`, and `CelestialAstrolabePointer` have no production imports. |

Primary evidence: [tool registry](C:/Users/georg/georgiescoding/lumen-ai/server.js:486), [policy](C:/Users/georg/georgiescoding/lumen-ai/services/toolPolicy.js:7), [widget rendering](C:/Users/georg/georgiescoding/lumen-ai/src/components/ConversationFeed.jsx:1638), [nonexistent briefing tool request](C:/Users/georg/georgiescoding/lumen-ai/src/components/AgentActionModal.jsx:292). The builders/extractors are referenced by their own modules/tests, not the production request flow.

## How agentic Lumen is today

The model has **six callable tools**: `get_live_weather`, `get_crypto_and_market_prices`, `live_web_search`, `browse_web_page`, `call_direct_api`, and `create_pdf_document`.

Ordinary chat combines heuristic grounding with a Bedrock loop limited to **three model turns**. Native tool exposure is currently gated by whether the model ID includes `nova`, and by web mode. Research uses a separate, stronger workflow: approved plan, bounded collection, one optional adaptive gap search, synthesis and PDF.

Memory supplies personal context, while mission execution still belongs to a browser request. There is no durable background job queue, resumable server-side mission, recurring monitor, connector action executor, repository modification workflow, or general browser-action runtime.

This is a useful starting point: tool access, plan approval, visible progress and policy boundaries already exist. More agency requires joining them into one coherent execution model.

## Findings to address first

| Priority | Finding and user impact | Evidence / next action |
| --- | --- | --- |
| High | Advertised structured workflows cannot reliably produce their own cards. | Register typed artifact/computation tools and test the complete prompt → tool → widget path. [registry](C:/Users/georg/georgiescoding/lumen-ai/server.js:486) |
| High | Chat loops mishandle multiple tool calls and can execute a tool on their last turn without a final synthesis turn. | Nonstream uses the first tool block; stream tracks one active block. Handle all calls by ID, reserve final-answer capacity, report budget exhaustion. [nonstream](C:/Users/georg/georgiescoding/lumen-ai/server.js:1397), [stream](C:/Users/georg/georgiescoding/lumen-ai/server.js:1947) |
| High | Provider fallback is not normalized, and transport fallback can repeat work. | Bedrock-format messages pass unchanged to OpenAI; failed streams retry the whole request. Introduce provider adapters and execution idempotency before adding writes. [fallback helper](C:/Users/georg/georgiescoding/lumen-ai/server.js:737), [client retry](C:/Users/georg/georgiescoding/lumen-ai/src/services/api.js:343) |
| High | Core paid-provider endpoints have no corresponding usage middleware. | Add per-user/IP quotas, concurrent-run limits and global spending bounds to chat and voice preview. Existing quota stores are process local. [chat](C:/Users/georg/georgiescoding/lumen-ai/server.js:1145), [stream](C:/Users/georg/georgiescoding/lumen-ai/server.js:1632), [preview](C:/Users/georg/georgiescoding/lumen-ai/server.js:2647) |
| High before broader tools | Public-URL DNS validation and the eventual connection resolve separately. | Existing redirect/private-address checks are useful, but the connection is not pinned to the validated address. Fix the DNS rebinding gap. [validation](C:/Users/georg/georgiescoding/lumen-ai/services/urlGuard.js:95), [fetch](C:/Users/georg/georgiescoding/lumen-ai/services/urlGuard.js:146) |
| Medium | Stop does not consistently stop provider/tool/memory work. | Thread one cancellation signal and deadline through grounding, tools, fallback, speech and memory; recheck immediately before writes. [tool execution](C:/Users/georg/georgiescoding/lumen-ai/server.js:603), [chat invocation](C:/Users/georg/georgiescoding/lumen-ai/server.js:2023) |
| Medium | Brief Cancel is broken. | App passes the prop, ConversationFeed omits its binding, then references it. Add the binding and a UI acceptance check. [caller](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:2580), [props](C:/Users/georg/georgiescoding/lumen-ai/src/components/ConversationFeed.jsx:884), [reference](C:/Users/georg/georgiescoding/lumen-ai/src/components/ConversationFeed.jsx:1611) |
| Medium | Signed-in Clear History can restore cleared messages after reload. | It removes the guest key rather than the current account key. [account keys](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:75), [clear](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:1387) |
| Medium | Tool-result UI and stream failure semantics are incomplete. | Client does not route `onToolResult`; missing `done` fabricates completion; double failure can be swallowed; shared-page context is dropped on fallback. [stream client](C:/Users/georg/georgiescoding/lumen-ai/src/services/api.js:212), [completion/fallback](C:/Users/georg/georgiescoding/lumen-ai/src/services/api.js:334) |
| Medium | Generated HTML is described as having no network, but allows arbitrary HTTPS images/styles/fonts. | Opaque-origin isolation protects Lumen storage, while permitted GET requests can still transmit data included in generated pages. Restrict resource hosts or embed assets; verify in a browser. [CSP](C:/Users/georg/georgiescoding/lumen-ai/src/services/htmlPage.js:42) |
| Medium | Some visualizations/fallbacks overstate the evidence. | Replace synthetic price curves with real observations or clear illustrative labels; remove fabricated briefing defaults and unsupported verification labels. [crypto](C:/Users/georg/georgiescoding/lumen-ai/src/components/ConversationFeed.jsx:258), [brief defaults](C:/Users/georg/georgiescoding/lumen-ai/services/dailyBrief.js:60) |
| Medium | Schedule exports do not contain the actual schedule. | Add real dates, start/end timestamps, timezone handling and ICS escaping. [export](C:/Users/georg/georgiescoding/lumen-ai/src/components/ScheduleCard.jsx:65) |
| Foundational | Useful state is too short-lived for sustained work. | Save only 15 messages; send eight text messages; checked items and artifact changes do not reach the model. Store mission/artifact state and retrieve context intentionally. [persistence](C:/Users/georg/georgiescoding/lumen-ai/src/App.jsx:820), [request history](C:/Users/georg/georgiescoding/lumen-ai/src/services/api.js:239) |

Additional code-level improvements: web mode off should filter only web tools rather than disabling local PDF tools; replace English-only research/page intent regexes with localized explicit actions or structured routing; retrieve memory by relevance and actual timestamps rather than UUID ordering and a fixed text prefix; balance research sources across approved questions and validate that citations support report claims.

## Product ideas, in a practical order

### 1. Make existing cards into real working objects

Register `create_checklist`, `create_comparison`, `create_schedule`, `create_budget`, `create_daily_brief`, and `compute` behind one shared schema/tool registry. Have the same registry drive model definitions, validation, policy, events and card rendering.

Persist card edits. A checked task stays checked after reload, an edited budget recomputes its total, and Lumen sees the current artifact when asked to revise it. Remove sample/fabricated news defaults before wiring briefing generation.

**User example:** “Compare these three options, calculate the full cost, and make a checklist for the winner.” This should produce linked artifacts, not several unrelated prose replies.

### 2. Introduce persistent missions

Give each mission an objective, constraints, success criteria, approved capabilities, budget, status, checkpoints, evidence and artifacts. Support pause, resume, retry failed steps and cancellation. Keep completed tool outputs so reconnecting does not redo successful work.

Suggested execution shape: `objective → plan → execute → verify → revise if needed → deliver`. Replanning remains within the approved scope; broader scope or consequential actions become explicit checkpoints.

**User example:** “Continue the comparison from yesterday, using the same requirements.”

### 3. Turn research into decision support

Reuse the approved research runner to collect evidence for specific decision criteria. Track publication/access dates, domain diversity, unanswered questions, source contradictions, and the connection between claims and citations. Separate observed facts, calculations and model judgments.

**User example:** “Which option best fits these requirements, and what evidence could change that recommendation?” The output can include a comparison, sourced rationale and the remaining unknowns.

### 4. Add a small set of approved external actions

Start with concrete drafts: calendar events, GitHub issues, email drafts or document updates. Show the actual fields/diff before a write. Bind approval to the signed-in user, exact action arguments, expiry and an idempotency key; persist the action result before retrying.

Use scoped connectors rather than a generic unrestricted POST tool. Current GitHub sign-in is identity only; repository work needs a separate authorization and integration.

**User example:** “Find a free slot and prepare the event.” Calendar availability can be read within scope; creating the event uses a reviewable action card.

### 5. Add project memory and an evidence library

Separate personal preferences from project requirements and temporary research evidence. Store source/file references, provenance, timestamps and user corrections. Retrieve relevant items, show which context was used, and propagate deletion.

**User example:** “Use our launch brief and last week's customer research.” The mission should not depend on those materials appearing in the last eight messages.

### 6. Make Daily Brief and Jobs Radar proactive

Save an explicitly scoped topic or job-search mission, schedule checks, deduplicate results, and compare with the last run. Notify on meaningful new findings or an action requiring attention. Offer a pause control and visible last-checked/source timestamps.

This requires a scheduler/worker and persistent run store; a browser timer or open SSE response will not supply background reliability.

### 7. Give code and SEO presets real executors

- **Code review mission:** obtain authorized repository/file context, inspect related files, produce actionable findings and a reviewable patch, run permitted checks in an isolated worker, summarize validation.
- **Website improvement mission:** fetch the page, inspect title/headings/metadata/links, run measured accessibility/performance checks in a browser worker, capture evidence, then produce a prioritized fix list or patch.

Both should distinguish measured findings from model suggestions and require a clear write path before applying changes.

### 8. Make shared visual context useful across a mission

Keep a clearly indicated snapshot or selected-page context attached to a task. Offer explicit refresh and show when the context was captured. Explain whether Lumen is viewing pixels, reading extracted text, or using a connector.

If browser actions are added later, introduce scoped tab access, visible proposed actions, confirmation for consequential steps and post-action verification. The current extension supplies read-only context, not that executor.

### 9. Let voice steer active work

Extend the orb's role to the active mission: “Pause,” “Use only official sources,” “Change the budget,” “Explain the last action,” or “Resume when I approve.” Reuse the visible mission state so spoken control and the task UI stay synchronized.

### 10. Unify discovery around outcomes

Use one mission launcher with a few clear recipes—Research & Compare, Plan My Day, Build a Page, Review Code, Improve a Website. Let the main workspace show active work, outputs and checkpoints, while the orb remains the recognizable voice/status control.

In the observed viewport, floating action pills and the weather tile overlapped the conversation. A dock or side rail plus responsive layout rules would make longer missions easier to follow. Mobile needs its own acceptance pass before a final layout decision.

## Recommended first milestone

**Ship a complete planning mission using the work already present.**

Example input: “Plan a three-day conference trip to Berlin under €1,500. Compare options, make a budget, a dated itinerary and a checklist.” This is an illustrative product scenario, not a claim about current prices or a current capability.

Acceptance criteria:

1. Lumen captures missing dates and meaningful constraints, then shows the bounded plan.
2. Research records real sources with freshness and clear uncertainty; budget totals come from deterministic computation.
3. Comparison, budget, schedule and checklist are linked editable artifacts in the same mission.
4. The mission and artifact edits survive reload; reconnecting does not repeat completed operations.
5. Dates/timezones are explicit and exported calendar data contains actual start/end timestamps.
6. Stop reaches in-flight work. Failed steps stay visibly failed/retryable and do not appear completed.
7. No booking or external write occurs without the relevant scoped action approval.

This milestone exercises the core agent capabilities while reusing Lumen's existing visual, research and artifact components.

## Suggested implementation sequence

| Stage | Deliverable | Completion evidence |
| --- | --- | --- |
| Connect and repair | Wire artifact/computation tools; repair Cancel/history/stream handling; remove invented data; fix calendar export | End-to-end checks demonstrate every exposed action reaches its advertised result |
| One execution engine | Shared provider adapters, all tool blocks, typed events/results, budgets, cancellation, explicit completion and verification | Tests cover final-turn tool calls, partial failures, cancellation, provider fallback and retry deduplication |
| Durable missions | User-scoped run/step/artifact/evidence store; worker queue; resumable event stream | Refresh/reconnect and worker restart preserve progress and do not replay completed effects |
| Authorized action | One narrowly scoped connector and concrete action preview | Approved payload executes once; changed/expired approval is rejected; result recorded |
| Background missions | Scheduler, source/result diffs, deduplication, meaningful-change notifications | A mission completes with the browser closed, resumes after worker failure and stays quiet on unchanged results |

Suggested records: `Project`, `Mission`, `Step`, `ToolCall`, `ArtifactVersion`, `Evidence`, `Approval`, `Schedule`. A tool definition should declare schemas, effect type, required scope, timeout/cancellation support, idempotency behavior and verification method.

Refactor the duplicated streaming/nonstreaming orchestration into the shared engine as part of that work. Keep HTTP/SSE as delivery adapters. Model selection should use declared provider/model capabilities instead of matching `nova` in a string. Avoid a general unrestricted execution tool as the first integration.

## Quality measures

Measure mission completion against observable success criteria, artifact validity, supported citations, arithmetic correctness, latency/cost per completed mission, recovery after interruption and duplicate external-action rate. Keep a small scenario evaluation set, including conflicting requirements, missing source data, malicious webpage instructions, provider timeouts, declined approval and reconnecting during execution.

The passing 125 tests establish useful behavior for pure builders, plans, URL guards and bounded research. They do not establish complete endpoint behavior, browser enforcement, account isolation, provider compatibility or mission success. Add targeted integration and browser checks as those paths are connected.

## External architecture references

These support the proposed patterns; feature and bug findings above come from this repository and the observed app.

- [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) describes composable workflows, environment feedback, evaluation loops and explicit stopping conditions. The proposal applies those patterns incrementally to Lumen.
- [Temporal: Durable human-in-the-loop research workflow](https://learn.temporal.io/tutorials/ai/building-durable-ai-applications/human-in-the-loop/) demonstrates keeping workflow state while waiting for human input. It is a reference for the persistence requirement, not a recommendation to adopt Temporal before evaluating operational needs.
