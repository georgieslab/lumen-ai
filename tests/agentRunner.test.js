import test from 'node:test';
import assert from 'node:assert/strict';
import { runToolLoop, readConverseStream, createThinkingFilter } from '../services/agentRunner.js';
import { executeArtifactTool } from '../services/artifactTools.js';
import { getToolDefinitions, TOOL_REGISTRY, modelSupportsTools } from '../services/toolRegistry.js';

const messages = [{ role: 'user', content: [{ text: 'Plan my trip.' }] }];
const tools = getToolDefinitions();
const use = (name, input, toolUseId) => ({ toolUse: { name, input, toolUseId } });
const turn = (content, stopReason = 'tool_use') => ({ message: { role: 'assistant', content }, stopReason });
const checklist = { title: 'Trip preparation', items: ['Book lodging'] };
const budget = { title: 'Trip budget', currency: '€', totalBudget: 100, categories: [{ name: 'Lodging', allocated: 100 }] };
const execute = ({ name, input }) => executeArtifactTool(name, input);

test('a multi-tool planning run returns real artifacts and a final synthesis', async () => {
  let modelCalls = 0;
  const events = [];
  const result = await runToolLoop({ messages, tools, executeTool: execute, onEvent: (event) => events.push(event),
    async callModel(request) {
      modelCalls++;
      if (modelCalls === 1) return turn([{ text: 'Preparing your plan.' }, use('create_checklist', checklist, 'tasks'), use('create_budget', budget, 'costs')]);
      assert.equal(request.messages.length, 3);
      const results = request.messages[2].content;
      assert.deepEqual(results.map((block) => block.toolResult.toolUseId), ['tasks', 'costs']);
      assert.deepEqual(results.map((block) => block.toolResult.status), ['success', 'success']);
      assert.equal(results[1].toolResult.content[0].json.allocatedTotal, 100);
      return turn([{ text: 'Your trip plan includes a €100 lodging budget and a booking checklist.' }], 'end_turn');
    }
  });
  assert.equal(modelCalls, 2);
  assert.equal(messages.length, 1);
  assert.deepEqual(result.widgets.map((widget) => widget.widgetType), ['checklist', 'budget']);
  assert.deepEqual(result.tools.map((tool) => tool.status), ['success', 'success']);
  assert.match(result.reply, /€100 lodging budget/);
  assert.equal(events.filter((event) => event.type === 'tool_start').length, 2);
  assert.equal(events.filter((event) => event.type === 'widget').length, 2);
});

test('the call budget forces synthesis with textified tool history and stops excess executions', async () => {
  let modelCalls = 0;
  let executions = 0;
  const result = await runToolLoop({ messages, tools, maxToolCalls: 1, executeTool(tool) { executions++; return execute(tool); },
    async callModel(request) {
      modelCalls++;
      if (modelCalls === 1) return turn([use('create_checklist', checklist, 'tasks'), use('create_budget', budget, 'costs')]);
      assert.equal(request.finalTurn, true);
      assert.deepEqual(request.tools, []);
      assert.ok(request.messages.every((message) => message.content.every((block) => !block.toolUse && !block.toolResult)));
      assert.match(JSON.stringify(request.messages), /Tool budget exhausted/);
      assert.match(JSON.stringify(request.messages), /Trip preparation/);
      return turn([{ text: 'The checklist is ready; the budget was not created.' }], 'end_turn');
    }
  });
  assert.equal(executions, 1);
  assert.equal(result.tools.length, 1);
  assert.equal(result.widgets.length, 1);
});

test('the round budget retains completed outputs when the final model still requests tools', async () => {
  let modelCalls = 0;
  await assert.rejects(runToolLoop({ messages, tools, maxToolRounds: 1, executeTool: execute,
    async callModel(request) {
      modelCalls++;
      if (modelCalls === 1) return turn([use('create_checklist', checklist, 'tasks')]);
      assert.equal(request.finalTurn, true);
      return turn([use('create_budget', budget, 'costs')]);
    }
  }), (error) => {
    assert.match(error.message, /budget/i);
    assert.equal(error.hasProgress, true);
    assert.equal(error.partialResult.widgets[0].widgetType, 'checklist');
    return true;
  });
});

