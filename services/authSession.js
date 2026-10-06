import { createHmac, timingSafeEqual } from 'crypto';

const SESSION_COOKIE = 'lumen_session';
const OAUTH_STATE_COOKIE = 'lumen_github_oauth_state';
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret() {
  const secret = process.env.LUMEN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('Authentication is not configured. Set LUMEN_SESSION_SECRET to a random value of at least 32 characters.');
  }
  return secret;
}

function sign(value) {
  return createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

function appendCookie(res, name, value, maxAge, { httpOnly = true, sameSite = 'Lax' } = {}) {
  const production = process.env.NODE_ENV === 'production';
  const crossSite = production && process.env.LUMEN_CROSS_SITE_COOKIES === 'true';
  const secure = production || crossSite ? '; Secure' : '';
  const cookieSameSite = crossSite ? 'None' : sameSite;
  res.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/api; Max-Age=${maxAge}; SameSite=${cookieSameSite}${httpOnly ? '; HttpOnly' : ''}${secure}`);
}

function parseCookies(req) {
  return (req.headers.cookie || '').split(';').reduce((cookies, part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return cookies;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch (_) {
      cookies[name] = '';
    }
    return cookies;
  }, {});
}

export function setGithubOAuthState(res, state) {
  appendCookie(res, OAUTH_STATE_COOKIE, state, 600);
}

export function clearGithubOAuthState(res) {
  appendCookie(res, OAUTH_STATE_COOKIE, '', 0);
}

export function getGithubOAuthState(req) {
  return parseCookies(req)[OAUTH_STATE_COOKIE] || '';
}

export function setSessionCookie(res, user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: `${user.provider}:${user.id}`,
    provider: user.provider,
    id: String(user.id),
    email: user.email || null,
    name: user.name || 'Lumen user',
    picture: user.picture || null,
    iat: now,
    exp: now + SESSION_LIFETIME_SECONDS
  })).toString('base64url');
  appendCookie(res, SESSION_COOKIE, `${payload}.${sign(payload)}`, SESSION_LIFETIME_SECONDS);
}

export function clearSessionCookie(res) {
  appendCookie(res, SESSION_COOKIE, '', 0);
}

export function getSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const [payload, signature, ...extra] = token.split('.');
  if (!payload || !signature || extra.length > 0) return null;
  let expected;
  try {
    expected = Buffer.from(sign(payload));
  } catch (_) {
    return null;
  }
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!user.sub || !user.provider || !user.id || user.exp <= Date.now() / 1000) return null;
    return user;
  } catch (_) {
    return null;
  }
}

export function requireSession(req, res, next) {
  const user = getSession(req);
  if (!user) {
    return res.status(401).json({ error: 'Sign in again to access your cloud profile and memories.' });
  }
  req.authUser = user;
  next();
}

export function requireTrustedOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin) {
    return res.status(403).json({ error: 'A trusted browser origin is required for this request.' });
  }

  const allowedOrigins = (process.env.LUMEN_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const requestOrigin = `${req.protocol}://${req.get('host')}`;
  const isLocalDevelopmentOrigin = process.env.NODE_ENV !== 'production' &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (origin !== requestOrigin && !allowedOrigins.includes(origin) && !isLocalDevelopmentOrigin) {
    return res.status(403).json({ error: 'This request did not come from an allowed Lumen origin.' });
  }
  next();
}
