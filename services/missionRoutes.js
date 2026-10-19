import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { getSession, requireTrustedOrigin } from './authSession.js';
import { missionError } from './missionStore.js';
import { normalizeDeskAction } from './deskActions.js';
import { normalizeResponseStyle } from './responsePreferences.js';

const OWNER_COOKIE = 'lumen_mission_owner';
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TERMINAL = new Set(['completed', 'paused', 'failed', 'cancelled']);

export function missionOwner(req, res, { create = false } = {}) {
  const session = getSession(req);
  if (session) return session.sub;
  const cookie = String(req.headers.cookie || '').split(';').find((part) => part.trim().startsWith(`${OWNER_COOKIE}=`));
  const value = cookie?.trim().slice(OWNER_COOKIE.length + 1);
  if (value && /^[a-zA-Z0-9_-]{43}$/.test(value)) return `guest:${value}`;
  if (!create) return null;
  const token = randomBytes(32).toString('base64url');
  const secure = process.env.NODE_ENV === 'production';
  const crossSite = secure && process.env.LUMEN_CROSS_SITE_COOKIES === 'true';
  res.append('Set-Cookie', `${OWNER_COOKIE}=${token}; Path=/api/missions; Max-Age=2592000; HttpOnly; SameSite=${crossSite ? 'None' : 'Lax'}${secure ? '; Secure' : ''}`);
  return `guest:${token}`;
}

function boundedText(value, maximum, label, optional = false) {
  if (optional && value == null) return '';
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.length > maximum) throw missionError(`${label} must be ${optional ? 'up to' : 'between 1 and'} ${maximum} characters.`);
  return value.trim();
}

export function normalizeMissionRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw missionError('A mission request is required.');
  if (body.file || body.image || body.plan) throw missionError('Persistent missions currently support text and shared page context. Use the attachment or research flow for files and approved research plans.');
  if (typeof body.requestId !== 'string' || !REQUEST_ID.test(body.requestId)) throw missionError('A UUID requestId is required to safely recover this request.');
  const transcript = boundedText(body.transcript, 10000, 'The mission request');
  const history = body.history == null ? [] : body.history;
  if (!Array.isArray(history) || history.length > 8) throw missionError('Mission history must contain at most eight messages.');
  const sanitizedHistory = history.map((item) => {
    if (!item || !['user', 'assistant'].includes(item.role)) throw missionError('Mission history contains an invalid role.');
    return { role: item.role, text: boundedText(item.text, 18000, 'A history message', true) };
  });
  const webMode = body.webMode || 'auto';
  if (!['auto', 'always', 'off'].includes(webMode)) throw missionError('Invalid web mode.');
  const timeZone = boundedText(body.timeZone, 80, 'Time zone', true);
  if (timeZone) {
    try { new Intl.DateTimeFormat('en-US', { timeZone }).format(); }
    catch { throw missionError('A valid IANA time zone is required.'); }
  }
  let pageContext = null;
  if (body.pageContext != null) {
    if (typeof body.pageContext !== 'object' || Array.isArray(body.pageContext)) throw missionError('Invalid shared page context.');
    pageContext = {
      text: boundedText(body.pageContext.text, 20000, 'Shared page text', true),
      title: boundedText(body.pageContext.title, 200, 'Shared page title', true),
      url: boundedText(body.pageContext.url, 2000, 'Shared page URL', true)
    };
  }
  return {
    requestId: body.requestId.toLowerCase(),
    input: {
      transcript, history: sanitizedHistory, webMode, pageContext,
      ...normalizeDeskAction(body),
      language: boundedText(body.language || 'en-US', 30, 'Language'),
      tone: boundedText(body.tone || 'friendly', 30, 'Tone'),
      responseStyle: normalizeResponseStyle(boundedText(body.responseStyle || 'concise', 30, 'Response style')),
      voiceId: boundedText(body.voiceId, 50, 'Voice', true),
      timeZone
    }
  };
}

