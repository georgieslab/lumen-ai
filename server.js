import express from 'express';
import cors from 'cors';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware with extended body size limit for base64 multimodal image uploads
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

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

// Serve static files in production with cache headers
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'dist'), {
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
    if (m.content || m.text) {
      payloadMessages.push({
        role: m.role || 'user',
        content: m.content || m.text
      });
    }
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

// --------------------------------------------------------------------------
// Lumen Conversational Voice & Vision API
// --------------------------------------------------------------------------
app.post('/api/converse', async (req, res) => {
  try {
    const promptText = (req.body.transcript || req.body.message || req.body.text || "").trim() || "Hello Lumen";
    const hasImage = Boolean(req.body.image && req.body.image.base64);

    const systemPrompt = `You are "Lumen", an ambient multimodal AI copilot powered by OpenAI ChatGPT technology.
Identity & Persona:
- You are Lumen, an intuitive, perceptive, and grounded voice & vision AI companion.
- You listen intently, think deeply, and reply concisely.
Tone & Guidelines:
- Speak like a sharp, thoughtful, and articulate companion or trusted advisor.
- Keep spoken answers concise, conversational, and direct (1-3 sentences maximum for natural speech cadence).
- NEVER use markdown headers, asterisks, bullet points, or emojis, since your output is synthesized directly to spoken voice audio.${hasImage ? '\n- The user shared an image payload. Carefully inspect and describe key observations, document contents, or visual nuances with sharp precision.' : ''}`;

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

    // Add current prompt and optional image
    const userContent = [];
    if (hasImage) {
      try {
        const base64Data = req.body.image.base64.replace(/^data:image\/\w+;base64,/, '');
        let format = (req.body.image.mimeType || 'image/jpeg').split('/')[1] || 'jpeg';
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
    }
    userContent.push({ text: promptText || "Analyze this image and describe what you observe." });

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

    // 1. Try Amazon Bedrock OpenAI models
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      const candidateModels = [
        "openai.gpt-6.1-sol",
        "openai.gpt-6.1",
        process.env.BEDROCK_MODEL_ID,
        "openai.gpt-oss-120b-1:0",
        "openai.gpt-oss-20b-1:0"
      ].filter(Boolean);

      const runConverse = async (targetModel) => {
        const command = new ConverseCommand({
          modelId: targetModel,
          messages: finalMessages,
          system: [{ text: systemPrompt }],
          inferenceConfig: {
            maxTokens: 350,
            temperature: 0.7
          }
        });
        const response = await bedrock.send(command);
        const textBlock = response.output?.message?.content?.find(c => c.text);
        return textBlock ? textBlock.text : (response.output?.message?.content?.[0]?.text || "");
      };

      for (const model of candidateModels) {
        try {
          replyText = await runConverse(model);
          if (replyText && replyText.trim().length > 0) {
            console.log(`Lumen responded via Bedrock model: ${model}`);
            break;
          }
        } catch (err) {
          console.warn(`Model ${model} failed: ${err.message}. Trying next candidate...`);
        }
      }
    }

    // 2. Direct OpenAI API fallback
    if (!replyText) {
      try {
        const openAIReply = await fetchOpenAIChatCompletion({
          messages: [{ role: 'user', content: promptText }],
          systemPrompt,
          maxTokens: 350
        });
        if (openAIReply) {
          replyText = openAIReply;
          console.log("Lumen responded via OpenAI Direct API fallback");
        }
      } catch (oaiErr) {
        console.warn("OpenAI fallback failed:", oaiErr.message);
      }
    }

    if (!replyText) {
      replyText = "I am present and listening. How can I assist you right now?";
    }

    // 3. Synthesize speech with Amazon Polly Neural Engine
    let audioBase64 = null;
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      try {
        const pollyCommand = new SynthesizeSpeechCommand({
          Engine: 'neural',
          OutputFormat: 'mp3',
          Text: replyText,
          VoiceId: process.env.POLLY_VOICE_ID || 'Matthew' // Calm neural male voice
        });

        const pollyResponse = await polly.send(pollyCommand);
        const audioBuffer = await pollyResponse.AudioStream.transformToByteArray();
        audioBase64 = Buffer.from(audioBuffer).toString('base64');
      } catch (pollyErr) {
        console.warn("Polly TTS failed, frontend will use browser speech:", pollyErr.message);
      }
    }

    res.json({
      replyText,
      audioBase64,
      provider: audioBase64 ? 'bedrock-polly' : 'bedrock-webspeech'
    });
  } catch (error) {
    console.error('Lumen converse error:', error);
    res.status(500).json({ error: error.message || 'Failed to process voice command' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'Lumen AI Ambient Copilot',
    bedrockConfigured: Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
    region: process.env.AWS_REGION || 'eu-north-1'
  });
});

// Serve React app for all other routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Lumen AI server running on port ${PORT}`);
});
