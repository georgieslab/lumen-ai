# 🔮 Lumen — Ambient Multimodal Voice & Vision AI Copilot

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![OpenAI ChatGPT](https://img.shields.io/badge/AI_Engine-OpenAI_ChatGPT-412991?logo=openai&logoColor=white)](https://openai.com/)
[![AWS Bedrock](https://img.shields.io/badge/Cloud_AI-Amazon_Bedrock-FF9900?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/bedrock/)
[![Amazon Polly](https://img.shields.io/badge/Neural_Voice-Amazon_Polly-FF9900?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/polly/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Lumen** is a standalone, ambient multimodal AI voice & vision copilot built with Apple's **visionOS liquid glass design system**. It delivers intuitive voice-to-voice conversation, real-time camera/document inspection, and low-latency neural speech synthesis powered by **OpenAI ChatGPT**, **Amazon Bedrock**, and **Amazon Polly**.

---

## 🌟 Key Features

### 🎙️ 1. Conversational Voice-to-Voice Intelligence
- **Natural Voice Cadence**: Spoken voice agent synthesized using **Amazon Polly Neural Engine** (*VoiceId: Matthew*) with automatic browser speech synthesis fallback.
- **Acoustic Waveform Equalizer**: Reactive multi-frequency waveform equalizer that dances dynamically in sync with audio output and microphone input.
- **Interactive Neural Sphere**: 3D iridescent morphing glass orb with fluid multi-blob refraction and visionOS specular highlight lenses.

### 📷 2. Multimodal AI Vision & Inspection Scanner
- **Aperture Scanner & Drag-and-Drop**: Inspect photos, handwritten notes, documents, book excerpts, or physical environments.
- **Client-Side Canvas Downscaling**: HTML5 canvas downscaling pipeline (`640px / ~25KB JPEG payloads`) reducing base64 payload transfer latency by **~40%** before network dispatch.
- **Multi-Engine Routing**: Priority model chain across **OpenAI GPT-6.1 Sol**, **GPT-4o**, and **Amazon Bedrock**.

### 🎨 3. Apple visionOS Liquid Glass UI
- **Specular Refraction & Ambient Fluid Mesh**: Multi-stop glass highlights, dynamic neon status beacons, and ambient backdrop lighting.
- **Toggleable Conversation Log**: Translucent slide-up conversation drawer with persistent local history.
- **Mobile-First Responsive Stage**: Adapts seamlessly to smartphone touch screens and desktop environments.

---

## 🏗️ Architecture & Tech Stack

```text
┌─────────────────┐       WebSocket / HTTP        ┌─────────────────┐
│  React 18 SPA   │ ◄───────────────────────────► │ Node.js Express │
│  (visionOS UI)  │   640px / ~25KB JPEG Payloads  │ (Proxy Engine)  │
└────────┬────────┘                               └────────┬────────┘
         │                                                 │
         │ Web Speech API /                                ├─► Amazon Bedrock (OpenAI GPT-6.1 Sol)
         │ Canvas API Downscaling                          ├─► Direct OpenAI API (GPT-4o) Fallback
         │                                                 └─► Amazon Polly (Neural Voice: Matthew)
         ▼
  Browser Client
```

- **Frontend**: React 18, Vite 6, HTML5 Canvas API, Web Speech API, CSS3 Liquid Glass Tokens.
- **Backend & Middleware**: Node.js, Express, CORS, 15MB extended body parser for image streaming.
- **AI & Cloud Engines**:
  - **Amazon Bedrock**: `openai.gpt-6.1-sol`, `openai.gpt-6.1`, `openai.gpt-oss-120b-1:0`
  - **OpenAI Direct API Fallback**: `gpt-4o-mini`, `gpt-4o`
  - **Amazon Polly**: Neural Voice engine (`eu-west-1` Ireland deployment)
- **Deployment**: Render / Node.js production server with automated CI/CD.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18.0.0 or higher
- **npm** v8.0.0 or higher

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/georgieslab/lumen-ai.git
   cd lumen-ai
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the project root:
   ```env
   PORT=3000
   NODE_ENV=development

   # Amazon Bedrock & Polly Credentials
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   AWS_REGION=eu-north-1
   POLLY_REGION=eu-west-1
   POLLY_VOICE_ID=Matthew

   # Direct OpenAI API Fallback Key
   OPENAI_API_KEY=your_openai_api_key
   VITE_OPENAI_API_KEY=your_openai_api_key
   ```

4. **Run the Application**:

   - **Development (Frontend + Backend concurrently)**:
     ```bash
     npm run dev:all
     ```
     - Open [http://localhost:5173](http://localhost:5173) in your browser.

   - **Production Build & Server**:
     ```bash
     npm run build
     npm start
     ```

---

## 📂 Project Structure

```text
lumen-ai/
├── dist/                      # Static production bundle
├── src/
│   ├── components/
│   │   ├── AmbientSphere.jsx  # 3D fluid morphing neural orb & waveform
│   │   ├── VisionScanner.jsx  # Camera aperture scanner & canvas downscaler
│   │   └── ConversationFeed.jsx# Translucent glass conversation drawer
│   ├── services/
│   │   └── api.js             # Canvas compression & backend converse API
│   ├── App.jsx                # Ambient fullscreen stage & speech loop
│   ├── App.css                # Apple visionOS liquid glass design system
│   └── main.jsx               # React entry point
├── build.js                   # High-performance esbuild production bundler
├── server.js                  # Express API server for Bedrock OpenAI & Polly
├── vite.config.js             # Vite development server & proxy config
└── package.json
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with precision by <strong>Georgie Akopashvili</strong> 🔮
</p>
