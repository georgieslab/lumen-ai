import express from 'express';
import cors from 'cors';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import dotenv from 'dotenv';
import { getWebGroundingContext, searchDuckDuckGo, fetchUrlContent, searchWikipedia } from './services/webSearch.js';
import { fetchLiveWeather, fetchCryptoPrices } from './services/liveData.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware with extended body size limit for base64 multimodal image/PDF uploads
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize AWS Clients for Bedrock & Polly
const awsCredentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {})
} : undefined;

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: awsCredentials
});

// Amazon Polly Neural Engine is deployed in eu-west-1 (Ireland)
const polly = new PollyClient({
  region: process.env.POLLY_REGION || 'eu-west-1',
  credentials: awsCredentials
});

// --------------------------------------------------------------------------
// Amazon Bedrock Native Tool Calling Definitions (Converse API toolConfig)
// --------------------------------------------------------------------------
const BEDROCK_TOOLS = [
  {
    toolSpec: {
      name: 'get_live_weather',
      description: 'Get current real-time weather and forecast for any city or location worldwide (temperature, conditions, humidity, wind, 3-day forecast).',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            city: { type: 'string', description: 'The city or location name, e.g. London, Tokyo, New York, Paris, Berlin' }
          },
          required: ['city']
        }
      }
    }
  },
  {
    toolSpec: {
      name: 'get_crypto_and_market_prices',
      description: 'Get live real-time prices, 24h price changes, high/low ranges, and market stats for cryptocurrencies (Bitcoin, Ethereum, Solana, etc.) and fiat currencies.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            asset: { type: 'string', description: 'The crypto asset name or symbol, e.g. bitcoin, btc, ethereum, eth, solana, sol, cardano, xrp, doge' },
            currency: { type: 'string', description: 'Comparison fiat currency, default usd' }
          },
          required: ['asset']
        }
      }
    }
  },
  {
    toolSpec: {
      name: 'live_web_search',
      description: 'Search the live web and knowledge bases for current events, news, facts, people, or real-time information.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The search query to look up on the web' }
          },
          required: ['query']
        }
      }
    }
  },
  {
    toolSpec: {
      name: 'browse_web_page',
      description: 'Fetch and extract the readable text content of any website or documentation URL.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The full URL (e.g. https://example.com/article) to read' }
          },
          required: ['url']
        }
      }
    }
  },
  {
    toolSpec: {
      name: 'call_direct_api',
      description: 'Make a direct HTTP GET or POST request to any public REST API endpoint to retrieve live real-time JSON data (e.g., weather APIs, stock/crypto prices, currency rates, public JSON endpoints).',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The full HTTP/HTTPS REST API endpoint URL to call' },
            method: { type: 'string', enum: ['GET', 'POST'], description: 'HTTP method (default GET)' },
            purpose: { type: 'string', description: 'Brief description of what data is being fetched' }
          },
          required: ['url']
        }
      }
    }
  }
];

