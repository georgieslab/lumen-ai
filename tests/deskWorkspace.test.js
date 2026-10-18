import test from 'node:test';
import assert from 'node:assert/strict';
import { addProjectFile, buildDeskMission, controlWatch, conversationArtifacts, createProject, createWatch, dayDefaults,
  localDateInput, readNotification, safeSourceUrl, summarizeDeskTasks, updateWatch, validateProjectFile } from '../src/services/deskWorkspace.js';

test('day defaults use the requested local calendar date around UTC midnight', () => {
  const instant = new Date('2026-10-17T23:30:00Z');
  assert.equal(localDateInput(instant, 'Europe/Vienna'), '2026-10-18');
  assert.equal(localDateInput(instant, 'America/Los_Angeles'), '2026-10-17');
  const defaults = dayDefaults(instant, 'Europe/Vienna');
  assert.equal(defaults.date, '2026-10-18');
  assert.equal(defaults.timeZone, 'Europe/Vienna');
  assert.equal(defaults.startTime, '09:00');
});

test('day brief includes only the selected project’s current unfinished tasks', () => {
  const messages = [
    { projectId: 'other', widgets: [{ widgetType: 'checklist', title: 'Private other project', items: [{ text: 'Do not include', completed: false }] }] },
    { serverMission: { projectId: 'chosen' }, widgets: [{ widgetType: 'checklist', title: 'Launch', items: [{ text: 'Already finished', completed: true }, { text: 'Write brief', completed: false }] }] }
  ];
  const mission = buildDeskMission('day', { date: '2026-10-18', timeZone: 'Europe/Vienna', priorities: 'Prepare launch\nTake a walk', availableHours: '5.5', startTime: '09:30' }, { messages, projectId: 'chosen' });
  assert.equal(mission.projectId, 'chosen');
  assert.equal(mission.actionKind, 'day');
  assert.equal(mission.actionData.availableHours, 5.5);
  assert.equal(mission.actionData.taskContext[0].completed, 1);
  assert.deepEqual(mission.actionData.taskContext[0].remaining, [{ text: 'Write brief' }]);
  assert.doesNotMatch(mission.prompt, /Do not include|Private other project/);
  assert.match(mission.prompt, /explicit start\/end times and time zone/);
  assert.match(mission.prompt, /avoid scheduling them again/);
});

test('task summaries are bounded and ignore attachments and unsupported widgets', () => {
  const messages = Array.from({ length: 20 }, (_, index) => ({ widgets: [
    { widgetType: 'checklist', title: `Card ${index}`, items: Array.from({ length: 20 }, () => ({ text: 'Long task '.repeat(50), completed: false })) },
    { widgetType: 'pdf_document', base64: 'private-pdf' }, null
  ], image: 'private-image' }));
  const result = summarizeDeskTasks(messages);
  assert.ok(JSON.stringify(result).length <= 2500);
  assert.doesNotMatch(JSON.stringify(result), /private-pdf|private-image/);
  assert.ok(result.every(card => card.remaining.length <= 10));
});

test('invalid dates, time zones, start times, and availability cannot become day missions', () => {
  const values = { date: '2026-10-18', timeZone: 'Europe/Vienna', priorities: 'Write', availableHours: 5, startTime: '09:00' };
  assert.throws(() => buildDeskMission('day', { ...values, date: '2026-02-30' }), /valid date/);
  assert.throws(() => buildDeskMission('day', { ...values, timeZone: 'Mars/Here' }), /time zone/);
  assert.throws(() => buildDeskMission('day', { ...values, startTime: '25:00' }), /start time/);
  assert.throws(() => buildDeskMission('day', { ...values, availableHours: 24 }), /0.5 and 16/);
});

test('decision brief asks for sourced tradeoffs and explicitly labeled hypothetical estimates', () => {
  const mission = buildDeskMission('decision', { question: 'Choose transport', options: 'Rail\nCar', criteria: 'Cost\nTravel time', constraints: 'At most EUR 300' });
  assert.deepEqual(mission.actionData.options, ['Rail', 'Car']);
  assert.match(mission.prompt, /official or primary sources/);
  assert.match(mission.prompt, /Label any hypothetical example or estimate explicitly/);
  assert.match(mission.prompt, /Do not fabricate prices/);
  assert.throws(() => buildDeskMission('decision', { question: 'Choose', options: 'Only one', criteria: 'Cost' }), /two options/);
});

