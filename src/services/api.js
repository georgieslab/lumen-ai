const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Fast client-side canvas downscaler to convert camera/file photos into compact ~25KB JPEG payloads
 */
export function compressImage(file, maxDim = 640, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({
          dataUrl,
          base64: dataUrl,
          mimeType: 'image/jpeg',
          name: file.name
        });
      };
      img.onerror = (err) => reject(err);
      img.src = e.target.result;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Unified file processor supporting both images (with canvas downscaling) and PDF documents
 */
export function processFile(file) {
  if (!file) return Promise.reject(new Error("No file provided"));
  const fileName = (file.name || '').toLowerCase();
  const fileType = (file.type || '').toLowerCase();
  const isPdf = fileType.includes('pdf') || fileName.endsWith('.pdf');

  if (isPdf) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          dataUrl: e.target.result,
          base64: e.target.result,
          mimeType: 'application/pdf',
          name: file.name || 'document.pdf',
          isPdf: true,
          size: file.size
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  } else {
    return compressImage(file);
  }
}

async function authenticatedJsonRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export async function getAuthSession() {
  return authenticatedJsonRequest('/api/auth/session');
}

export async function getAuthProviders() {
  return authenticatedJsonRequest('/api/auth/providers');
}

export async function signInWithGoogle(credential) {
  return authenticatedJsonRequest('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential })
  });
}

export async function signOut() {
  return authenticatedJsonRequest('/api/auth/logout', { method: 'POST' });
}

export function beginGithubSignIn() {
  window.location.assign(`${API_URL}/api/auth/github`);
}

export async function getUserMemory() {
  return authenticatedJsonRequest('/api/memory');
}

export async function saveUserProfile(text) {
  return authenticatedJsonRequest('/api/memory/profile', {
    method: 'PUT',
    body: JSON.stringify({ text })
  });
}

export async function setAutoMemory(enabled) {
  return authenticatedJsonRequest('/api/memory/settings', {
    method: 'PATCH',
    body: JSON.stringify({ autoMemoryEnabled: enabled })
  });
}

export async function createUserMemory(text) {
  return authenticatedJsonRequest('/api/memory/items', {
    method: 'POST',
    body: JSON.stringify({ text })
  });
}

