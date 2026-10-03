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

/**
 * Send voice transcript or text query along with optional image or PDF payload to Lumen backend
 */
export async function converseWithLumen({ transcript, message, text, history = [], file = null, image = null, webMode = 'auto' }) {
  const targetFile = file || image;
  const payload = {
    transcript: transcript || message || text || '',
    history: history.slice(-8).map(h => ({
      role: h.role,
      text: h.text || ''
    })),
    webMode,
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

