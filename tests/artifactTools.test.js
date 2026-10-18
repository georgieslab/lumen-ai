import test from 'node:test';
import assert from 'node:assert/strict';
import { ARTIFACT_TOOL_REGISTRY, executeArtifactTool } from '../services/artifactTools.js';

const fixtures = {
  create_checklist: { title: 'Conference preparations', items: [{ text: 'Book a room', priority: 'high', completed: false }] },
  create_comparison: { title: 'Hotel choices', criteria: ['Cost', 'Walk'], options: [{ name: 'Hotel A', values: { Cost: '€400', Walk: '10 minutes' } }, { name: 'Hotel B', values: { Cost: '€350', Walk: '20 minutes' } }] },
  create_schedule: { title: 'Conference day', date: '2026-10-20', timeZone: 'Europe/Vienna', events: [{ title: 'Registration', time: '09:00', endTime: '10:00' }] },
  create_budget: { title: 'Conference costs', currency: '€', totalBudget: 1500, categories: [{ name: 'Lodging', allocated: 400.1 }, { name: 'Transport', allocated: 250.2 }] },
  create_daily_brief: { title: 'Research brief', stories: [{ headline: 'Published research', summary: 'The authors explain their experiment.', url: 'https://example.com/research' }] },
  compute: { expression: '400.10 + 250.20' }
};

test('the registry exposes executable local tools with direct JSON input schemas', () => {
  assert.deepEqual(ARTIFACT_TOOL_REGISTRY.map((tool) => tool.name), Object.keys(fixtures));
  for (const entry of ARTIFACT_TOOL_REGISTRY) {
    assert.equal(entry.effect, 'local');
    assert.equal(entry.web, false);
    assert.equal(entry.inputSchema.type, 'object');
    assert.equal(typeof entry.execute, 'function');
    const result = executeArtifactTool(entry.name, fixtures[entry.name]);
    assert.ok(entry.name === 'compute' ? result.success : result.widgetType);
  }
  assert.equal(executeArtifactTool('create_budget', fixtures.create_budget).allocatedTotal, 650.3);
  assert.equal(executeArtifactTool('compute', fixtures.compute).result, 650.3);
});

test('missing, empty, malformed, and unknown tool inputs fail without sample artifacts', () => {
  for (const entry of ARTIFACT_TOOL_REGISTRY) {
    for (const input of [undefined, null, [], 'text', {}, { title: '  ' }]) assert.throws(() => entry.execute(input));
  }
  assert.throws(() => executeArtifactTool('unknown', {}), /Unknown artifact tool/);
  assert.throws(() => executeArtifactTool('create_checklist', { title: 'Plan', items: [] }), /items/);
  assert.throws(() => executeArtifactTool('create_checklist', { title: 'Plan', items: [{ text: '\n\u0000' }] }), /must not be empty/);
  assert.throws(() => executeArtifactTool('create_checklist', { title: 'Plan', items: ['One'], execute: 'unknown action' }), /not supported/);
  assert.throws(() => executeArtifactTool('create_schedule', { title: 'Plan', events: [{ title: 'Missing time' }] }), /requires time or start/);
  assert.throws(() => executeArtifactTool('create_comparison', { title: 'Compare', criteria: ['Cost'], options: [{ name: 'A', values: {} }, { name: 'B', values: {} }] }), /named criterion/);
  assert.throws(() => executeArtifactTool('create_comparison', { ...fixtures.create_comparison, criteria: ['Cost', 'cost'] }), /unique/);
  const comparison = executeArtifactTool('create_comparison', { title: 'Compare', criteria: [' Cost '], options: [{ name: 'A', values: { Cost: 10 } }, { name: 'B', values: { ' Cost ': 20 } }] });
  assert.equal(comparison.options[0].values.Cost, '10');
  assert.equal(comparison.options[1].values.Cost, '20');
});

test('advertised array and field limits are enforced before builders can truncate data', () => {
  for (const [name, key] of [['create_checklist', 'items'], ['create_comparison', 'options'], ['create_schedule', 'events'], ['create_budget', 'categories'], ['create_daily_brief', 'stories']]) {
    const entry = ARTIFACT_TOOL_REGISTRY.find((tool) => tool.name === name);
    const maximum = entry.inputSchema.properties[key].maxItems;
    const input = { ...fixtures[name], [key]: Array.from({ length: maximum + 1 }, () => fixtures[name][key][0]) };
    assert.throws(() => executeArtifactTool(name, input), /must contain/);
  }
  assert.throws(() => executeArtifactTool('create_budget', { ...fixtures.create_budget, title: 'A'.repeat(121) }), /unsupported length/);
});

