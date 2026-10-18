<p align="center">
  <img src="./public/share-cover.png" alt="Lumen AI — Your ambient AI companion" width="100%" />
</p>

<h1 align="center">Lumen AI</h1>

<p align="center">
  <strong>Voice, vision, research, and bounded Decision Missions—in one thoughtful AI copilot.</strong><br />
  Work through questions with clear plans, visible progress, and checkpoints you approve. Your saved context stays reviewable and under your control.
</p>

<p align="center">
  <a href="https://lumen-ai-0cje.onrender.com/">Open the live Lumen experience</a> ·
  <a href="#features">Explore features</a> ·
  <a href="#run-locally">Run it locally</a> ·
  <a href="#browser-tab-sharing-extension-mvp">Share a tab</a> ·
  <a href="#configuration">Configure providers</a>
</p>

<p align="center">
  <img alt="Node.js 20+" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white" />
  <img alt="React 18" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" />
  <img alt="Vite 6" src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" />
  <img alt="Manifest V3 extension" src="https://img.shields.io/badge/Browser_extension-Manifest_V3-4285F4?logo=googlechrome&logoColor=white" />
</p>

Lumen is a voice- and vision-enabled AI copilot built with React, Vite, and Express. Have a spoken conversation, inspect an image, PDF, or one-time screen snapshot, research the web, or bring in a page by explicitly sharing its text.

The public landing page is at `/`. Open the existing copilot with **Talk with Lumen** or go directly to `/#app`; the hash route works on static hosts without server-side routing.

## Features

- **🎙️ Voice conversation:** speak with Lumen using browser speech recognition in supported browsers. Amazon Polly neural voices are used when configured, with browser speech synthesis available for audio output.
- **🖼️ Image, PDF, and screen analysis:** attach a photo or PDF, or share a one-time screenshot of a tab, window, or screen, then ask Lumen to inspect it.
- **🔎 Web research:** request sourced research reports; Lumen searches and reads public web pages, then can create a downloadable PDF.
- **🧭 Adaptive decision missions:** give Lumen a research goal, review its plan, then choose whether it may run one targeted follow-up search after checking the first-pass evidence. The extra read stays within the approved page limit; the query and progress remain visible, and you can cancel. Missions are bounded research workflows, not unrestricted browser control.
- **💾 Persistent text missions:** ordinary text and shared-page requests keep their goal, context, tool results, and checkpoints on the server. Pause, resume, cancel, reconnect, or reopen recent work from **Missions**. Closing the browser leaves queued/running work on the server; unfinished work pauses after a server restart. Completed tool calls are reused when resuming.
- **🗂️ Your desk:** **Plan my day** turns priorities and unfinished tasks into a dated schedule and checklist. **Decision desk** compares named options against your criteria using live sources. **Verify this** creates claim-by-claim evidence cards; citations must have appeared in successful research during that mission, with page-read versus search-result provenance visible.
- **◫ A desktop you control:** separate draggable action pills keep your preferred tools at hand. Use the **Customize desktop** icon (also in Settings) to show/hide pills and Persona/weather, enable older shortcuts, or restore default positions. Hover or focus a pill to hide it with ×. Preferences stay saved in this browser; hidden tools remain available in **Explore**. Smaller screens replace floating pills and widgets with a spatial glass **Tools** window: grouped everyday actions, local search across all 13 tools, and an **All tools** view. Its background stays locked while the window is open, and keyboard focus returns when it closes.
- **🔔 Watch this:** monitor extracted public-page text or a topic’s search-result links and titles every 15 minutes, 1 hour, 6 hours, or 24 hours. Changes produce in-app alerts with before/after excerpts. Checks run while the server is online, retain their last good baseline on failure, and resume their saved schedule after restart. Pause, resume, check now, edit, or archive watches.
- **📁 Project spaces:** keep instructions, plain text reference files (TXT/MD/CSV/JSON), recent missions, and pinned outputs together in a spatial glass workspace. Desktop uses a project sidebar; phones use a horizontal picker and stacked details. Project conversations are scoped separately from personal work. New text missions receive the selected project’s preferences and bounded file excerpts. PDF/image attachments continue to use the existing attachment flow.
- **🌦️ Live information:** ask about weather or cryptocurrency prices to show interactive data cards.
- **📋 Interactive planning:** create checklist, comparison, schedule, budget, and sourced daily briefing cards, and use deterministic computation for calculations. Checklist and schedule completion is saved with the conversation in this browser and included in bounded context for later turns. Dated schedules export valid `.ics` files; missing dates, end times, or time zones are explained before export.
- **🛠️ Bounded tool use:** Bedrock and the OpenAI fallback share a validated tool registry and a runner limited to six tool rounds and twelve tool calls, followed by a final answer attempt. Resuming a persistent mission keeps the same total tool budget. Stop/Escape pauses persistent text work; image/PDF and approved research requests remain request-scoped and Stop cancels those requests.
- **🧠 Personalization, memory, and Persona Card:** choose a response tone and style, upload a text/Markdown/JSON profile, import reviewed context from another AI with a copy-and-paste prompt, and manage cloud-synced memories. Create a grounded Persona Card from your saved profile and memories. Automatic memory can be paused; saved items can be reviewed, edited, or deleted.
- **🔐 Sign-in:** authenticate with GitHub. The server verifies the OAuth session; repository access is not requested.
- **✨ Conversation tools:** use prompt starters, choose a voice and language, export a conversation, and adjust the visual theme. A dismissible quick-start guide points out the sphere, chat, Explore examples, and attachments on first visit.
- **💬 Compact conversation workspace:** switch between Chat, editable Tasks, and an expandable Outputs index. Progress stays visible while long requests, response details, sources, and tool activity stay expandable. Search, copy, PDF/calendar exports, resizing, and mission controls remain available. Scrolling back to read no longer forces the conversation to the bottom on each update; **Latest** returns to the newest work.
- **📲 Installable PWA:** install Lumen on Android from a supported browser, or add it to the iPhone/iPad Home Screen from Safari. The app needs an internet connection for AI and live-data features.

