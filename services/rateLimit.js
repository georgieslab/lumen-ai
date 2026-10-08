// A small in-memory sliding-window limit, so one visitor cannot run up the AI and web-fetch bill.
// It resets when the server restarts and is per server instance, which is enough for cost control.

export function createRateLimiter({ windowMs, max, now = () => Date.now() }) {
  const hits = new Map();

  function prune(key, current) {
    const recent = (hits.get(key) || []).filter((time) => current - time < windowMs);
    if (recent.length) hits.set(key, recent);
    else hits.delete(key);
    return recent;
  }

  return {
    check(key) {
      const current = now();
      const recent = prune(key, current);
      if (recent.length >= max) {
        return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, windowMs - (current - recent[0])) };
      }
      recent.push(current);
      hits.set(key, recent);
      return { allowed: true, remaining: max - recent.length, retryAfterMs: 0 };
    },
    // Keeps the map from growing forever on a long-lived server.
    sweep() {
      const current = now();
      for (const key of [...hits.keys()]) prune(key, current);
      return hits.size;
    }
  };
}

// Express middleware. `keyFor(req)` picks who is being limited (the signed-in user, else the IP address).
export function rateLimitMiddleware(limiter, keyFor, message = 'Too many requests. Please try again later.') {
  return (req, res, next) => {
    const result = limiter.check(keyFor(req));
    if (result.allowed) return next();
    const seconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
    res.setHeader('Retry-After', String(seconds));
    return res.status(429).json({ error: `${message} Try again in ${seconds < 90 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`}.` });
  };
}