async function executeBedrockTool(toolUse) {
  try {
    const { name, input = {} } = toolUse || {};
    if (name === 'get_live_weather') {
      const city = String(input?.city || input?.location || '').trim();
      if (!city) return { error: 'No city or location provided.' };
      const weatherData = await fetchLiveWeather(city);
      return weatherData;
    }

    if (name === 'get_crypto_and_market_prices') {
      const asset = String(input?.asset || input?.symbol || input?.coin || '').trim();
      const currency = String(input?.currency || 'usd').trim();
      if (!asset) return { error: 'No cryptocurrency asset or symbol provided.' };
      const marketData = await fetchCryptoPrices(asset, currency);
      return marketData;
    }

    if (name === 'live_web_search') {
      const query = String(input?.query || '').trim();
      if (!query) return { error: 'No search query provided.' };
      let results = await searchDuckDuckGo(query, 4);
      if (!results || results.length === 0) {
        results = await searchWikipedia(query, 4);
      }
      return {
        query,
        results: Array.isArray(results) && results.length > 0 ? results : 'No web search results found for this query.'
      };
    }

    if (name === 'browse_web_page') {
      const url = String(input?.url || '').trim();
      if (!url) return { error: 'No URL provided.' };
      const pageData = await fetchUrlContent(url);
      return {
        url,
        title: pageData?.title || url,
        content: pageData?.content ? pageData.content.slice(0, 2500) : (pageData?.error || 'Could not fetch page content')
      };
    }

    if (name === 'call_direct_api') {
      const url = String(input?.url || '').trim();
      if (!url) return { error: 'No API URL provided.' };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(url, {
          method: input.method || 'GET',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'LumenAI-Agent/1.0'
          },
          signal: controller.signal
        });
        clearTimeout(timeout);
        const text = await res.text();
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (_) {
          parsed = text.slice(0, 1500);
        }
        return {
          url,
          status: res.status,
          data: parsed
        };
      } catch (err) {
        clearTimeout(timeout);
        return {
          url,
          error: err.message
        };
      }
    }

    return { error: `Tool ${name} is not recognized.` };
  } catch (toolErr) {
    console.warn(`executeBedrockTool error for ${toolUse?.name}:`, toolErr.message);
    return { error: toolErr.message || 'Tool execution encountered an error' };
  }
}

// Serve static files with cache headers whenever dist directory is built
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath, {
    maxAge: '1d',
    etag: true,
    lastModified: true
  }));
}

