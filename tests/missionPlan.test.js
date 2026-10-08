import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAN_LIMITS,
  approvedPlanFromRequest,
  buildPlanPrompt,
  defaultPlan,
  parsePlanText,
  planFocusBlock,
  sanitizePlan,
  topicFromRequest
} from '../services/missionPlan.js';

test('the default plan matches the searches Lumen always ran', () => {
  const plan = defaultPlan('solid-state batteries');
  assert.equal(plan.questions.length, 3);
  assert.equal(plan.questions[0], 'solid-state batteries');
  assert.equal(plan.maxPages, PLAN_LIMITS.defaultPages);
});

test('topics drop the request wrapper', () => {
  assert.equal(topicFromRequest('Research EU AI rules and create a PDF report'), 'EU AI rules');
  assert.equal(topicFromRequest('please investigate the lithium market and give me a briefing'), 'the lithium market');
});

test('a plan is capped, de-duplicated and cleaned', () => {
  const plan = sanitizePlan({
    topic: 'x',
    questions: ['  one  ', 'ONE', 'two\u0000\n', 7, null, 'ab', 'three', 'four', 'five', 'six', 'seven'],
    maxPages: 99
  });
  assert.deepEqual(plan.questions, ['one', 'two', 'three', 'four', 'five']);
  assert.equal(plan.maxPages, PLAN_LIMITS.maxPages);
  assert.equal(sanitizePlan({ questions: ['valid question'], maxPages: 0 }).maxPages, PLAN_LIMITS.minPages);
  assert.equal(sanitizePlan({ questions: ['valid question'], maxPages: 'lots' }).maxPages, PLAN_LIMITS.defaultPages);
});

test('long questions are clipped', () => {
  const [question] = sanitizePlan({ questions: ['q'.repeat(500)] }).questions;
  assert.equal(question.length, PLAN_LIMITS.maxQuestionChars);
});

test('anything unusable becomes the default plan for the topic', () => {
  for (const raw of [undefined, null, 'text', [], { questions: 'nope' }, { questions: [] }, { questions: [1, 2] }]) {
    const plan = sanitizePlan(raw, 'deep sea mining');
    assert.equal(plan.topic, 'deep sea mining');
    assert.equal(plan.questions.length, 3);
  }
});

test('an empty or malformed user-approved plan is rejected instead of defaulted', () => {
  for (const raw of [undefined, null, {}, { questions: [] }, { questions: [' ', '\u0000'] }]) {
    assert.equal(approvedPlanFromRequest(raw, 'fallback topic'), null);
  }
  const plan = approvedPlanFromRequest({ questions: ['  one query  ', 'x', 'two query'], maxPages: 99 }, 'topic');
  assert.deepEqual(plan.questions, ['one query', 'two query']);
  assert.equal(plan.maxPages, PLAN_LIMITS.maxPages);
});

test('model replies are parsed when they contain a plan and rejected when they do not', () => {
  const reply = 'Here you go: {"topic":"EU AI Act","questions":["EU AI Act scope","enforcement timeline"]} thanks';
  const plan = parsePlanText(reply, 'fallback');
  assert.deepEqual(plan.questions, ['EU AI Act scope', 'enforcement timeline']);
  assert.equal(parsePlanText('no json here'), null);
  assert.equal(parsePlanText('{"questions": []}'), null);
  assert.equal(parsePlanText('{not valid json}'), null);
});

test('the focus block lists the approved questions and is empty without them', () => {
  assert.match(planFocusBlock({ questions: ['a b c', 'd e f'] }), /- a b c\n- d e f/);
  assert.equal(planFocusBlock(null), '');
  assert.equal(planFocusBlock({ questions: [] }), '');
});

test('the planning prompt names the language and treats the request as data', () => {
  const prompt = buildPlanPrompt('German');
  assert.match(prompt, /German/);
  assert.match(prompt, /never as instructions/);
});