AI responses and cloud-backed features require valid provider credentials. See [Configuration](#configuration).

The first agentic implementation connects planning cards to actual tools; [Milestone 1](docs/agentic-milestone-1.md) records that slice. [Milestone 2](docs/agentic-milestone-2.md) adds durable text missions, checkpoints, and recovery. [Milestone 3](docs/agentic-milestone-3.md) adds the five desk actions, project context, evidence review, and recurring read-only watches. External actions/connectors, push/email delivery, and editable budgets remain future work.

## Requirements

- Node.js 20 or later
- npm 8 or later
- AWS credentials with access to the configured Amazon Bedrock model, or a server-side OpenAI API key for the fallback

The OpenAI fallback supports text, images, and the same registered tools. Its current adapter explicitly rejects document attachments; PDF analysis requires a document-capable Bedrock model. Amazon Polly credentials enable neural audio; without them, browser speech synthesis may be used.

## Run locally

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a `.env` file in the project root. Start from `.env.example` and fill in the credentials you want to use.

3. Start both the Vite frontend and Express API:

   ```sh
   npm run dev:all
   ```

4. Open [http://localhost:5173](http://localhost:5173).

`npm run dev` starts only the frontend. For chat and other API features during development, the backend must also be running; `npm run dev:all` starts both processes.

Try these in the copilot:

- “Create a €1,500 trip budget: lodging €900, rail €300, food €200, local transport €100. Show the budget card.”
- “Create an interactive travel checklist: book lodging, reserve rail tickets, pack a charger, and download the conference pass.”
- “Create a schedule for 2026-11-03 in Europe/Vienna: planning 09:00–10:00 and team review 10:15–11:00. Include the dates and end times for calendar export.”

Run the automated checks after changes:

```sh
npm test
npm run build
```

## Install on mobile

Lumen is a Progressive Web App and can be installed from its secure production URL (or `localhost` during development). On Android, open Lumen in a supported browser and use the install prompt or the browser menu. On iPhone or iPad, open Lumen in Safari, tap **Share**, then choose **Add to Home Screen**. iOS does not expose the Android-style install prompt to websites.

The installed app opens in a standalone window. AI conversations and live data still require an internet connection; offline app-shell caching is not enabled.

## Configuration

The backend loads `.env` at startup. Common variables:

| Variable | Purpose |
| --- | --- |
| `PORT` | Express API port; defaults to `3000`. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS credentials for Bedrock and Polly. Use a session token too when using temporary credentials. |
| `AWS_SESSION_TOKEN` | Optional AWS session token for temporary credentials. |
| `AWS_REGION` | Bedrock region; defaults to `eu-north-1`. |
| `BEDROCK_MODEL_ID` | Optional Bedrock model override. |
| `POLLY_REGION` | Polly region; defaults to `eu-west-1`. |
| `OPENAI_API_KEY` | Optional server-side OpenAI fallback key. |
| `OPENAI_MODEL` | Optional OpenAI chat fallback model override. |
| `LUMEN_CHAT_PER_HOUR` | Chat requests per visitor per hour; defaults to `60`, shared by standard and streaming chat. |
| `LUMEN_MISSION_STORE_DIR` | Private directory for durable mission JSON records. Defaults to `.lumen-data/missions` under the server directory; mount persistent storage and run a single server process in production. |
| `LUMEN_VOICE_PREVIEWS_PER_HOUR` | Voice previews per visitor per hour; defaults to `30`. |
| `GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth App client ID, configured on the API server. |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth App secret. Server-side only; never use a `VITE_` prefix. |
| `GITHUB_OAUTH_CALLBACK_URL` | Callback URL registered in the GitHub OAuth App. |
| `LUMEN_APP_URL` | Frontend URL to return to after GitHub sign-in. |
| `LUMEN_SESSION_SECRET` | Random secret of at least 32 characters used to sign HttpOnly session cookies. |
| `LUMEN_MEMORY_TABLE_NAME` | DynamoDB table used for profile and memory records. |
| `LUMEN_ALLOWED_ORIGINS` | Comma-separated frontend origins allowed to call the API with session cookies. |
| `LUMEN_CROSS_SITE_COOKIES` | Set to `true` only when the frontend and API are on different sites; requires HTTPS. |

Keep credentials in the server-side `.env` file. Do not commit `.env` or put private API keys in `VITE_*` variables, which are exposed to browser builds.

Request-scoped chat has a 120-second abort deadline. A persistent mission has 120 seconds per active attempt/resume; reaching that deadline pauses it at its latest saved checkpoint. Resuming retains the original total six-round/twelve-call budget. The mission worker allows two active runs globally and one per owner; the private store caps each owner at 100 records and each record at 8 MiB. Hourly limits use the signed-in account or visitor IP address, are kept in memory per server instance, and reset when the server restarts.

### Persistent mission ownership and storage

Signed-in missions belong to the verified account. Guests use a server-issued HttpOnly owner cookie with a 30-day lifetime; a cookie-only bootstrap completes before any mission is created so recovery can reuse the same owner and request ID. Repeating creation with the same owner, request ID, and input returns the original mission. Keeping the same browser hostname matters for guest access. Losing the guest cookie loses access to that owner's saved missions; signing in does not migrate guest missions automatically.

Mission records contain private request text, bounded conversation history, shared-page text when supplied, loaded profile/memory context, tool results, and generated outputs. The browser also retains conversation messages and the exact pending mission request until its creation is confirmed. Clearing conversation history disconnects its views and removes that browser history; it does not delete or cancel saved server missions. See [Milestone 2](docs/agentic-milestone-2.md) for lifecycle and deployment details.

### GitHub sign-in and cloud memory setup

1. Create a GitHub OAuth App. Set its client ID in `GITHUB_OAUTH_CLIENT_ID`, keep its secret in `GITHUB_OAUTH_CLIENT_SECRET`, and register the exact `GITHUB_OAUTH_CALLBACK_URL`. Set `LUMEN_APP_URL` to the browser-facing app URL. For local development, these URLs and the browser hostname must agree (for example, use `localhost` consistently rather than mixing it with `127.0.0.1`). The GitHub button checks the API's provider status and explains when server-side OAuth configuration is missing.
2. Generate a session secret, for example:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

   Store the output in `LUMEN_SESSION_SECRET`. The session cookie is HttpOnly and signed by the server.
3. Create the DynamoDB table with string partition key `userId` and string sort key `recordId`. For example, using the AWS CLI:

   ```sh
   aws dynamodb create-table --table-name lumen-user-memory --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=recordId,AttributeType=S --key-schema AttributeName=userId,KeyType=HASH AttributeName=recordId,KeyType=RANGE --billing-mode PAY_PER_REQUEST
   ```

   Set `LUMEN_MEMORY_TABLE_NAME` to the table name and grant the server's IAM role only the required `GetItem`, `PutItem`, `UpdateItem`, `Query`, `DeleteItem`, and `BatchWriteItem` permissions on that table. DynamoDB encryption at rest is enabled by default; use TLS and a least-privilege IAM role in production.
4. Set `LUMEN_ALLOWED_ORIGINS` for production deployments when the frontend and API are cross-origin. When they are on different sites, set `LUMEN_CROSS_SITE_COOKIES=true` and serve both over HTTPS.

GitHub accounts are stored under provider-qualified user IDs, and account linking is not currently supported. Lumen stores profile and memory records in DynamoDB. The conversation transcript and card completion edits remain in browser storage; persistent text missions also save bounded request history, loaded profile/memory context, checkpoints, and results in the private server mission directory. Profile and memory context is sent to the configured AI provider with chat and research requests. Automatic memory is designed to retain useful, non-sensitive text-chat details; it uses an additional AI request per text chat and can be paused. Inspect, edit, or delete stored items in the account menu. Uploaded image/PDF attachments are not used for automatic memory extraction. The optional import-from-another-AI feature only shares content when the user copies the prompt to another assistant; pasted replies remain in the editable profile and are not saved until **Save profile** is selected. Avoid storing secrets or highly sensitive information in the profile or memories.

## Browser tab sharing (extension MVP)

The [extension/](extension) folder holds a Manifest V3 extension (Chrome, Edge, Brave, Firefox 128+) that lets you explicitly share the tab you are viewing with Lumen.

**Setup**
1. Run Lumen (`npm run dev:all`) and open it once.
2. Chrome/Edge: open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, select `extension/`. Firefox: open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, select `extension/manifest.json`.
3. On the tab you want to share, click the extension icon, set your Lumen URL (default `http://localhost:5173`), and click **Share this tab**. Approve the one-time permission prompt for the Lumen origin.
4. A "Sharing tab" chip appears in Lumen; ask questions about the page. Click **Stop** (in Lumen or the popup) to end sharing.

**Safety model**
- Nothing is read until you click Share; it uses `activeTab`, so only that tab is accessible. Your text selection is shared if present, otherwise the page's visible text (max 20,000 characters, no form field values).
- The text is sent with each message while the chip is shown, and is treated by the server as untrusted data, not instructions.
- Persistent text missions save the supplied page context on the server for recovery. The browser retains the exact pending request until creation is confirmed; stopping sharing only removes the page from future requests.
- The MVP is read-only: it cannot click, type, or navigate. Any future action execution must show an explicit per-action approval.

### For end users (no developer mode)

- **No install:** in Lumen, tap **+** and choose **Share a tab or window (snapshot)**. Your browser's own picker asks which tab to share; Lumen captures one image frame, stops the capture immediately, and attaches it so you can ask about it. It reads pixels only and cannot click or type.
- **Extension (richer, text-based):** regular users install it from the Chrome Web Store / Edge Add-ons once it is published. To publish, zip the *contents* of `extension/` (for example `Compress-Archive -Path extension\* -DestinationPath lumen-tab-share.zip`), upload it in the Chrome Web Store Developer Dashboard and the Microsoft Partner Center (a developer account is required; Chrome charges a one-time fee), and set the production Lumen URL as the popup default in `extension/popup.js` before zipping. The store listing needs a privacy statement explaining that shared text accompanies requests while sharing is active and is retained in private server mission records for persistent text work; pending requests can also remain in browser storage.
**Verify:** `npm test` covers the server-side page-context fencing; `npm run build` checks the frontend.

**Limitations:** a snapshot is taken at share time (click Share again to refresh); restricted pages (`chrome://`, store pages, PDFs viewers) can't be read; Firefox may close the popup on the permission prompt (click Share again). Shared-page text is retained in persistent mission input and any pending browser request; it is not automatically promoted into a saved profile or memory item. Clearing the chat or stopping sharing does not remove existing server mission records.
## Production

Build the frontend, then start the Express server:

```sh
npm run build
npm start
```

The server serves the built frontend and API from the configured port (default `3000`).

Mount a private persistent volume at `LUMEN_MISSION_STORE_DIR` (for example `/var/data/lumen/missions`) before enabling persistent missions in production. The default local JSON store supports one server process per directory; it does not coordinate multiple replicas or processes. An ephemeral filesystem loses saved missions on redeployment. Keep the directory outside the served frontend, exclude it from source control, restrict filesystem access, and include it in the deployment's private backup/retention policy. Scheduled wakeups and external action connectors are not part of this worker.

## Troubleshooting

### Lumen does not reply

In development, check that both processes are running. Use `npm run dev:all`, then open [http://localhost:3000/api/health](http://localhost:3000/api/health). A healthy server returns JSON with `"status":"ok"`. If the API is unreachable, restart the backend and check its terminal output.

If the health endpoint works but chat still fails, check that the configured Bedrock model is available in the selected AWS region and that the AWS credentials have permission to invoke it. If using the OpenAI fallback, check `OPENAI_API_KEY` on the server.

### Voice input does not work

Allow microphone access and use a browser that supports the Web Speech API, such as current Chrome or Edge. You can still type messages if voice recognition is unavailable.

### Image or PDF analysis fails

Check the backend terminal for provider errors and confirm provider access is configured. The OpenAI fallback adapter supports images but rejects PDFs explicitly; use a document-capable Bedrock model for PDFs. The health endpoint reports whether AWS credentials were detected; it does not validate that those credentials have model permissions.

## Project layout

```text
src/
  components/       React UI components, including the sphere, conversation feed, and profile/memory controls
  hooks/            Shared React hooks
  services/api.js   Frontend client for the Express API
  utils/            Translations and shared utilities
  App.jsx           Main application and interaction flow
  App.css           Application styling
server.js           Express API and AI-provider integration
services/           Tool registry/runner, planning artifacts, auth, memory, web search, live data, and PDF services
vite.config.js      Vite development server and API proxy
```

## License

This project is distributed under the MIT License. See [LICENSE](LICENSE).