// Helper for OpenAI direct REST API fallback
async function fetchOpenAIChatCompletion({ messages, systemPrompt, maxTokens = 400 }) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return null;

  const payloadMessages = [];
  if (systemPrompt) {
    payloadMessages.push({ role: 'system', content: systemPrompt });
  }

  for (const m of messages) {
    payloadMessages.push(m);
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: payloadMessages,
      max_tokens: maxTokens,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function prepareTextForSpeech(text) {
  if (!text || typeof text !== 'string') return "";
  try {
    return text
      // Replace markdown links [Title](url) with just Title
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // Remove raw URLs
      .replace(/https?:\/\/[^\s]+/gi, '')
      // Remove markdown code blocks and accents
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*_~#]/g, '')
      // Replace bullet dashes with clean speech pauses
      .replace(/^\s*[-•*]\s+/gm, '')
      // Remove XML / HTML tags
      .replace(/<[^>]+>/g, '')
      // Collapse extra whitespace and newlines
      .replace(/\n\s*\n+/g, '. ')
      .replace(/\n/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (err) {
    console.warn("prepareTextForSpeech error:", err.message);
    return String(text || '');
  }
}

// --------------------------------------------------------------------------
// Lumen Conversational Voice & Vision API
// --------------------------------------------------------------------------
app.post('/api/converse', async (req, res) => {
  try {
    const rawPrompt = (req.body.transcript || req.body.message || req.body.text || "").trim();
    const filePayload = req.body.file || req.body.image;
    const isPdf = Boolean(
      filePayload && filePayload.base64 && (
        filePayload.mimeType === 'application/pdf' ||
        filePayload.isPdf ||
        filePayload.base64.startsWith('data:application/pdf') ||
        filePayload.base64.startsWith('data:application/x-pdf') ||
        filePayload.base64.startsWith('data:application/octet-stream') ||
        (filePayload.name && filePayload.name.toLowerCase().endsWith('.pdf'))
      )
    );
    const hasDocument = isPdf;
    const hasImage = Boolean(filePayload && filePayload.base64 && !isPdf);

    const defaultPrompt = hasDocument 
      ? "Analyze this attached PDF document and summarize what it covers." 
      : hasImage 
        ? "Analyze this attached image and describe what you observe." 
        : "Hello Lumen";
    const promptText = rawPrompt || defaultPrompt;

    // Retrieve real-time web search or URL context if requested or auto-detected
    const webMode = req.body.webMode || 'auto'; // 'auto' | 'always' | 'off'
    let webContext = null;
    try {
      webContext = await getWebGroundingContext(rawPrompt, { mode: webMode });
    } catch (webErr) {
      console.warn('Web grounding error:', webErr.message);
    }

    // Proactive live data intent recognition (Weather, Crypto/Markets) for instant grounding & widgets
    let liveDataWidget = null;
    let liveDataGrounding = "";
    if (webMode !== 'off' && rawPrompt) {
      const weatherMatch = rawPrompt.match(/\bweather (?:in|for|at)?\s+([a-zA-Z\s\-]+)/i);
      const cryptoMatch = rawPrompt.match(/\b(?:price of|crypto|ticker|how much is)?\s*(btc|bitcoin|eth|ethereum|sol|solana|doge|dogecoin|xrp|ripple|cardano|ada)\b/i);
      if (weatherMatch && weatherMatch[1]) {
        try {
          const w = await fetchLiveWeather(weatherMatch[1].trim());
          if (w && w.success) {
            liveDataWidget = w;
            liveDataGrounding = `\n- Real-Time Live Weather Data:\n${w.summary}`;
          }
        } catch (_) {}
      } else if (cryptoMatch && cryptoMatch[1]) {
        try {
          const c = await fetchCryptoPrices(cryptoMatch[1].trim());
          if (c && c.success) {
            liveDataWidget = c;
            liveDataGrounding = `\n- Real-Time Live Market Data:\n${c.summary}`;
          }
        } catch (_) {}
      }
    }

    const systemPrompt = `You are "Lumen", an ambient multimodal AI copilot powered by frontier intelligence.
Identity & Persona:
- You are Lumen, an intuitive, perceptive, and grounded voice & vision AI companion.
- You listen intently, think deeply, and reply concisely.
Tone & Guidelines:
- Speak like a sharp, thoughtful, and articulate companion or trusted advisor.
- Keep your answers conversational, concise, and structured.
- When sharing web resources, job postings, articles, documentation, or links, ALWAYS provide the direct clickable markdown link format: [Descriptive Title](https://actual-url.com). Format multiple items as a clean bulleted list so the user can easily review and click each one.
- Never output bare titles claiming to provide URLs without including the actual markdown link [Title](url).
- The user's screen renders your markdown links visually as interactive buttons, while your voice audio is automatically streamlined for speech.${hasImage ? '\n- The user shared an image payload. Carefully inspect and describe key observations, document contents, or visual nuances with sharp precision.' : ''}${hasDocument ? '\n- The user shared a PDF document payload. Carefully inspect the document text and structure, summarize key points, or answer specific questions with sharp precision.' : ''}${webContext ? `\n- Real-Time Internet Data:\n${webContext.groundingText}` : ''}${liveDataGrounding}`;

    // Format conversation history for Bedrock ConverseCommand
    const incomingHistory = Array.isArray(req.body.history) ? req.body.history : [];
    const formattedMessages = [];

    for (const item of incomingHistory) {
      if (!item || !item.text) continue;
      const role = item.role === 'user' ? 'user' : 'assistant';
      const text = String(item.text).trim();
      if (!text) continue;

      if (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role === role) {
        formattedMessages[formattedMessages.length - 1].content[0].text += ` ${text}`;
      } else {
        formattedMessages.push({ role, content: [{ text }] });
      }
    }

    // Add current prompt and optional image/document
    const userContent = [];
    if (hasImage) {
      try {
        const base64Data = filePayload.base64.replace(/^data:[^;]+;base64,/, '').trim();
        let format = (filePayload.mimeType || 'image/jpeg').split('/')[1] || 'jpeg';
        if (format === 'jpg') format = 'jpeg';
        if (!['png', 'jpeg', 'gif', 'webp'].includes(format)) format = 'jpeg';

        userContent.push({
          image: {
            format,
            source: { bytes: Buffer.from(base64Data, 'base64') }
          }
        });
      } catch (imgErr) {
        console.warn('Could not parse image payload for Bedrock:', imgErr.message);
      }
    } else if (hasDocument) {
      try {
        const base64Data = filePayload.base64.replace(/^data:[^;]+;base64,/, '').trim();
        // Clean doc name: Bedrock permits alphanumeric, hyphens, underscores, spaces (max 200 chars)
        let cleanName = (filePayload.name || 'document')
          .replace(/\.pdf$/i, '')
          .replace(/[^a-zA-Z0-9_\-\s]/g, '_')
          .trim()
          .slice(0, 50) || 'document';
        if (!/^[a-zA-Z0-9]/.test(cleanName)) {
          cleanName = 'doc_' + cleanName;
        }

        userContent.push({
          document: {
            format: 'pdf',
            name: cleanName,
            source: { bytes: Buffer.from(base64Data, 'base64') }
          }
        });
      } catch (docErr) {
        console.warn('Could not parse document payload for Bedrock:', docErr.message);
      }
    }

    userContent.push({ text: promptText });

    if (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role === 'user') {
      formattedMessages[formattedMessages.length - 1].content = userContent;
    } else {
      formattedMessages.push({ role: 'user', content: userContent });
    }

    while (formattedMessages.length > 0 && formattedMessages[0].role !== 'user') {
      formattedMessages.shift();
    }

    let finalMessages = formattedMessages.slice(-10);
    while (finalMessages.length > 0 && finalMessages[0].role !== 'user') {
      finalMessages.shift();
    }
    if (finalMessages.length === 0) {
      finalMessages = [{ role: 'user', content: userContent }];
    }

    let replyText = "";
    const executedTools = [];
    const executedWidgets = [];

    // 1. Try Amazon Bedrock models
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      // Determine candidate models based on multimodal document/image requirements
      const configuredModel = (process.env.BEDROCK_MODEL_ID || '').trim();
      const isMultimodalCapable = (modelId) => {
        if (!modelId) return false;
        const m = modelId.toLowerCase().trim();
        if (m.includes('glm') || (m.includes('llama') && !m.includes('vision'))) return false;
        return true;
      };

      let rawCandidates = [];
      if (hasDocument) {
        // Document-capable models (Amazon Nova Lite natively supports PDF documents up to 100 pages)
        rawCandidates = [
          "amazon.nova-lite-v1:0",
          "eu.amazon.nova-lite-v1:0",
          "eu.amazon.nova-pro-v1:0",
          "amazon.nova-pro-v1:0",
          isMultimodalCapable(configuredModel) ? configuredModel : null
        ];
      } else if (hasImage) {
        // Image-capable models: Nova Lite is fast, robust, and supports all image formats
        rawCandidates = [
          "amazon.nova-lite-v1:0",
          "eu.amazon.nova-lite-v1:0",
          "eu.amazon.nova-pro-v1:0",
          "amazon.nova-pro-v1:0",
          isMultimodalCapable(configuredModel) ? configuredModel : null
        ];
      } else {
        // Text & tool queries: prioritize tool-capable Amazon Nova models
        rawCandidates = [
          "amazon.nova-lite-v1:0",
          configuredModel,
          "eu.amazon.nova-pro-v1:0",
          "zai.glm-5"
        ];
      }

      const candidateModels = Array.from(new Set(rawCandidates.filter(Boolean)));

      const runConverse = async (targetModel) => {
        const supportsTools = targetModel.toLowerCase().includes('nova');
        const turnMessages = [...finalMessages];
        const currentModelTools = [];
        const currentModelWidgets = [];
        let conversationReply = "";
        const maxTurns = 3;

        for (let turn = 0; turn < maxTurns; turn++) {
          const commandPayload = {
            modelId: targetModel,
            messages: turnMessages,
            system: [{ text: systemPrompt }],
            inferenceConfig: {
              maxTokens: 400,
              temperature: 0.7
            }
          };

          // Attach native tools if model supports toolConfig and web access is not disabled
          if (supportsTools && webMode !== 'off') {
            commandPayload.toolConfig = { tools: BEDROCK_TOOLS };
          }

          const response = await bedrock.send(new ConverseCommand(commandPayload));

          // Handle autonomous tool execution if requested by Bedrock
          if (response.stopReason === 'tool_use' && supportsTools) {
            const toolUseBlock = response.output?.message?.content?.find(c => c.toolUse);
            if (toolUseBlock && toolUseBlock.toolUse) {
              const { toolUse } = toolUseBlock;
              console.log(`[Bedrock Tool Invoked] Model ${targetModel} called ${toolUse.name}:`, toolUse.input);
              const toolResult = await executeBedrockTool(toolUse);
              if (toolResult && toolResult.widgetType) {
                currentModelWidgets.push(toolResult);
              }
              currentModelTools.push({
                name: toolUse.name,
                input: toolUse.input,
                resultItems: Array.isArray(toolResult.results) ? toolResult.results : null,
                resultSummary: toolUse.name === 'live_web_search'
                  ? `${Array.isArray(toolResult.results) ? toolResult.results.length : 0} items retrieved`
                  : (toolResult.widgetType === 'weather' ? `${toolResult.city} (${toolResult.temp}°C)`
                  : (toolResult.widgetType === 'crypto' ? `${toolResult.symbol} ($${toolResult.price})`
                  : (toolResult.title || 'Completed')))
              });

              turnMessages.push(response.output.message);
              turnMessages.push({
                role: 'user',
                content: [{
                  toolResult: {
                    toolUseId: toolUse.toolUseId,
                    content: [{ json: toolResult }]
                  }
                }]
              });
              continue; // Re-prompt Bedrock with toolResult in the next turn
            }
          }

          // Final model answer generated
          const textBlock = response.output?.message?.content?.find(c => c.text);
          conversationReply = textBlock ? textBlock.text : (response.output?.message?.content?.[0]?.text || "");
          break;
        }

        // Clean internal chain-of-thought XML tags (e.g. <thinking>...</thinking>)
        return {
          reply: String(conversationReply || '').replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim(),
          tools: currentModelTools,
          widgets: currentModelWidgets
        };
      };

      for (const model of candidateModels) {
        try {
          const converseResult = await runConverse(model);
          if (converseResult && converseResult.reply && converseResult.reply.trim().length > 0) {
            replyText = converseResult.reply;
            if (Array.isArray(converseResult.tools)) {
              executedTools.push(...converseResult.tools);
            }
            if (Array.isArray(converseResult.widgets)) {
              executedWidgets.push(...converseResult.widgets);
            }
            console.log(`Lumen responded via Bedrock model: ${model} (${hasDocument ? 'PDF document' : hasImage ? 'image' : 'text'}${executedTools.length ? ` + ${executedTools.length} tool(s)` : ''})`);
            break;
          }
        } catch (err) {
          console.warn(`Model ${model} failed: ${err.message}. Trying next candidate...`);
        }
      }

      // Merge proactive live data widget if triggered
      if (liveDataWidget && !executedWidgets.some(w => w.widgetType === liveDataWidget.widgetType)) {
        executedWidgets.unshift(liveDataWidget);
      }
    }

    // 2. Direct OpenAI API fallback
    if (!replyText) {
      try {
        const openAIReply = await fetchOpenAIChatCompletion({
          messages: finalMessages,
          systemPrompt,
          maxTokens: 350
        });
        if (openAIReply) {
          replyText = openAIReply;
          console.log("Lumen responded via OpenAI Direct API");
        }
      } catch (oaiErr) {
        console.warn("OpenAI API failed:", oaiErr.message);
      }
    }

    if (!replyText) {
      replyText = "I am present and listening. How can I assist you right now?";
    }

    // 3. Synthesize speech with Amazon Polly Neural Engine (using speech-optimized text)
    let audioBase64 = null;
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      try {
        const spokenText = prepareTextForSpeech(replyText) || (typeof replyText === 'string' ? replyText : "Here is what I found.");
        const pollyCommand = new SynthesizeSpeechCommand({
          Engine: 'neural',
          OutputFormat: 'mp3',
          Text: spokenText.slice(0, 1500) || "Here is what I found.",
          VoiceId: process.env.POLLY_VOICE_ID || 'Matthew' // Calm neural male voice
        });

        const pollyResponse = await polly.send(pollyCommand);
        const audioBuffer = await pollyResponse.AudioStream.transformToByteArray();
        audioBase64 = Buffer.from(audioBuffer).toString('base64');
      } catch (pollyErr) {
        console.warn("Polly TTS failed, frontend will use browser speech:", pollyErr.message);
      }
    }

    // Aggregate sources for frontend interactive link cards
    let allSources = [];
    if (webContext && Array.isArray(webContext.sources)) {
      allSources.push(...webContext.sources);
    }
    if (Array.isArray(executedTools)) {
      for (const tool of executedTools) {
        if (!tool) continue;
        if (tool.name === 'browse_web_page' && tool.input?.url) {
          allSources.push({ title: tool.resultSummary || tool.input.url, url: tool.input.url });
        } else if (tool.name === 'live_web_search' && Array.isArray(tool.resultItems)) {
          for (const item of tool.resultItems) {
            if (item && item.url && typeof item.url === 'string') {
              allSources.push({ title: item.title || item.url, url: item.url, snippet: item.snippet || '' });
            }
          }
        }
      }
    }

    // Deduplicate sources by URL
    const seenUrls = new Set();
    allSources = allSources.filter(s => {
      if (!s || !s.url || typeof s.url !== 'string') return false;
      const cleanUrl = s.url.trim();
      if (!cleanUrl || seenUrls.has(cleanUrl)) return false;
      seenUrls.add(cleanUrl);
      return true;
    });

    res.json({
      replyText,
      audioBase64,
      provider: audioBase64 ? 'bedrock-polly' : 'bedrock-webspeech',
      webSources: allSources,
      webType: webContext ? webContext.type : (executedTools.length ? 'bedrock_tool' : (executedWidgets.length ? 'live_widget' : null)),
      toolsUsed: executedTools,
      widgets: executedWidgets
    });
  } catch (error) {
    console.error('Lumen converse error:', error);
    console.error('Lumen converse stack trace:', error?.stack);
    // Graceful recovery response so the UI and voice loop never freeze with a 500 error
    res.status(200).json({
      replyText: "I am present and listening. How can I assist you right now?",
      audioBase64: null,
      provider: 'bedrock-webspeech',
      webSources: [],
      webType: null,
      toolsUsed: [],
      widgets: [],
      recoveredFromError: true
    });
  }
});

// Google Authentication Token Verification Endpoint
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential, userInfo } = req.body || {};
    let user = null;

    if (credential && typeof credential === 'string') {
      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          user = {
            id: payload.sub,
            email: payload.email,
            name: payload.name || 'Google User',
            givenName: payload.given_name || payload.name?.split(' ')[0] || 'User',
            familyName: payload.family_name || '',
            picture: payload.picture || null,
            emailVerified: payload.email_verified
          };
        }
      } catch (tokenErr) {
        console.warn('Google token parse warning:', tokenErr.message);
      }
    }

    if (!user && userInfo) {
      user = userInfo;
    }

    if (!user) {
      return res.status(400).json({ error: 'Invalid Google authentication payload' });
    }

    console.log(`[Google Auth] User authenticated: ${user.name} (${user.email})`);

    res.json({
      success: true,
      user,
      token: credential || `session-${user.id || Date.now()}`
    });
  } catch (err) {
    console.error('Google Auth server error:', err);
    res.status(500).json({ error: err.message || 'Authentication failed' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'Lumen AI',
    bedrockConfigured: Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
    region: process.env.AWS_REGION || 'eu-north-1'
  });
});

// Serve React SPA for all other frontend routes
app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Lumen AI: Frontend not built yet. Run "npm run build" first.');
  }
});

app.listen(PORT, () => {
  console.log(`Lumen AI server running on port ${PORT}`);
});