test('cancellation stops execution before subsequent tools and preserves progress metadata', async () => {
  const controller = new AbortController();
  let executions = 0;
  await assert.rejects(runToolLoop({ messages, tools, signal: controller.signal,
    callModel: async () => turn([use('create_checklist', checklist, 'tasks'), use('create_budget', budget, 'costs')]),
    executeTool(tool) { executions++; controller.abort(); return execute(tool); }
  }), (error) => {
    assert.equal(error.name, 'AbortError');
    assert.equal(error.hasProgress, true);
    assert.equal(error.partialResult.tools.length, 1);
    return true;
  });
  assert.equal(executions, 1);
});

test('schema validation errors are returned to the model for correction', async () => {
  let modelCalls = 0;
  const result = await runToolLoop({ messages, tools, executeTool: execute,
    async callModel(request) {
      modelCalls++;
      if (modelCalls === 1) return turn([use('create_budget', { ...budget, categories: [{ name: 'Lodging', allocated: '100' }] }, 'bad')]);
      if (modelCalls === 2) {
        const failed = request.messages.at(-1).content[0].toolResult;
        assert.equal(failed.status, 'error');
        assert.match(failed.content[0].json.error, /must be number/);
        return turn([use('create_budget', budget, 'corrected')]);
      }
      return turn([{ text: 'The corrected budget is ready.' }], 'end_turn');
    }
  });
  assert.deepEqual(result.tools.map((tool) => tool.status), ['error', 'success']);
  assert.equal(result.widgets.length, 1);
});

test('web mode off keeps local planning tools available and denies web tool execution', async () => {
  const offlineTools = getToolDefinitions({ webMode: 'off' });
  const offlineNames = new Set(offlineTools.map((tool) => tool.toolSpec.name));
  for (const entry of TOOL_REGISTRY) assert.equal(offlineNames.has(entry.name), !entry.web);
  let modelCalls = 0;
  let executions = 0;
  const result = await runToolLoop({ messages, tools: offlineTools, executeTool() { executions++; throw new Error('Should not execute'); },
    async callModel(request) {
      modelCalls++;
      if (modelCalls === 1) return turn([use('browse_web_page', { url: 'https://example.com' }, 'web'), use('unknown_tool', {}, 'unknown')]);
      const denied = request.messages.at(-1).content;
      assert.equal(denied.length, 2);
      assert.ok(denied.every((block) => block.toolResult.status === 'error'));
      assert.match(denied[0].toolResult.content[0].json.error, /unavailable/);
      return turn([{ text: 'Web access is disabled; I can still create local planning cards.' }], 'end_turn');
    }
  });
  assert.equal(executions, 0);
  assert.equal(result.tools.length, 0);
});

test('tool capability detection accepts configured text families and rejects unknown/non-text models', () => {
  for (const model of ['amazon.nova-lite-v1:0', 'eu.amazon.nova-pro-v1:0', 'anthropic.claude-3-5-sonnet-20241022-v2:0', 'us.anthropic.claude-sonnet-4-20250514-v1:0']) assert.equal(modelSupportsTools(model), true, model);
  for (const model of ['', 'custom-llm-v1', 'meta.llama3-70b-instruct-v1:0', 'amazon.nova-canvas-v1:0', 'amazon.nova-reel-v1:0', 'amazon.nova-sonic-v1:0', 'anthropic.claude-v2:1']) assert.equal(modelSupportsTools(model), false, model);
});