export async function updateUserMemory(id, text) {
  return authenticatedJsonRequest(`/api/memory/items/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ text })
  });
}

export async function deleteUserMemory(id) {
  return authenticatedJsonRequest(`/api/memory/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function clearUserMemory() {
  return authenticatedJsonRequest('/api/memory', { method: 'DELETE' });
}

/**
 * Send voice transcript or text query along with optional image or PDF payload to Lumen backend
 */
export async function converseWithLumen({ transcript, message, text, history = [], file = null, image = null, webMode = 'auto', language = 'en-US', voiceId = null, tone = 'friendly', responseStyle = 'concise' }) {
  const targetFile = file || image;
  const payload = {
    transcript: transcript || message || text || '',
    history: history.slice(-8).map(h => ({
      role: h.role,
      text: h.text || ''
    })),
    webMode,
    language,
    voiceId,
    tone,
    responseStyle,
    file: targetFile ? {
      base64: targetFile.base64,
      mimeType: targetFile.mimeType || (targetFile.isPdf ? 'application/pdf' : 'image/jpeg'),
      name: targetFile.name,
      isPdf: Boolean(targetFile.isPdf)
    } : null,
    image: targetFile ? {
      base64: targetFile.base64,
      mimeType: targetFile.mimeType || (targetFile.isPdf ? 'application/pdf' : 'image/jpeg'),
      name: targetFile.name
    } : null
  };

  const response = await fetch(`${API_URL}/api/converse`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Server responded with ${response.status}`);
  }

  return await response.json();
}

/**
 * Stream conversational tokens, live widgets, and audio via Server-Sent Events (SSE)
 */
export async function converseWithLumenStream({
  transcript,
  message,
  text,
  history = [],
  file = null,
  image = null,
  webMode = 'auto',
  language = 'en-US',
  voiceId = null,
  tone = 'friendly',
  responseStyle = 'concise',
  onMemoryStatus,
  onToken,
  onToolStart,
  onWidget,
  onAudio,
  onVoiceChange,
  onDone,
  onError
}) {
  const targetFile = file || image;
  const payload = {
    transcript: transcript || message || text || '',
    history: history.slice(-8).map(h => ({
      role: h.role,
      text: h.text || ''
    })),
    webMode,
    language,
    voiceId,
    tone,
    responseStyle,
    file: targetFile ? {
      base64: targetFile.base64,
      mimeType: targetFile.mimeType || (targetFile.isPdf ? 'application/pdf' : 'image/jpeg'),
      name: targetFile.name,
      isPdf: Boolean(targetFile.isPdf)
    } : null,
    image: targetFile ? {
      base64: targetFile.base64,
      mimeType: targetFile.mimeType || (targetFile.isPdf ? 'application/pdf' : 'image/jpeg'),
      name: targetFile.name
    } : null
  };

  try {
    const response = await fetch(`${API_URL}/api/converse/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok || !response.body) {
      throw new Error(`Stream HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let hasEmittedDone = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr) continue;

        try {
          const event = JSON.parse(jsonStr);
          if (event.type === 'token' && onToken) {
            onToken(event.token || event.text || '');
          } else if (event.type === 'tool_start' && onToolStart) {
            onToolStart(event);
          } else if (event.type === 'widget' && onWidget) {
            onWidget(event.widget);
          } else if (event.type === 'audio' && onAudio) {
            onAudio(event.audioBase64);
          } else if (event.type === 'voice_change' && onVoiceChange) {
            onVoiceChange(event.voiceId);
          } else if (event.type === 'memory_status' && onMemoryStatus) {
            onMemoryStatus(event);
          } else if (event.type === 'done' && onDone) {
            hasEmittedDone = true;
            onDone(event);
          }
        } catch (parseErr) {
          console.warn("SSE chunk parse warning:", parseErr);
        }
      }

    }

    if (buffer.trim().startsWith('data:')) {
      try {
        const event = JSON.parse(buffer.trim().slice(5).trim());
        if (event.type === 'memory_status' && onMemoryStatus) {
          onMemoryStatus(event);
        }
        if (event.type === 'done' && onDone) {
          hasEmittedDone = true;
          onDone(event);
        }
      } catch (_) {}
    }

    if (!hasEmittedDone && onDone) {
      onDone({ replyText: '', widgets: [], toolsUsed: [], webSources: [] });
    }
  } catch (err) {
    console.warn("Stream failed, attempting standard converse fallback:", err.message);
    if (onError) onError(err);
    try {
      const fallbackData = await converseWithLumen({
        transcript,
        message,
        text,
        history,
        file,
        image,
        webMode,
        language,
        voiceId,
        tone,
        responseStyle
      });
      if (fallbackData.memoryStatus && onMemoryStatus) {
        onMemoryStatus(fallbackData.memoryStatus);
      }
      if (onToken && fallbackData.replyText) {
        onToken(fallbackData.replyText);
      }
      if (onWidget && Array.isArray(fallbackData.widgets)) {
        fallbackData.widgets.forEach(w => onWidget(w));
      }
      if (onAudio && fallbackData.audioBase64) {
        onAudio(fallbackData.audioBase64);
      }
      if (onDone) {
        onDone(fallbackData);
      }
    } catch (fallbackErr) {
      if (onError) onError(fallbackErr);
    }
  }

}

export async function researchWithLumenStream({
  transcript,
  history = [],
  language = 'en-US',
  tone = 'friendly',
  responseStyle = 'concise',
  onMemoryStatus,
  onProgress,
  onDone
}) {
  const response = await fetch(`${API_URL}/api/research/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript,
      history: history.slice(-8).map(message => ({
        role: message.role,
        text: message.text || ''
      })),
      language,
      tone,
      responseStyle
    })
  });

  if (!response.ok || !response.body) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Research request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let completed = false;

  const handleEvent = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const event = JSON.parse(trimmed.slice(5).trim());

    if (event.type === 'progress' && onProgress) {
      onProgress(event);
    } else if (event.type === 'memory_status' && onMemoryStatus) {
      onMemoryStatus(event);
    } else if (event.type === 'done' && onDone) {
      completed = true;
      onDone(event);
    } else if (event.type === 'error') {
      throw new Error(event.error || 'Research could not be completed.');
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.trim()) handleEvent(line);
    }
  }

  if (buffer.trim()) handleEvent(buffer);
  if (!completed) {
    throw new Error('The research service ended before returning a report.');
  }
}

