import { Router } from 'express';
import { requireTrustedOrigin } from './authSession.js';
import { missionOwner } from './missionRoutes.js';
import { normalizeWatchRequest, watchError } from './watchStore.js';

// Mount before the generic /api/missions/:id router. Guest cookie creation stays
// with the session bootstrap; these routes never mint another owner identity.
export function createWatchRouter({ manager, watchLimit = (_req, _res, next) => next() }) {
  const router = Router();
  const handle = operation => async (req, res, next) => { try { await operation(req, res); } catch (error) { next(error); } };
  const owner = (req, res) => {
    const ownerId = missionOwner(req, res);
    if (!ownerId) throw watchError('Watch not found.', 404);
    return ownerId;
  };
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/watches', handle(async (req, res) => {
    const ownerId = missionOwner(req, res);
    res.json({ watches: ownerId ? await manager.list(ownerId) : [] });
  }));
  router.post('/watches', requireTrustedOrigin, watchLimit, handle(async (req, res) => {
    const input = normalizeWatchRequest(req.body);
    res.status(202).json({ watch: await manager.create({ ownerId: owner(req, res), ...input }) });
  }));
  router.get('/watches/:id', handle(async (req, res) => { res.json({ watch: await manager.get(req.params.id, owner(req, res)) }); }));
  router.patch('/watches/:id', requireTrustedOrigin, watchLimit, handle(async (req, res) => {
    res.json({ watch: await manager.update(req.params.id, owner(req, res), req.body) });
  }));
  router.post('/watches/:id/check', requireTrustedOrigin, watchLimit, handle(async (req, res) => {
    res.json({ watch: await manager.check(req.params.id, owner(req, res), { requestId: req.body?.requestId }) });
  }));
  for (const action of ['pause', 'resume', 'archive']) {
    router.post(`/watches/:id/${action}`, requireTrustedOrigin, ...(action === 'resume' ? [watchLimit] : []), handle(async (req, res) => {
      res.json({ watch: await manager[action](req.params.id, owner(req, res)) });
    }));
  }
  router.get('/notifications', handle(async (req, res) => {
    const ownerId = missionOwner(req, res);
    res.json({ notifications: ownerId ? await manager.notifications(ownerId) : [] });
  }));
  router.post('/notifications/:id/read', requireTrustedOrigin, handle(async (req, res) => {
    res.json({ notification: await manager.acknowledge(req.params.id, owner(req, res)) });
  }));
  router.use((error, _req, res, _next) => {
    const status = error.statusCode || error.status || 500;
    if (status >= 500) console.error('Watch service unavailable:', error.message);
    res.status(status).json({ error: status >= 500 ? 'Watch storage or execution is unavailable. Saved results were kept.' : error.message });
  });
  return router;
}
