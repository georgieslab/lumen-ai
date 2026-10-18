import test from 'node:test';
import assert from 'node:assert/strict';
import { requestsPdfCreation, requiredWebLookup } from '../services/missionContext.js';
import { runToolLoop } from '../services/agentRunner.js';

const messages = [{ role: 'user', content: [{ text: 'Explain the latest developments.' }] }];
const tools = [{ toolSpec: { name: 'live_web_search' } }];
const final = { message: { role: 'assistant', content: [{ text: 'Here is the sourced answer.' }] }, stopReason: 'end_turn' };
const clone = (value) => JSON.parse(JSON.stringify(value));
const context = (overrides = {}) => ({ messages, tools, promptText: 'Latest developments', enabled: true, ...overrides });

test('asking about PDFs does not request a generated file', () => {
  for (const prompt of [
    'What is a PDF?', 'Explain PDF compression.', 'Compare PDF and Word.',
    'How does the PDF format work?', 'Can you read a PDF attachment?', 'Plan my trip.', null
  ]) assert.equal(requestsPdfCreation(prompt), false, String(prompt));
});

test('explicit document requests preserve the existing creation intent', () => {
  for (const prompt of [
    'Create a PDF of the trip plan.', 'Generate a report about the topic.',
    'Make a document from my notes.', 'Export a PDF.', 'Write a report.',
    'Download a file.', 'Build a PDF.', 'Summarize my notes as a PDF document.'
  ]) assert.equal(requestsPdfCreation(prompt), true, prompt);
});

test('Always Web emits a bounded tool request rather than performing a preliminary network call', () => {
  const lookup = requiredWebLookup(context({ promptText: `  Latest\n\0 developments   ${'x'.repeat(700)}` }));
  assert.equal(lookup.stopReason, 'tool_use');
  assert.equal(lookup.message.role, 'assistant');
  const tool = lookup.message.content[0].toolUse;
  assert.equal(tool.toolUseId, 'mission-web-grounding');
  assert.equal(tool.name, 'live_web_search');
  assert.equal(tool.input.query.length, 500);
  assert.match(tool.input.query, /^Latest developments /);
  assert.doesNotMatch(tool.input.query, /[\n\0]| {2}/);
});

test('Auto, Off, unavailable search tools, and final synthesis never force a lookup', () => {
  for (const options of [
    context({ enabled: false }), // Auto and Off keep their existing model policy.
    context({ enabled: false, tools: [] }),
    context({ tools: [{ toolSpec: { name: 'compute' } }] }),
    context({ tools: [] }), // The runner removes tools on its final budget turn.
    context({ promptText: '  ' })
  ]) assert.equal(requiredWebLookup(options), null);
});

test('existing search or page-reading history satisfies the required lookup', () => {
  for (const name of ['live_web_search', 'browse_web_page']) {
    const history = [...messages, { role: 'assistant', content: [{ toolUse: { name, toolUseId: 'prior', input: {} } }] }];
    assert.equal(requiredWebLookup(context({ messages: history })), null);
  }
});

test('required grounding survives a JSON checkpoint and resumes without repeating the lookup', async () => {
  const controller = new AbortController();
  let saved;
  let lookups = 0;
  let modelCalls = 0;
  const callModel = async ({ messages: history, tools: available }) => {
    const lookup = requiredWebLookup(context({ messages: history, tools: available }));
    if (lookup) return lookup;
    modelCalls++;
    return final;
  };
  await assert.rejects(runToolLoop({
    messages, tools, signal: controller.signal, callModel,
    async executeTool(tool) { lookups++; assert.equal(tool.name, 'live_web_search'); return { results: [{ title: 'Evidence', url: 'https://example.com/evidence' }] }; },
    onCheckpoint(state) { saved = clone(state); if (state.pending?.index === 1) controller.abort(); }
  }), { name: 'AbortError' });
  assert.equal(lookups, 1);
  assert.equal(modelCalls, 0);
  assert.equal(saved.calls[0].status, 'success');
  assert.equal(saved.pending.results[0].toolResult.status, 'success');
  const result = await runToolLoop({
    checkpoint: saved, tools, callModel,
    executeTool: () => assert.fail('A completed grounding lookup must not replay')
  });
  assert.equal(lookups, 1);
  assert.equal(modelCalls, 1);
  assert.equal(result.tools.length, 1);
  assert.equal(result.reply, 'Here is the sourced answer.');
});

test('pausing the model after grounding discards its draft and resumes using the saved sources', async () => {
  const controller = new AbortController();
  let saved;
  let lookups = 0;
  await assert.rejects(runToolLoop({
    messages, tools, signal: controller.signal,
    async callModel({ messages: history, tools: available, onToken }) {
      const lookup = requiredWebLookup(context({ messages: history, tools: available }));
      if (lookup) return lookup;
      onToken('Unfinished draft');
      controller.abort();
      const error = new Error('Paused'); error.name = 'AbortError'; throw error;
    },
    executeTool() { lookups++; return { results: [] }; },
    onCheckpoint(state) { saved = clone(state); }
  }), { name: 'AbortError' });
  assert.equal(saved.phase, 'model');
  assert.equal(saved.round, 1);
  assert.equal(saved.reply, '');
  const result = await runToolLoop({
    checkpoint: saved, tools, executeTool: () => assert.fail('Grounding already completed'),
    async callModel({ messages: history, tools: available }) {
      assert.equal(requiredWebLookup(context({ messages: history, tools: available })), null);
      return final;
    }
  });
  assert.equal(lookups, 1);
  assert.equal(result.reply, 'Here is the sourced answer.');
});

test('required grounding counts against the existing global call budget', async () => {
  let calls = 0;
  const result = await runToolLoop({
    messages, tools, maxToolCalls: 1,
    async callModel({ messages: history, tools: available, finalTurn }) {
      const lookup = requiredWebLookup(context({ messages: history, tools: available }));
      if (lookup) return lookup;
      assert.equal(finalTurn, true);
      assert.deepEqual(available, []);
      return final;
    },
    executeTool() { calls++; return { results: [] }; }
  });
  assert.equal(calls, 1);
  assert.equal(result.tools.length, 1);
});
