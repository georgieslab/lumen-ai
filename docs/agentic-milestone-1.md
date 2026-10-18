# Agentic milestone 1: connected planning tools

Implemented 17 October 2026. This first slice connects planning cards to the chat tool loop and preserves useful work in the conversation. The [original audit](agentic-audit-2026-10-17.md) is a historical review and roadmap; its findings describe the app before these changes.

## What is implemented

The shared registry now exposes six additional tools alongside weather, cryptocurrency prices, public web search, webpage reading, public API GET, and PDF creation:

| Tool | Result |
| --- | --- |
| `create_checklist` | Interactive checklist with concrete tasks and completion state. |
| `create_comparison` | Comparison card with named options, explicit criteria, and a recommendation. |
| `create_schedule` | Timeline card with optional explicit dates, times, and time zones. |
| `create_budget` | Budget card with an explicit spending cap, deterministic allocation totals, currency, and unallocated balance. |
| `create_daily_brief` | Briefing card with supplied source links; links alone do not claim verification. |
| `compute` | Safe arithmetic, statistics, loan, and compound-growth calculations. |

Artifact calls are validated before their builders run. Invalid inputs return a tool error so the model can correct them. Empty inputs no longer create fabricated sample budgets, comparisons, schedules, or briefing stories.

Budget calls must carry the exact supplied cap. Allocations above that cap are rejected before a card is created, with an error the model can use to revise its allocation. Interactive planning requests remain in chat rather than being routed to the HTML page builder merely because they use the word “interactive.”

Both standard chat and streamed chat use the same request-scoped runner for Bedrock and OpenAI. Each run allows up to six tool rounds and twelve tool calls, then a final answer attempt with tools disabled. Multiple tool requests are collected separately and their results are returned under the corresponding call IDs. Only registered tools available for that request may execute; turning web access off removes web tools while preserving local planning tools.

Streaming shows tool activity and cards as they arrive. A failed or truncated response remains incomplete; it does not claim successful completion. Previously received cards stay in the conversation. Provider fallback is allowed before visible output or tool execution, avoiding a second run after work has started. Stop cancels the request and prevents fallback from restarting it.

## Persistence and calendar export

Checklist and schedule checkboxes update the widget stored inside the conversation. Reloading restores their state in the same browser. The final stream snapshot preserves checkbox edits made while an answer is still arriving. Later turns receive bounded summaries of checklist, schedule, budget, and comparison cards, including completion state. This is browser-local conversation persistence; it does not provide durable background execution or synchronize conversation history between devices.

Schedule export uses the shared calendar service. Supported inputs include:

- A schedule `date` in `YYYY-MM-DD`, an IANA `timeZone` such as `Europe/Vienna`, and event `time`/`endTime` clock values.
- Event `date`, `endDate`, and `timeZone` overrides for multi-day plans.
- Explicit event `start`/`end` ISO timestamps with UTC offsets or `Z`.

Exports contain real UTC `DTSTART` and `DTEND` values, escaped text, and folded UTF-8 content lines. No date, end time, or time zone is invented. Invalid dates, reversed intervals, nonexistent DST times, and repeated local hours disable export and explain how to correct the schedule. An explicit ISO offset can resolve a repeated local hour.

## Providers and request limits

The OpenAI fallback adapter supports text, inline images, function tool calls, and JSON tool results. It rejects document attachments explicitly rather than omitting them from context. PDF analysis needs a document-capable Bedrock model. The adapter follows the [official OpenAI Chat Completions schema](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).

Keep `OPENAI_API_KEY` on the server. The server retains legacy compatibility with `VITE_OPENAI_API_KEY`, but new configuration must not use that prefix because Vite exposes those variables to browser builds.

| Limit | Default | Configuration |
| --- | --- | --- |
| Chat requests | 60 per visitor per hour across standard and streaming chat | `LUMEN_CHAT_PER_HOUR` |
| Voice previews | 30 per visitor per hour | `LUMEN_VOICE_PREVIEWS_PER_HOUR` |
| Chat request deadline | 120 seconds | Request-scoped abort deadline in the server |
| Tool budget | Six rounds, twelve calls, then a final answer attempt | Shared runner defaults |

Hourly quotas use the signed-in user or visitor IP address. Counters are held in memory per server instance and reset on restart. Provider and supported network calls receive the request abort signal.

Voice input uses browser speech recognition. Amazon Polly and browser speech synthesis provide audio output; an AWS Transcribe input fallback is not implemented.

## Try and verify

Run `npm run dev:all`, open the copilot, and try:

1. “Create a €1,500 trip budget: lodging €900, rail €300, food €200, local transport €100. Show the budget card.” Check that a budget card appears and the allocation total is €1,500.
2. “Create an interactive travel checklist: book lodging, reserve rail tickets, pack a charger, and download the conference pass.” Check an item, reload, and ask which items remain.
3. “Create a schedule for 2026-11-03 in Europe/Vienna: planning 09:00–10:00 and team review 10:15–11:00. Include dates and end times for calendar export.” Export the calendar and inspect or import its event times. Repeat with an undated routine and confirm export explains the missing dates.

Automated checks:

```sh
npm test
npm run build
```

The tests cover artifact validation and calculations, bounded multi-tool runs, tool/result message conversion, cancellation, incomplete streams, persisted artifact updates, and calendar dates, time zones, DST, escaping, and line folding. Provider credentials and browser behavior still require manual checks; automated success does not establish that every live integration was exercised.

Manual browser verification on 17 October 2026:

- One request created a €300 budget, a clearly hypothetical Train/Car comparison, a two-item checklist, and a dated Vienna schedule through four actual tool calls.
- The budget retained the €300 cap and showed €300 allocated, €0 unallocated.
- Checklist and schedule completion survived reload; a later reply correctly named the still-incomplete checklist item and event.
- The actual downloaded `.ics` contained UTC starts at 07:00 and 08:00 for the supplied 09:00 and 10:00 Vienna events on 18 October 2026, with their supplied 30-minute durations.
- Design-brief Cancel replaced the brief with a cancellation notice. Browser console inspection found no errors in the verified final planning flow.
- The local build and test suite passed. Full cloud memory, every provider fallback, and background execution were not exercised live.

## Remaining work

Durable missions, background scheduling, pause/resume across server restarts, external actions and connectors, budget editing, and project memory are not implemented in this slice. Generated cards are not yet linked into a durable mission graph. A useful next acceptance case is one trip-planning request producing a sourced comparison, calculated budget, dated itinerary, and checklist with consistent shared constraints.
