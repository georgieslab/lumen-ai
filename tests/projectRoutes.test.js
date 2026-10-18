import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { createProjectStore } from '../services/projectStore.js';
import { createProjectRouter, projectWidgetId } from '../services/projectRoutes.js';
import { createMissionRouter } from '../services/missionRoutes.js';
import { createMissionStore } from '../services/missionStore.js';
import { createMissionManager } from '../services/missionManager.js';

async function fixture(t) {
  const scratch = path.resolve('scratch'); await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(path.join(scratch, 'lumen-project-routes-'));
  const projects = createProjectStore({ directory: path.join(directory, 'projects') });
  const missions = createMissionManager({ store: createMissionStore({ directory: path.join(directory, 'missions') }),
    execute: async () => ({ reply: 'Useful outcome', widgets: [{ widgetType: 'checklist', checklistId: 'tasks', title: 'Project tasks' }], tools: [] }) });
  await Promise.all([projects.ready, missions.ready]);
  const app = express(); app.use(express.json({ limit: '2mb' }));
  app.use('/api/missions', createProjectRouter({ store: projects, missions }));
  app.use('/api/missions', createMissionRouter({ manager: missions }));
  const server = createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await missions.close();
    assert.equal(path.dirname(directory), scratch); await rm(directory, { recursive: true, force: true });
  });
  const request = (route, { cookie, method = 'GET', body, requestOrigin = origin } = {}) => fetch(`${origin}/api/missions${route}`, {
    method, headers: { Origin: requestOrigin, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const session = async () => {
    const response = await request('/session', { method: 'POST' }); assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie').split(';')[0];
    return { cookie, ownerId: `guest:${cookie.split('=')[1]}` };
  };
  const create = async (cookie, name = 'Launch') => {
    const response = await request('/projects', { cookie, method: 'POST', body: { name } });
    assert.equal(response.status, 201); return (await response.json()).project;
  };
  return { projects, missions, request, session, create };
}

test('projects reuse confirmed mission ownership and never create a second cookie', async (t) => {
  const { request, session, create } = await fixture(t);
  assert.deepEqual(await (await request('/projects')).json(), { projects: [] });
  const missing = await request('/projects', { method: 'POST', body: { name: 'No session' } });
  assert.equal(missing.status, 428); assert.equal(missing.headers.get('set-cookie'), null);
  const { cookie } = await session();
  const project = await create(cookie);
  const listed = await request('/projects', { cookie });
  assert.equal(listed.headers.get('cache-control'), 'no-store');
  const items = (await listed.json()).projects;
  assert.equal(items[0].id, project.id); assert.equal(items[0].instructions, undefined);
  assert.equal((await request('/projects', { cookie, method: 'POST', requestOrigin: 'https://evil.example', body: { name: 'Blocked' } })).status, 403);
  assert.equal((await request('/projects/unknown/nested', { cookie })).status, 404);
  assert.equal((await request('', { cookie })).status, 200, 'project router passes ordinary mission routes through');
});

test('project metadata, files and reversible archive are private and origin protected', async (t) => {
  const { request, session, create } = await fixture(t);
  const { cookie } = await session(); const other = await session();
  const project = await create(cookie);
  assert.equal((await request(`/projects/${project.id}`, { cookie: other.cookie })).status, 404);
  assert.equal((await request(`/projects/${project.id}`, { cookie: other.cookie, method: 'PATCH', body: { name: 'Taken' } })).status, 404);
  const fileResponse = await request(`/projects/${project.id}/files`, { cookie, method: 'POST', body: { name: 'brief.md', text: '# Launch brief' } });
  assert.equal(fileResponse.status, 201);
  const file = (await fileResponse.json()).project.files[0];
  const route = `/projects/${project.id}/files/${file.id}`;
  assert.equal((await request(route, { cookie: other.cookie, method: 'DELETE' })).status, 404);
  assert.equal((await request(route, { cookie, method: 'DELETE', requestOrigin: 'https://evil.example' })).status, 403);
  assert.equal((await request(route, { cookie, method: 'DELETE' })).status, 200);
  assert.equal((await request(`/projects/${project.id}`, { cookie, method: 'PATCH', body: { archived: true } })).status, 200);
  assert.deepEqual((await (await request('/projects', { cookie })).json()).projects, []);
  assert.equal((await (await request('/projects?includeArchived=true', { cookie })).json()).projects.length, 1);
  assert.equal((await request(`/projects/${project.id}`, { cookie, method: 'PATCH', body: { archived: false } })).status, 200);
});

test('pins and recent missions require both matching owner and matching project', async (t) => {
  const { missions, projects, request, session, create } = await fixture(t);
  const first = await session(); const other = await session();
  const project = await create(first.cookie);
  const anotherProject = await create(first.cookie, 'Other project');
  const makeMission = async (ownerId, projectId, title) => {
    const mission = await missions.create({ ownerId, requestId: randomUUID(), input: { transcript: title, projectId }, title });
    for (let i = 0; i < 100; i++) {
      const current = await missions.get(mission.id, ownerId);
      if (current.status === 'completed') return current;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error('Fixture mission did not complete');
  };
  const own = await makeMission(first.ownerId, project.id, 'This project');
  const wrongProject = await makeMission(first.ownerId, anotherProject.id, 'Different project');
  const wrongOwner = await makeMission(other.ownerId, project.id, 'Other owner');
  const pin = (missionId, widgetId = 'tasks', cookie = first.cookie) => request(`/projects/${project.id}/pins`, { cookie, method: 'POST', body: { missionId, widgetId } });
  assert.equal((await pin(wrongProject.id)).status, 404);
  assert.equal((await pin(wrongOwner.id)).status, 404);
  assert.equal((await pin(own.id, 'missing')).status, 404);
  assert.equal((await pin(own.id, 'tasks', other.cookie)).status, 404);
  const response = await pin(own.id);
  assert.equal(response.status, 201);
  const saved = (await response.json()).project;
  assert.equal(saved.pins[0].widgetType, 'checklist'); assert.equal(saved.pins[0].title, 'Project tasks');
  assert.equal(saved.pins[0].widget, undefined);
  const detail = await (await request(`/projects/${project.id}`, { cookie: first.cookie })).json();
  assert.deepEqual(detail.recentMissions.map((item) => item.id), [own.id]);
  assert.equal(detail.pinnedArtifacts[0].available, true);
  assert.equal(detail.pinnedArtifacts[0].widget.checklistId, 'tasks');
  assert.equal(JSON.stringify(detail).includes('Other owner'), false);
  assert.equal((await projects.get(project.id, first.ownerId)).pins.length, 1);
  assert.equal((await pin(own.id, 'mission')).status, 201);
  const wholeMission = (await (await request(`/projects/${project.id}`, { cookie: first.cookie })).json()).pinnedArtifacts.find((item) => item.widgetId === 'mission');
  assert.equal(wholeMission.widget.widgetType, 'mission');
  assert.equal(wholeMission.widget.replyText, 'Useful outcome');
  assert.equal(wholeMission.widget.audioBase64, undefined);
  const originalGet = missions.get;
  missions.get = async (...args) => ({ ...await originalGet(...args), replyText: 'x'.repeat(9000), audioBase64: 'private audio', context: { private: true } });
  const capped = (await (await request(`/projects/${project.id}`, { cookie: first.cookie })).json()).pinnedArtifacts.find((item) => item.widgetId === 'mission');
  assert.equal(capped.widget.replyText.length, 6000);
  assert.equal(capped.widget.audioBase64, undefined); assert.equal(capped.widget.context, undefined);
  missions.get = originalGet;
  const unpinRoute = `/projects/${project.id}/pins/${saved.pins[0].id}`;
  assert.equal((await request(unpinRoute, { cookie: other.cookie, method: 'DELETE' })).status, 404);
  assert.equal((await request(unpinRoute, { cookie: first.cookie, method: 'DELETE' })).status, 200);
});

test('project artifact identity matches all current card IDs and stable mission indices', () => {
  for (const key of ['artifactId', 'id', 'checklistId', 'scheduleId', 'budgetId', 'comparisonId', 'briefId', 'reportId']) {
    assert.equal(projectWidgetId({ [key]: 'actual-id', widgetType: 'checklist' }), 'actual-id');
  }
  assert.equal(projectWidgetId({ widgetType: 'pdf_document', fileName: 'report.pdf' }), 'report.pdf');
  assert.equal(projectWidgetId({ widgetType: 'weather' }, 2), 'weather:2');
});
