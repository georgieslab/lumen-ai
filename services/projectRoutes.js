import { Router } from 'express';
import { requireTrustedOrigin } from './authSession.js';
import { missionOwner } from './missionRoutes.js';
import { isMissionId, missionError } from './missionStore.js';

export function projectWidgetId(widget, index = 0) {
  return String(widget?.artifactId || widget?.id || widget?.checklistId || widget?.scheduleId || widget?.budgetId
    || widget?.comparisonId || widget?.briefId || widget?.reportId || (widget?.widgetType === 'pdf_document' && widget.fileName) || `${widget?.widgetType || 'artifact'}:${index}`);
}

function missionWidget(mission) {
  return { widgetType: 'mission', missionId: mission.id, title: mission.title, replyText: String(mission.replyText || '').slice(0, 6000), status: mission.status };
}

export function createProjectRouter({ store, missions }) {
  const router = Router();
  router.use((req, res, next) => {
    if (req.path !== '/projects' && !req.path.startsWith('/projects/')) return next('router');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  const handle = (operation) => async (req, res, next) => {
    try { await operation(req, res); } catch (error) { next(error); }
  };
  const owner = (req, res, mutation = false) => {
    const ownerId = missionOwner(req, res);
    if (!ownerId) throw missionError(mutation ? 'Initialize a mission session before changing project spaces.' : 'Project not found.', mutation ? 428 : 404);
    return ownerId;
  };
  const project = async (id, ownerId) => {
    const value = await store.get(id, ownerId);
    if (!value) throw missionError('Project not found.', 404);
    return value;
  };
  const ownedMission = async (id, ownerId, projectId) => {
    if (!isMissionId(id)) throw missionError('Invalid mission ID.');
    const record = await missions.getRecord(id, ownerId);
    if (record.input?.projectId !== projectId) throw missionError('This output does not belong to this project.', 404);
    return record;
  };

  router.get('/projects', handle(async (req, res) => {
    const ownerId = missionOwner(req, res);
    const projects = ownerId ? await store.list(ownerId, { includeArchived: req.query.includeArchived === 'true' }) : [];
    res.json({ projects });
  }));
  router.post('/projects', requireTrustedOrigin, handle(async (req, res) => {
    res.status(201).json({ project: await store.create(owner(req, res, true), req.body) });
  }));
  router.get('/projects/:id', handle(async (req, res) => {
    const ownerId = owner(req, res);
    const value = await project(req.params.id, ownerId);
    const missionCache = new Map();
    const snapshots = new Map();
    const publicMission = (id) => {
      if (!snapshots.has(id)) snapshots.set(id, missions.get(id, ownerId));
      return snapshots.get(id);
    };
    const rawMission = async (id) => {
      if (!missionCache.has(id)) missionCache.set(id, ownedMission(id, ownerId, value.id).catch((error) => {
        if ((error.statusCode || error.status) === 404) return null;
        throw error;
      }));
      return missionCache.get(id);
    };
    const recentMissions = [];
    for (const item of await missions.list(ownerId)) {
      if (item.projectId && item.projectId !== value.id) continue;
      if (!await rawMission(item.id)) continue;
      const { id, title, transcript, status, createdAt, updatedAt, canResume, error, checkpoint, revision } = item;
      recentMissions.push({ id, title, transcript, status, createdAt, updatedAt, canResume, error, checkpoint, revision, projectId: value.id });
      if (recentMissions.length >= 20) break;
    }
    const pinnedArtifacts = [];
    for (const pin of value.pins) {
      const record = await rawMission(pin.missionId);
      let widget = null;
      if (record) {
        const snapshot = await publicMission(pin.missionId);
        widget = pin.widgetId === 'mission' ? missionWidget(snapshot)
          : snapshot.widgets?.find((item, index) => projectWidgetId(item, index) === pin.widgetId) || null;
      }
      pinnedArtifacts.push({ ...pin, widget, available: !!widget });
    }
    res.json({ project: value, recentMissions, pinnedArtifacts });
  }));
  router.patch('/projects/:id', requireTrustedOrigin, handle(async (req, res) => {
    res.json({ project: await store.update(req.params.id, owner(req, res, true), req.body) });
  }));
  router.post('/projects/:id/files', requireTrustedOrigin, handle(async (req, res) => {
    res.status(201).json({ project: await store.addFile(req.params.id, owner(req, res, true), req.body) });
  }));
  router.delete('/projects/:id/files/:fileId', requireTrustedOrigin, handle(async (req, res) => {
    res.json({ project: await store.removeFile(req.params.id, owner(req, res, true), req.params.fileId) });
  }));
  router.post('/projects/:id/pins', requireTrustedOrigin, handle(async (req, res) => {
    const ownerId = owner(req, res, true);
    const value = await project(req.params.id, ownerId);
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)
      || Object.keys(req.body).some((key) => !['missionId', 'widgetId'].includes(key)) || typeof req.body.widgetId !== 'string') {
      throw missionError('Choose a mission and artifact to pin.');
    }
    await ownedMission(req.body.missionId, ownerId, value.id);
    const mission = await missions.get(req.body.missionId, ownerId);
    const widget = req.body.widgetId === 'mission' ? missionWidget(mission)
      : mission.widgets?.find((item, index) => projectWidgetId(item, index) === req.body.widgetId);
    if (!widget) throw missionError('Artifact not found in this mission.', 404);
    const saved = await store.pin(value.id, ownerId, { missionId: mission.id, widgetId: req.body.widgetId,
      widgetType: String(widget.widgetType || 'artifact'), title: String(widget.title || mission.title || 'Pinned output').slice(0, 160) });
    res.status(201).json({ project: saved });
  }));
  router.delete('/projects/:id/pins/:pinId', requireTrustedOrigin, handle(async (req, res) => {
    res.json({ project: await store.unpin(req.params.id, owner(req, res, true), req.params.pinId) });
  }));
  router.use((_req, res) => res.status(404).json({ error: 'Project endpoint not found.' }));
  router.use((error, _req, res, _next) => {
    if (res.headersSent) return res.end();
    const status = error.statusCode || error.status || 500;
    res.status(status).json({ error: status >= 500 ? 'Project storage or mission outputs are temporarily unavailable.' : error.message });
  });
  return router;
}
