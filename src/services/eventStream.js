// SSE framing is shared by chat and research; callback failures must propagate to the caller.
export async function consumeJsonEventStream(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let dataLines = [];
  let stopped = false;
  const dispatch = () => {
    if (!dataLines.length) return;
    const data = dataLines.join('\n');
    dataLines = [];
    if (data.trim() && onEvent(JSON.parse(data)) === false) stopped = true;
  };
  const line = (value) => {
    const normalized = value.endsWith('\r') ? value.slice(0, -1) : value;
    if (!normalized) dispatch();
    else if (normalized.startsWith('data:')) dataLines.push(normalized.slice(5).replace(/^ /, ''));
  };
  let reachedEnd = false;
  try {
    while (!stopped) {
      const { done, value } = await reader.read();
      if (done) {
        reachedEnd = true;
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newline;
      while (!stopped && (newline = buffer.indexOf('\n')) !== -1) {
        line(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
    }
    if (!stopped) {
      if (buffer) line(buffer);
      dispatch();
    }
  } finally {
    // Stop the response on a malformed event or explicit server failure.
    if (!reachedEnd) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
