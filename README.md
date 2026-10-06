# Lumen AI

Lumen is a voice- and vision-enabled AI copilot built with React, Vite, and an Express API. Its interface combines a conversational sphere with tools for voice chat, image and PDF analysis, web research, live weather, and PDF generation.

## Features

- **Voice conversation:** speak with Lumen using browser speech recognition, with an AWS Transcribe fallback if the browser speech service is unreachable. Amazon Polly neural voices are used when configured.
- **Image and PDF analysis:** attach a photo or PDF and ask Lumen to inspect it.
- **Web research:** request sourced research reports; Lumen searches and reads public web pages, then can create a downloadable PDF.
- **Live information:** ask about weather or cryptocurrency prices to show interactive data cards.
- **Conversation tools:** use prompt starters, choose a voice and language, export a conversation, and adjust the visual theme. A dismissible quick-start guide points out the sphere, chat, Explore examples, and attachments on first visit.
- **Installable PWA:** install Lumen on Android from a supported browser, or add it to the iPhone/iPad Home Screen from Safari. The app needs an internet connection for AI and live-data features.

AI responses and cloud-backed features require valid provider credentials. See [Configuration](#configuration).

## Requirements

- Node.js 18 or later
- npm 8 or later
- AWS credentials with access to the configured Amazon Bedrock model for the default AI provider

An OpenAI API key can optionally provide the server-side chat fallback. Amazon Polly credentials enable neural audio; without them, the browser speech-synthesis fallback may be used.

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
| `VITE_GOOGLE_CLIENT_ID` | Optional Google sign-in client ID. |

Keep credentials in the server-side `.env` file. Do not commit `.env` or put private API keys in `VITE_*` variables, which are exposed to browser builds.

## Production

Build the frontend, then start the Express server:

```sh
npm run build
npm start
```

The server serves the built frontend and API from the configured port (default `3000`).

## Troubleshooting

### Lumen does not reply

In development, check that both processes are running. Use `npm run dev:all`, then open [http://localhost:3000/api/health](http://localhost:3000/api/health). A healthy server returns JSON with `"status":"ok"`. If the API is unreachable, restart the backend and check its terminal output.

If the health endpoint works but chat still fails, check that the configured Bedrock model is available in the selected AWS region and that the AWS credentials have permission to invoke it. If using the OpenAI fallback, check `OPENAI_API_KEY` on the server.

### Voice input does not work

Allow microphone access and use a browser that supports the Web Speech API, such as current Chrome or Edge. You can still type messages if voice recognition is unavailable.

### Image or PDF analysis fails

Check the backend terminal for provider errors and confirm Bedrock access is configured. The health endpoint reports whether AWS credentials were detected; it does not validate that those credentials have model permissions.

## Project layout

```text
src/
  components/       React UI components, including the sphere and conversation feed
  hooks/            Shared React hooks
  services/api.js   Frontend client for the Express API
  utils/            Translations and shared utilities
  App.jsx           Main application and interaction flow
  App.css           Application styling
server.js           Express API and AI-provider integration
services/           Web search, live data, and PDF services
vite.config.js      Vite development server and API proxy
```

## License

This project is distributed under the MIT License. See [LICENSE](LICENSE).