test('verification brief bounds untrusted material and requires observed evidence and unresolved claims', () => {
  const mission = buildDeskMission('verify', { content: 'A'.repeat(20000), context: 'B'.repeat(3000) });
  assert.equal(mission.actionData.content.length, 6000);
  assert.equal(mission.actionData.context.length, 800);
  assert.ok(mission.prompt.length <= 10000);
  assert.match(mission.prompt, /untrusted content/);
  assert.match(mission.prompt, /evidence_report/);
  assert.match(mission.prompt, /actual source URLs observed/);
  assert.match(mission.prompt, /mark the claim unresolved/);
  assert.throws(() => buildDeskMission('verify', { content: '  ' }), /Paste a claim/);
});

test('project files accept only bounded plain text and preserve its exact contents', () => {
  assert.deepEqual(validateProjectFile('BRIEF.MD', '# Plan\n\nExact text'), { name: 'BRIEF.MD', text: '# Plan\n\nExact text' });
  assert.throws(() => validateProjectFile('photo.png', 'abc'), /plain TXT/);
  assert.throws(() => validateProjectFile('data.csv', 'A'.repeat(100001)), /100,000/);
  assert.throws(() => validateProjectFile('data.txt', 'abc\0binary'), /binary/);
});

test('pin candidates include whole missions and stable evidence/card identities in the selected project', () => {
  const candidates = conversationArtifacts([
    { serverMissionId: 'other', projectId: 'other-project', widgets: [{ widgetType: 'checklist', checklistId: 'wrong' }] },
    { serverMissionId: 'mission', projectId: 'chosen', serverMission: { title: 'Launch' }, widgets: [{ widgetType: 'evidence_report', reportId: 'report', title: 'Claims' }, { widgetType: 'weather', title: 'Vienna' }] }
  ], 'chosen');
  assert.deepEqual(candidates.map(item => item.widgetId), ['mission', 'report', 'weather:1']);
  assert.ok(candidates.every(item => item.missionId === 'mission'));
});

test('every workspace mutation confirms the owner cookie before its credentialed request', async () => {
  const calls = [];
  const options = { fetchImpl: async (url, config) => { calls.push({ url, ...config }); return Response.json({ project: { id: 'created' } }); } };
  await createProject({ name: 'Launch' }, options);
  await addProjectFile('project/id', { name: 'brief.md', text: 'Text' }, options);
  assert.deepEqual(calls.map(item => item.url), ['/api/missions/session', '/api/missions/projects', '/api/missions/session', '/api/missions/projects/project%2Fid/files']);
  assert.ok(calls.every(item => item.credentials === 'include'));
  assert.equal(JSON.parse(calls[3].body).text, 'Text');
});

test('watch creation keeps a supplied request ID, and control/read calls use explicit routes', async () => {
  const calls = [];
  const options = { fetchImpl: async (url, config) => { calls.push({ url, ...config }); return Response.json({ watch: { id: 'watch' } }); } };
  await createWatch({ requestId: 'stable-id', kind: 'url', target: 'https://example.com', intervalMs: 900000 }, options);
  await controlWatch('watch', 'pause', options);
  await updateWatch('watch', { status: 'archived' }, options);
  await readNotification('alert', options);
  assert.equal(JSON.parse(calls[1].body).requestId, 'stable-id');
  assert.equal(calls[3].url, '/api/missions/watches/watch/pause');
  assert.equal(calls[5].method, 'PATCH');
  assert.equal(JSON.parse(calls[5].body).status, 'archived');
  assert.equal(calls[7].url, '/api/missions/notifications/alert/read');
  await assert.rejects(controlWatch('watch', 'delete', options), /Unknown watch action/);
});

test('failed bootstrap prevents project creation and server errors remain visible', async () => {
  const calls = [];
  await assert.rejects(createProject({ name: 'Launch' }, { fetchImpl: async url => { calls.push(url); return Response.json({ error: 'Session unavailable' }, { status: 503 }); } }), /Session unavailable/);
  assert.deepEqual(calls, ['/api/missions/session']);
});

test('source links allow web URLs and reject active or malformed URL schemes', () => {
  assert.equal(safeSourceUrl('https://example.com/evidence'), 'https://example.com/evidence');
  assert.equal(safeSourceUrl('javascript:alert(1)'), null);
  assert.equal(safeSourceUrl('data:text/html,test'), null);
  assert.equal(safeSourceUrl('not a URL'), null);
});