export function createMissionRouter({ manager, projects, chatLimit = (_req, _res, next) => next() }) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  const owner = (req, res, create = false) => {
    const id = missionOwner(req, res, { create });
    if (!id) throw missionError('Mission not found.', 404);
    return id;
  };
  const handle = (operation) => async (req, res, next) => {
    try { await operation(req, res); } catch (error) { next(error); }
  };

  // Confirm guest ownership before starting work, so losing the creation response
  // cannot also lose the cookie needed to recover its idempotent request ID.
  router.post('/session', requireTrustedOrigin, handle(async (req, res) => {
    owner(req, res, true);
    res.json({ ready: true });
  }));
  router.post('/', requireTrustedOrigin, chatLimit, handle(async (req, res) => {
    const { requestId, input } = normalizeMissionRequest(req.body);
    if (['decision', 'verify'].includes(input.actionKind) && input.webMode === 'off') throw missionError('Decision Desk and Verify this need web access for their source review.');
    const ownerId = missionOwner(req, res);
    if (!ownerId) throw missionError('Initialize a mission session before starting saved work.', 428);
    if (input.projectId) {
      const project = await projects?.get(input.projectId, ownerId);
      if (!project || project.archived) throw missionError('Choose an active project that belongs to this workspace.', 404);
    }
    const mission = await manager.create({ ownerId, requestId, input, title: input.transcript });
    res.status(202).json({ mission });
  }));
  router.get('/', handle(async (req, res) => {
    const ownerId = missionOwner(req, res);
    const missions = ownerId ? (await manager.list(ownerId)).slice(0, 100).map(({ id, title, transcript, status, createdAt, updatedAt, canResume, revision, checkpoint, error, recoveryReason, projectId, actionKind }) =>
      ({ id, title, transcript, status, createdAt, updatedAt, canResume, revision, checkpoint, error, recoveryReason, projectId, actionKind })) : [];
    res.json({ missions });
  }));
  router.get('/:id', handle(async (req, res) => { res.json({ mission: await manager.get(req.params.id, owner(req, res)) }); }));

  router.get('/:id/events', handle(async (req, res) => {
    const ownerId = owner(req, res);
    await manager.get(req.params.id, ownerId); // Authenticate before opening a successful stream.
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    let unsubscribe;
    let ended = false;
    let sentInitial = false;
    let latest;
    let flushTimer;
    const heartbeat = setInterval(() => { if (!ended) res.write(': keepalive\n\n'); }, 20000);
    heartbeat.unref?.();
    const cleanup = () => {
      ended = true;
      clearInterval(heartbeat);
      if (flushTimer) clearTimeout(flushTimer);
      unsubscribe?.();
    };
    const flush = () => {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = null;
      if (ended || !latest) return;
      const mission = latest;
      latest = null;
      if (res.writableLength > 2 * 1024 * 1024) { cleanup(); res.destroy(); return; }
      res.write(`data: ${JSON.stringify({ type: 'snapshot', mission })}\n\n`);
      sentInitial = true;
      if (TERMINAL.has(mission.status)) { cleanup(); res.end(); }
    };
    res.on('close', cleanup); // Leaving the view never stops the worker.
    try {
      unsubscribe = await manager.subscribe(req.params.id, ownerId, (mission) => {
        if (ended) return;
        latest = mission;
        if (TERMINAL.has(mission.status) || !sentInitial) flush();
        else if (!flushTimer) flushTimer = setTimeout(flush, 150);
      });
      if (ended) unsubscribe();
    } catch (error) {
      cleanup();
      if (!res.writableEnded) { res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`); res.end(); }
    }
  }));
  for (const action of ['pause', 'resume', 'cancel']) {
    router.post(`/:id/${action}`, requireTrustedOrigin, ...(action === 'resume' ? [chatLimit] : []), handle(async (req, res) => {
      res.json({ mission: await manager[action](req.params.id, owner(req, res)) });
    }));
  }
  router.use((_req, res) => res.status(404).json({ error: 'Mission endpoint not found.' }));
  router.use((error, _req, res, _next) => {
    if (res.headersSent) return res.end();
    const status = error.statusCode || error.status || 500;
    if (status >= 500) console.error('Mission service error:', error.message);
    res.status(status).json({ error: status >= 500 ? 'Mission storage or execution is unavailable. Saved checkpoints have been kept.' : error.message });
  });
  return router;
}