test('budgets reject invalid amounts instead of silently dropping or inventing allocations', () => {
  for (const allocated of [Infinity, NaN, -1, '250', null, 1e20]) {
    assert.throws(() => executeArtifactTool('create_budget', { title: 'Budget', currency: '€', totalBudget: 1000, categories: [{ name: 'Lodging', allocated }] }));
  }
  const widget = executeArtifactTool('create_budget', { title: 'Budget', currency: '€', totalBudget: 0, categories: [{ name: 'Free entry', allocated: 0 }] });
  assert.equal(widget.totalBudget, 0);
  assert.equal(widget.allocatedTotal, 0);
});

test('budget tools require and preserve the exact cap while rejecting overspend before artifact creation', () => {
  const input = { title: 'Trip budget', currency: '$', totalBudget: 3000, categories: [{ name: 'Lodging', allocated: 2000 }, { name: 'Transport', allocated: 990 }] };
  const { totalBudget, ...withoutCap } = input;
  assert.throws(() => executeArtifactTool('create_budget', withoutCap), /totalBudget is required/);
  for (const invalid of ['3000', null, NaN, Infinity, -1]) assert.throws(() => executeArtifactTool('create_budget', { ...input, totalBudget: invalid }));
  assert.throws(() => executeArtifactTool('create_budget', { ...input, categories: [{ name: 'Lodging', allocated: 3000 }, { name: 'Transport', allocated: 800 }] }), /exceed.*3000\.00 by \$800\.00.*keep totalBudget unchanged/);
  const widget = executeArtifactTool('create_budget', input);
  assert.equal(widget.totalBudget, 3000);
  assert.equal(widget.allocatedTotal, 2990);
  assert.equal(widget.remainingBudget, 10);
  assert.equal(widget.hasExplicitBudget, true);
  assert.equal(input.totalBudget, 3000);
  const decimal = executeArtifactTool('create_budget', { title: 'Small budget', currency: '€', totalBudget: 0.3, categories: [{ name: 'A', allocated: 0.1 }, { name: 'B', allocated: 0.2 }] });
  assert.equal(decimal.remainingBudget, 0);
});

test('briefing tools require every story to carry a valid source URL', () => {
  for (const url of ['', 'example.com', 'javascript:alert(1)', 'https://', 'https://user:password@example.com']) {
    assert.throws(() => executeArtifactTool('create_daily_brief', { title: 'Brief', stories: [{ headline: 'News', summary: 'Some reporting.', url }] }));
  }
  const widget = executeArtifactTool('create_daily_brief', fixtures.create_daily_brief);
  assert.equal(widget.stories.length, 1);
  assert.equal(widget.stories[0].publisher, 'example.com');
  assert.equal(widget.stories[0].publishedAt, undefined);
});

test('schedule tools reject impossible dates, clocks, time zones, and reversed timestamps', () => {
  for (const patch of [{ date: '2026-02-30' }, { timeZone: 'Not/AZone' }, { events: [{ title: 'Meeting', time: '25:00' }] }, { events: [{ title: 'Meeting', start: '2026-10-20T09:00' }] }, { events: [{ title: 'Meeting', start: '2026-10-20T10:00Z', end: '2026-10-20T09:00Z' }] }]) {
    assert.throws(() => executeArtifactTool('create_schedule', { ...fixtures.create_schedule, ...patch }));
  }
  const routine = executeArtifactTool('create_schedule', { title: 'Routine', events: [{ title: 'Read', time: '9:00 AM' }] });
  assert.equal(routine.events[0].title, 'Read');
});

test('compute propagates calculation failures and rejects malformed numeric inputs', () => {
  assert.throws(() => executeArtifactTool('compute', { expression: '1 / 0' }), /Division by zero/);
  assert.throws(() => executeArtifactTool('compute', { operation: 'stats', numbers: [1, '2'] }), /must be number/);
  assert.throws(() => executeArtifactTool('compute', { operation: 'loan', loan: { principal: 100, annualRatePercent: NaN, termYears: 1 } }), /must be number/);
  assert.throws(() => executeArtifactTool('compute', { operation: 'stats' }), /Unsupported computation/);
});
