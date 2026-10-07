// Captures a single frame of a tab/window/screen the user picks in the browser's own share prompt.
// Read-only: the stream is stopped immediately after one frame.
export function isTabCaptureSupported() {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);
}

export async function captureSharedTabFrame() {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false, preferCurrentTab: false });
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    await new Promise((resolve) => (video.readyState >= 2 && video.videoWidth ? resolve() : video.addEventListener('loadeddata', resolve, { once: true })));
    await new Promise((resolve) => setTimeout(resolve, 250));
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new Error('Could not capture the tab.');
    return new File([blob], 'shared-tab.jpg', { type: 'image/jpeg' });
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}
