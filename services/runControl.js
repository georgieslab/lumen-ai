// Lets a long server job notice that the browser stopped listening (the user pressed Stop, closed the
// tab, or the connection dropped) so it can stop early instead of finishing work nobody will read.
export function watchClient(res, { timeoutMs = 0 } = {}) {
  const controller = new AbortController();
  const timeout = timeoutMs > 0 ? setTimeout(() => controller.abort(new Error('The request deadline was reached.')), timeoutMs) : null;
  timeout?.unref?.();
  const cleanup = () => { if (timeout) clearTimeout(timeout); };
  res.on('finish', cleanup);
  res.on('close', () => {
    cleanup();
    // 'close' also fires after a normal finish; only an unfinished response means the client left.
    if (!res.writableFinished) controller.abort();
  });
  return {
    signal: controller.signal,
    get cancelled() {
      return controller.signal.aborted;
    },
    throwIfCancelled() {
      if (controller.signal.aborted) {
        const error = new Error('The client stopped waiting for this response.');
        error.name = 'AbortError';
        throw error;
      }
    }
  };
}
