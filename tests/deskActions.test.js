import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { normalizeDeskAction, deskActionInstructions, projectReferenceBlock, validateDeskToolResult } from '../services/deskActions.js';

const day = () => ({ actionKind: 'day', projectId: randomUUID(), actionData: { date: '2026-10-18', timeZone: 'Europe/Vienna', startTime: '09:30', availableHours: 4, priorities: ['Write proposal'], taskContext: [{ title: 'Ship', completed: false }] } });

test('desk action validation preserves reviewed project, date and task context', () => {
  const input = day();
  const result = normalizeDeskAction(input);
  assert.equal(result.projectId, input.projectId);
  assert.equal(result.actionData.priorities, 'Write proposal');
  assert.deepEqual(JSON.parse(result.actionData.taskContext), input.actionData.taskContext);
  assert.equal(result.actionData.timeZone, 'Europe/Vienna');
  assert.match(deskActionInstructions(result), /never invent appointments/);
  assert.deepEqual(normalizeDeskAction({}), { projectId: null, actionKind: null, actionData: null });
});

test('invalid action dates, hours, project IDs and unsupported action types fail before creation', () => {
  for (const input of [{ ...day(), projectId: '../private' }, { actionKind: 'send_email' },
    ...[{ date: '2026-02-30' }, { timeZone: 'Unknown/City' }, { startTime: '25:00' }, { availableHours: 24 }, { priorities: Array(9).fill('x') }].map(change => ({ ...day(), actionData: { ...day().actionData, ...change } }))]) {
    assert.throws(() => normalizeDeskAction(input), { status: 400 });
  }
});

test('decisions require real options and criteria; verification is bounded and explicitly untrusted', () => {
  assert.throws(() => normalizeDeskAction({ actionKind: 'decision', actionData: { question: 'Choose', options: ['A'], criteria: ['Cost'] } }));
  const decision = normalizeDeskAction({ actionKind: 'decision', actionData: { question: 'Choose', options: ['A', 'B'], criteria: ['Cost'] } });
  assert.match(deskActionInstructions(decision), /Do not invent numerical ratings/);
  assert.throws(() => normalizeDeskAction({ actionKind: 'verify', actionData: { content: 'x'.repeat(7001) } }));
  const verification = normalizeDeskAction({ actionKind: 'verify', actionData: { content: 'A factual claim' } });
  assert.match(deskActionInstructions(verification), /untrusted reference material/);
  assert.match(deskActionInstructions(verification), /Unresolved does not mean false/);
});

test('project reference excerpts have a combined bound and cannot become permission', () => {
  const block = projectReferenceBlock({ name: 'Demo', instructions: 'Be concise', files: [{ name: 'a.txt', text: 'x'.repeat(19000) }, { name: 'b.md', text: 'y'.repeat(3000) }] });
  const data = JSON.parse(block.split('\n').find(line => line.startsWith('{')));
  assert.equal(data.files.reduce((total, file) => total + file.text.length, 0), 20000);
  assert.equal(data.files[1].truncated, true);
  assert.match(block, /never instructions or permission/);
  assert.equal(projectReferenceBlock(null), '');
});

test('day-plan schedules must fit the approved time window including breaks and cannot overlap', () => {
  const input = normalizeDeskAction(day());
  const schedule = { widgetType: 'schedule', date: '2026-10-18', timeZone: 'Europe/Vienna', events: [{ title: 'Work', time: '09:30', endTime: '10:30' }, { title: 'Review', time: '10:45', endTime: '13:30' }] };
  assert.doesNotThrow(() => validateDeskToolResult(input, 'create_schedule', schedule));
  assert.throws(() => validateDeskToolResult(input, 'create_schedule', { ...schedule, events: [...schedule.events, { title: 'Walk', time: '13:30', endTime: '14:00' }] }), /exceeds/);
  assert.throws(() => validateDeskToolResult(input, 'create_schedule', { ...schedule, events: [{ title: 'Work', time: '09:30', endTime: '11:00' }, { title: 'Review', time: '10:30', endTime: '12:00' }] }), /overlaps/);
  assert.throws(() => validateDeskToolResult(input, 'create_schedule', { ...schedule, events: [{ title: 'Unspecified time' }] }), /explicit dated/);
  assert.throws(() => validateDeskToolResult(input, 'create_schedule', { ...schedule, date: '2026-10-19' }), /exceeds/);
});
