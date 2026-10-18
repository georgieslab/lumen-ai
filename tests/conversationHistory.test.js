import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationForProject, buildConversationHistory, getAutomaticStageWidget, getConversationStorageKey, isFloatingStageWidget, mergeArtifactUpdates, restoreConversationMessages, updateMessageArtifact } from '../src/services/conversationHistory.js';

test('project conversation context excludes unrelated work and recognizes restored mission metadata', () => {
  const messages = [{ id: 'personal' }, { id: 'a', projectId: 'project-a' }, { id: 'b', serverMission: { projectId: 'project-b' } }, { id: 'request', missionRequest: { projectId: 'project-a' } }];
  assert.deepEqual(conversationForProject(messages).map(item => item.id), ['personal']);
  assert.deepEqual(conversationForProject(messages, 'project-a').map(item => item.id), ['a', 'request']);
  assert.deepEqual(conversationForProject(messages, 'project-b').map(item => item.id), ['b']);
});

const checklist = { widgetType: 'checklist', checklistId: 'packing', title: 'Packing', items: [{ id: 'passport', text: 'Pack passport', completed: false }] };

test('artifact edits survive persisted JSON and are included in the next model turn', () => {
  const initial = [{ id: 'assistant-1', role: 'assistant', text: 'Your plan is ready.', widgets: [checklist] }];
  const edited = updateMessageArtifact(initial, 'assistant-1', 0, {
    ...checklist, items: [{ ...checklist.items[0], completed: true }]
  }, 123);
  assert.equal(initial[0].widgets[0].items[0].completed, false, 'previous state remains immutable');
  const reloaded = JSON.parse(JSON.stringify(edited));
  assert.equal(reloaded[0].widgets[0].items[0].completed, true);
  const history = buildConversationHistory(reloaded);
  const summary = JSON.parse(history[0].text.split('[Current artifact state]\n')[1]);
  assert.equal(summary[0].completed, 1);
  assert.equal(summary[0].items[0].completed, true);
  assert.deepEqual(Object.keys(history[0]).sort(), ['role', 'text']);
});

test('a final stream snapshot preserves local changes using artifact identity', () => {
  const edited = { ...checklist, editedAt: 123, items: [{ ...checklist.items[0], completed: true }] };
  const unrelated = { ...checklist, checklistId: 'other' };
  assert.deepEqual(mergeArtifactUpdates([unrelated, checklist], [edited]), [unrelated, edited]);
  assert.deepEqual(mergeArtifactUpdates([checklist], [checklist]), [checklist]);
});

test('invalid artifact updates cannot change the widget kind or another message', () => {
  const messages = [{ id: 'a', widgets: [checklist] }];
  assert.deepEqual(updateMessageArtifact(messages, 'a', 0, { widgetType: 'budget' }), messages);
  assert.deepEqual(updateMessageArtifact(messages, 'a', 10, checklist), messages);
  assert.deepEqual(updateMessageArtifact(messages, 'unknown', 0, checklist), messages);
  assert.equal(updateMessageArtifact(messages, 'a', -1, checklist), messages);
});

test('artifact summaries are bounded and exclude attachments and raw widget data', () => {
  const hugeChecklist = { ...checklist, secretPayload: 'never send this', items: Array.from({ length: 30 }, (_, i) => ({ id: `item-${i}`, text: 'Long item '.repeat(50), completed: i < 10 })) };
  const history = buildConversationHistory(Array.from({ length: 12 }, (_, i) => ({
    role: 'assistant', text: `message-${i}`, image: 'data:long-image',
    widgets: [hugeChecklist, hugeChecklist, hugeChecklist, hugeChecklist, { widgetType: 'pdf_document', base64: 'private-pdf-data' }]
  })));
  assert.equal(history.length, 8);
  assert.ok(history[0].text.startsWith('message-4'));
  assert.ok(history.every(message => message.text.length < 6100));
  assert.ok(!JSON.stringify(history).includes('never send this'));
  assert.ok(!JSON.stringify(history).includes('private-pdf-data'));
  assert.ok(!JSON.stringify(history).includes('data:long-image'));
  const summary = JSON.parse(history[0].text.split('[Current artifact state]\n')[1])[0];
  assert.equal(summary.completed, 10);
  assert.equal(summary.total, 30);
  assert.ok(summary.omitted > 0);
});