/**
 * Fetch ambient real-time weather and crypto data snapshot for stage widgets
 */
export async function fetchAmbientData(city = 'Tokyo', asset = 'bitcoin') {
  try {
    const res = await fetch(`${API_URL}/api/live/ambient?city=${encodeURIComponent(city)}&asset=${encodeURIComponent(asset)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Failed to fetch ambient data:", err);
    return null;
  }
}

/**
 * Fetch real-time weather for any city directly
 */
export async function fetchLiveWeatherDirect(city) {
  try {
    const res = await fetch(`${API_URL}/api/live/weather?city=${encodeURIComponent(city)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Failed to fetch weather directly:", err);
    return null;
  }
}

/**
 * Fetch real-time crypto prices directly
 */
export async function fetchLiveCryptoDirect(asset, currency = 'usd') {
  try {
    const res = await fetch(`${API_URL}/api/live/crypto?asset=${encodeURIComponent(asset)}&currency=${encodeURIComponent(currency)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Failed to fetch crypto directly:", err);
    return null;
  }
}

/**
 * Generate a PDF document directly via Lumen PDF Engine
 */
export async function createPdfDirect(payload) {
  try {
    const res = await fetch(`${API_URL}/api/pdf/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("PDF creation request failed:", err);
    return null;
  }
}

/**
 * Export conversation transcript to a PDF report directly
 */
export async function exportConversationPdfDirect(messages, user) {
  try {
    const res = await fetch(`${API_URL}/api/pdf/export-conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, user })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Conversation PDF export failed:", err);
    return null;
  }
}

/**
 * Preview a neural voice sample via Amazon Polly
 */
export async function previewVoice(voiceId, text = '') {
  const res = await fetch(`${API_URL}/api/voice/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voiceId, text })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Voice preview request failed');
  }
  return await res.json();
}

/**
 * Fetch available neural voices catalog
 */
export async function fetchVoiceList() {
  const res = await fetch(`${API_URL}/api/voice/list`);
  if (!res.ok) {
    throw new Error('Failed to fetch voice catalog');
  }
  return await res.json();
}

/**
 * Fetch health & diagnostic telemetry from Lumen backend with roundtrip latency measurement
 */
export async function fetchHealthStatus() {
  const t0 = performance.now();
  const res = await fetch(`${API_URL}/api/health`);
  const t1 = performance.now();
  if (!res.ok) throw new Error(`Health ping failed with HTTP ${res.status}`);
  const data = await res.json();
  return { ...data, latencyMs: Math.round(t1 - t0) };
}

/**
 * Programmatic live web search
 */
export async function searchWebProgrammatic(query, limit = 4) {
  const res = await fetch(`${API_URL}/api/browser/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Web search failed');
  }
  return await res.json();
}

/**
 * Programmatic live web browsing and content extraction
 */
export async function browseUrlProgrammatic(url) {
  const res = await fetch(`${API_URL}/api/browser/browse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Web browsing extraction failed');
  }
  return await res.json();
}
