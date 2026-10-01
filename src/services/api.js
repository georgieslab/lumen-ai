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
 * Send voice transcript or text query along with optional compressed image payload to Lumen backend
 */
export async function converseWithLumen({ transcript, message, text, history = [], image = null }) {
  const payload = {
    transcript: transcript || message || text || '',
    history: history.slice(-8).map(h => ({
      role: h.role,
      text: h.text || ''
    })),
    image: image ? {
      base64: image.base64,
      mimeType: image.mimeType || 'image/jpeg'
    } : null
  };

  const response = await fetch(`${API_URL}/api/converse`, {
    method: 'POST',
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