test('an incomplete model response fails with streamed text available as a partial result', async () => {
  await assert.rejects(runToolLoop({ messages, tools, executeTool: execute,
    async callModel({ onToken }) {
      onToken('Partial report');
      return { message: { role: 'assistant', content: [{ text: 'Partial report' }] } };
    }
  }), (error) => {
    assert.match(error.message, /before completion/);
    assert.equal(error.partialResult.reply, 'Partial report');
    assert.equal(error.hasProgress, true);
    return true;
  });
});

test('truncation and filtering are failures with completed artifacts retained', async () => {
  for (const stopReason of ['max_tokens', 'content_filtered', 'guardrail_intervened']) {
    let modelCalls = 0;
    await assert.rejects(runToolLoop({ messages, tools, executeTool: execute,
      async callModel() {
        modelCalls++;
        if (modelCalls === 1) return turn([use('create_checklist', checklist, 'tasks')]);
        return turn([{ text: 'Unfinished final report' }], stopReason);
      }
    }), (error) => {
      assert.equal(error.hasProgress, true);
      assert.equal(error.partialResult.widgets.length, 1);
      assert.match(error.partialResult.reply, /Unfinished/);
      return true;
    });
  }
});

test('planning narration cannot satisfy an empty terminal response', async () => {
  let modelCalls = 0;
  await assert.rejects(runToolLoop({ messages, tools, executeTool: execute,
    async callModel() {
      modelCalls++;
      if (modelCalls === 1) return turn([{ text: 'I will prepare the checklist.' }, use('create_checklist', checklist, 'tasks')]);
      return turn([], 'end_turn');
    }
  }), (error) => {
    assert.match(error.message, /final answer/);
    assert.equal(error.partialResult.widgets.length, 1);
    return true;
  });
});

async function* streamOf(events) { yield* events; }
const start = (index, name, toolUseId) => ({ contentBlockStart: { contentBlockIndex: index, start: { toolUse: { name, toolUseId } } } });
const args = (index, input) => ({ contentBlockDelta: { contentBlockIndex: index, delta: { toolUse: { input } } } });
const textDelta = (index, text) => ({ contentBlockDelta: { contentBlockIndex: index, delta: { text } } });

test('indexed stream parsing keeps interleaved tool arguments separate and ordered', async () => {
  const tokens = [];
  const result = await readConverseStream(streamOf([
    start(2, 'create_budget', 'costs'), start(0, 'compute', 'math'),
    args(2, '{"title":"Trip budget",'), args(0, '{"expression":'),
    textDelta(1, 'Ready <thi'), args(2, '"currency":"€","categories":[]}'),
    textDelta(1, 'nking>private reasoning</thin'), args(0, '"2+2"}'),
    textDelta(1, 'king>to plan.'), { messageStop: { stopReason: 'tool_use' } }
  ]), { onToken: (token) => tokens.push(token) });
  assert.equal(result.message.content[0].toolUse.input.expression, '2+2');
  assert.equal(result.message.content[2].toolUse.input.currency, '€');
  assert.equal(tokens.join(''), 'Ready to plan.');
  assert.equal(result.stopReason, 'tool_use');
});

test('stream parsing rejects incomplete completion, missing definitions, invalid JSON, and service failures', async () => {
  await assert.rejects(readConverseStream(streamOf([textDelta(0, 'Partial')])), /completion status/);
  await assert.rejects(readConverseStream(streamOf([args(0, '{}')])), /without a tool definition/);
  await assert.rejects(readConverseStream(streamOf([start(0, 'compute', 'math'), args(0, '{bad'), { messageStop: { stopReason: 'tool_use' } }])), /Invalid JSON/);
  await assert.rejects(readConverseStream(streamOf([{ throttlingException: { message: 'Try later' } }])), /Try later/);
});

test('thinking filter handles tag splits and never emits an unfinished hidden block', () => {
  const tokens = [];
  const filter = createThinkingFilter((token) => tokens.push(token));
  for (const chunk of ['Hello <th', 'inking>secret</thi', 'nking> world<thinking>unfinished secret']) filter.push(chunk);
  filter.flush();
  assert.equal(tokens.join(''), 'Hello  world');
});