test('schedule dates and completion plus budget and comparison data remain available to the model', () => {
  const history = buildConversationHistory([{ role: 'assistant', widgets: [
    { widgetType: 'schedule', title: 'Trip', date: '2026-11-05', timeZone: 'Europe/Vienna', events: [{ id: 'e', title: 'Train', date: '2026-11-05', time: '09:00', endTime: '11:00', completed: true }] },
    { widgetType: 'budget', currency: 'EUR', totalBudget: 1500, allocatedTotal: 1200, categories: [{ name: 'Travel', allocated: 200 }] },
    { widgetType: 'comparison', criteria: ['Cost'], options: [{ name: 'Train', values: { Cost: 'EUR 200' } }], recommendation: 'Train' }
  ] }]);
  const [schedule, budget, comparison] = JSON.parse(history[0].text.split('[Current artifact state]\n')[1]);
  assert.equal(schedule.events[0].completed, true);
  assert.equal(schedule.events[0].endTime, '11:00');
  assert.equal(schedule.timeZone, 'Europe/Vienna');
  assert.equal(budget.totalBudget, 1500);
  assert.equal(comparison.options[0].values.Cost, 'EUR 200');
});

test('conversation storage keys scope Clear History to the active account', () => {
  assert.equal(getConversationStorageKey(null), 'lumen_standalone_history');
  assert.equal(getConversationStorageKey({ provider: 'github', id: '42' }), 'lumen_history_github_42');
  assert.equal(getConversationStorageKey({ provider: 'google', email: 'user@example.com', id: '42' }), 'lumen_history_user@example.com');
  assert.notEqual(getConversationStorageKey({ provider: 'github', id: '42' }), getConversationStorageKey({ provider: 'github', id: '43' }));
});

test('reloading an in-progress artifact edit keeps its data and releases the stream controls', () => {
  const saved = [{ id: 'a', role: 'assistant', text: 'Partial answer', isStreaming: true, widgets: [checklist],
    mission: { kind: 'chat', status: 'running', startedAt: 10, steps: [{ id: 'tool-1', kind: 'tool', state: 'active' }] }
  }];
  const [restored] = restoreConversationMessages(JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.isStreaming, false);
  assert.equal(restored.isStopped, true);
  assert.equal(restored.activity.status, 'stopped');
  assert.equal(restored.activity.steps[0].state, 'stopped');
  assert.equal(restored.text, 'Partial answer');
  assert.deepEqual(restored.widgets, [checklist]);
  assert.equal(saved[0].isStreaming, true);
});

test('planning artifacts stay in the transcript and cannot activate an empty floating PDF stage', () => {
  const planningWidgets = ['budget', 'schedule', 'checklist', 'comparison', 'daily_brief'].map(widgetType => ({ widgetType }));
  assert.equal(getAutomaticStageWidget(planningWidgets), null);
  assert.ok(planningWidgets.every(widget => !isFloatingStageWidget(widget)));
  const weather = { widgetType: 'weather', city: 'Vienna' };
  const pdf = { widgetType: 'pdf_document', title: 'Trip plan' };
  assert.equal(getAutomaticStageWidget([...planningWidgets, weather, pdf]), weather);
  assert.equal(getAutomaticStageWidget([...planningWidgets, pdf]), pdf);
  assert.equal(getAutomaticStageWidget([{ widgetType: 'crypto' }]).widgetType, 'crypto');
  assert.equal(getAutomaticStageWidget([{ widgetType: 'jobs' }]), null, 'Jobs Radar is opened explicitly');
  assert.equal(isFloatingStageWidget({ widgetType: 'jobs' }), true, 'existing manual Jobs Radar remains supported');
  assert.equal(isFloatingStageWidget(null), false);
});
