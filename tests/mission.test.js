import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activityFromTools,
  applyProgress,
  applyToolStart,
  createMission,
  elapsedLabel,
  finishMission,
  isAbortError,
  markWriting,
  missionActivity,
  researchTopic,
  RESEARCH_STEPS,
  summarizeToolInput
} from '../src/services/mission.js';

const states = (mission) => mission.steps.map((step) => step.state);

test('a research mission starts with the first step active', () => {
  const mission = createMission({ kind: 'research', title: 'EU AI rules', now: 1000 });
  assert.deepEqual(mission.steps.map((step) => step.id), RESEARCH_STEPS);
  assert.deepEqual(states(mission), ['active', 'pending', 'pending', 'pending']);
  assert.equal(mission.status, 'running');
  assert.equal(createMission({ kind: 'chat' }).steps.length, 0);
});

test('progress events move the active step forward and never backwards', () => {
  let mission = createMission({ kind: 'research', now: 0 });
  mission = applyProgress(mission, { stage: 'search', progress: 28, searchesCompleted: 3, searchesTotal: 3, sources: 9 });
  assert.equal(mission.steps[0].meta.searchesCompleted, 3);
  assert.equal(mission.steps[0].meta.searchesTotal, 3);
  mission = applyProgress(mission, { stage: 'reading', progress: 35, sources: 9 });
  assert.deepEqual(states(mission), ['done', 'active', 'pending', 'pending']);
  assert.equal(mission.steps[1].meta.sources, 9);
  mission = applyProgress(mission, { stage: 'synthesis', progress: 65, pagesRead: 5 });
  assert.deepEqual(states(mission), ['done', 'done', 'active', 'pending']);
  assert.equal(mission.steps[1].meta.sources, 9, 'earlier details are kept');
  assert.equal(mission.steps[2].meta.pagesRead, 5);
  mission = applyProgress(mission, { stage: 'search', progress: 10 });
  assert.equal(mission.progress, 65, 'progress never goes down');
});

test('unknown stages and finished missions are left alone', () => {
  const mission = createMission({ kind: 'research', now: 0 });
  assert.equal(applyProgress(mission, { stage: 'mystery' }), mission);
  const finished = finishMission(mission, { status: 'done', now: 5 });
  assert.equal(applyProgress(finished, { stage: 'pdf', progress: 88 }), finished);
});

test('tool steps open a chat mission, close the previous step and stay capped', () => {
  let mission = applyToolStart(null, { name: 'live_web_search', input: { query: 'ai news' } }, 10);
  assert.equal(mission.kind, 'chat');
  assert.deepEqual(states(mission), ['active']);
  mission = applyToolStart(mission, { name: 'browse_web_page', input: { url: 'https://www.example.com/a' } });
  assert.deepEqual(states(mission), ['done', 'active']);
  assert.equal(mission.steps[1].params.host, 'example.com');
  for (let i = 0; i < 12; i += 1) mission = applyToolStart(mission, { name: 'get_live_weather', input: { city: 'Rome' } });
  assert.equal(mission.steps.length, 8);
});

test('the first streamed words close the running tool step', () => {
  const mission = applyToolStart(null, { name: 'live_web_search', input: {} });
  assert.deepEqual(states(markWriting(mission)), ['done']);
  assert.equal(markWriting(null), null);
});

test('finishing marks steps by how the task ended', () => {
  const running = applyProgress(createMission({ kind: 'research', now: 0 }), { stage: 'reading', progress: 30 });
  assert.deepEqual(states(finishMission(running, { status: 'done', now: 9 })), ['done', 'done', 'done', 'done']);
  assert.deepEqual(states(finishMission(running, { status: 'stopped', now: 9 })), ['done', 'stopped', 'skipped', 'skipped']);
  assert.deepEqual(states(finishMission(running, { status: 'failed', now: 9 })), ['done', 'failed', 'skipped', 'skipped']);
  assert.equal(finishMission(running, { status: 'done', now: 9 }).progress, 100);
  assert.equal(finishMission(null), null);
});

test('tool inputs are summarised safely for display', () => {
  assert.deepEqual(summarizeToolInput('live_web_search', { query: '  many   spaces  ' }), { query: 'many spaces' });
  assert.deepEqual(summarizeToolInput('browse_web_page', { url: 'https://www.nature.com/articles/x?y=1' }), { host: 'nature.com' });
  assert.deepEqual(summarizeToolInput('browse_web_page', { url: 'not a url' }), { host: 'not a url' });
  assert.deepEqual(summarizeToolInput('get_live_weather', { location: 'Vienna' }), { city: 'Vienna' });
  assert.deepEqual(summarizeToolInput('get_crypto_and_market_prices', { symbol: 'btc' }), { asset: 'btc' });
  assert.deepEqual(summarizeToolInput('create_pdf_document', { title: 'x'.repeat(200) }).title.length, 80);
  assert.deepEqual(summarizeToolInput('something_new', null), { name: 'something_new' });
});

test('the kept activity record is small and complete', () => {
  assert.equal(missionActivity(createMission({ kind: 'chat' })), null);
  const done = finishMission(applyToolStart(null, { name: 'live_web_search', input: { query: 'q' } }, 1000), { now: 4500 });
  const activity = missionActivity(done);
  assert.equal(activity.durationMs, 3500);
  assert.equal(activity.status, 'done');
  assert.deepEqual(Object.keys(activity.steps[0]).sort(), ['id', 'kind', 'meta', 'params', 'state', 'tool']);
});

test('answers without live events can still show the tools that were used', () => {
  assert.equal(activityFromTools([], 10), null);
  assert.equal(activityFromTools(undefined), null);
  const activity = activityFromTools([{ name: 'get_live_weather', input: { city: 'Tokyo' } }, null, { name: 'live_web_search', input: { query: 'x' } }], 2000);
  assert.equal(activity.steps.length, 2);
  assert.equal(activity.steps[0].params.city, 'Tokyo');
  assert.ok(activity.steps.every((step) => step.state === 'done'));
});

test('research topics drop the request wrapper', () => {
  assert.equal(researchTopic('Research EU AI rules and create a PDF report'), 'EU AI rules');
  assert.equal(researchTopic('Research a topic and provide a sourced PDF report about solid-state batteries'), 'solid-state batteries');
  assert.equal(researchTopic('please investigate the lithium market'), 'the lithium market');
  assert.equal(researchTopic(''), '');
});

test('elapsed time reads m:ss and stops at the end time', () => {
  assert.equal(elapsedLabel(0, 65000), '1:05');
  assert.equal(elapsedLabel(1000, null, 25000), '0:24');
  assert.equal(elapsedLabel(5000, 1000), '0:00');
});

test('only AbortError counts as a user stop', () => {
  assert.equal(isAbortError(new DOMException('x', 'AbortError')), true);
  assert.equal(isAbortError(new Error('boom')), false);
  assert.equal(isAbortError(null), false);
});

test('a page build starts with its brief done and the page being written', () => {
  const mission = createMission({ kind: 'page', title: 'Aurora', now: 0 });
  assert.deepEqual(mission.steps.map((step) => step.id), ['brief', 'build']);
  assert.deepEqual(states(mission), ['done', 'active']);
});

test('streamed words do not close the page step; finishing does', () => {
  const mission = createMission({ kind: 'page', now: 0 });
  assert.equal(markWriting(mission), mission);
  assert.deepEqual(states(finishMission(mission, { status: 'done', now: 5 })), ['done', 'done']);
  assert.deepEqual(states(finishMission(mission, { status: 'stopped', now: 5 })), ['done', 'stopped']);
});
