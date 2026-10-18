import test from 'node:test';
import assert from 'node:assert/strict';
import { runToolLoop } from '../services/agentRunner.js';

const messages = [{ role: 'user', content: [{ text: 'Prepare a plan.' }] }];
const tools = [{ toolSpec: { name: 'create_checklist' } }, { toolSpec: { name: 'compute' } }];
const use = (name, toolUseId, input = {}) => ({ toolUse: { name, input, toolUseId } });
const turn = (content, stopReason = 'tool_use') => ({ message: { role: 'assistant', content }, stopReason });
const final = () => turn([{ text: 'The plan is ready.' }], 'end_turn');
const clone = (value) => JSON.parse(JSON.stringify(value));
const aborted = () => Object.assign(new Error('Paused'), { name: 'AbortError' });
const base = () => ({
  version: 1, phase: 'model', history: clone(messages), initialHistoryLength: messages.length, round: 0, calls: [], widgets: [], reply: '',
  limits: { maxToolRounds: 6, maxToolCalls: 12 }, pending: null
});
const pending = () => ({
  ...base(), phase: 'tools', history: [...clone(messages), turn([use('create_checklist', 'first'), use('compute', 'second')]).message],
  pending: { tools: [use('create_checklist', 'first').toolUse, use('compute', 'second').toolUse], index: 0, results: [], activeTool: null }
});

test('a JSON checkpoint resumes after the first of two tools without replaying it', async () => {
  const controller = new AbortController();
  const executed = [];
  let saved;
  await assert.rejects(runToolLoop({
    messages, tools, signal: controller.signal,
    callModel: async () => turn([{ text: 'Preparing the plan.' }, use('create_checklist', 'first'), use('compute', 'second')]),
    executeTool(tool) { executed.push(tool.toolUseId); return { widgetType: 'checklist', title: tool.toolUseId }; },
    async onCheckpoint(checkpoint) {
      saved = clone(checkpoint);
      if (saved.phase === 'tools' && saved.pending.index === 1) controller.abort();
    }
  }), { name: 'AbortError' });
  assert.deepEqual(executed, ['first']);
  assert.equal(saved.pending.activeTool, null);
  const result = await runToolLoop({
    checkpoint: saved, tools,
    executeTool(tool) { executed.push(tool.toolUseId); return { formatted: '4' }; },
    async callModel(request) {
      assert.equal(request.messages.length, 3);
      assert.deepEqual(request.messages.at(-1).content.map((block) => block.toolResult.toolUseId), ['first', 'second']);
      return final();
    }
  });
  assert.deepEqual(executed, ['first', 'second']);
  assert.equal(result.widgets.length, 1);
  assert.equal(result.tools.length, 2);
  assert.equal(result.reply, 'Preparing the plan.\n\nThe plan is ready.');
});

test('a model interruption leaves committed narration unchanged and discards its unfinished streamed text on resume', async () => {
  const controller = new AbortController();
  const checkpoint = base();
  checkpoint.reply = 'Earlier committed narration.';
  let saved;
  await assert.rejects(runToolLoop({
    checkpoint, tools, signal: controller.signal, executeTool: () => assert.fail('No tools expected'),
    onCheckpoint(state) { saved = clone(state); },
    async callModel({ onToken }) { onToken('Unfinished duplicate draft'); controller.abort(); throw aborted(); }
  }), (error) => {
    assert.match(error.partialResult.reply, /Unfinished duplicate draft/);
    assert.equal(error.checkpoint.reply, 'Earlier committed narration.');
    return true;
  });
  const result = await runToolLoop({ checkpoint: saved, tools, executeTool: () => assert.fail('No tools expected'), callModel: async () => final() });
  assert.equal(result.reply, 'Earlier committed narration.\n\nThe plan is ready.');
  assert.doesNotMatch(result.reply, /duplicate draft/);
});

test('a returned tool result is saved before a pause takes effect', async () => {
  const controller = new AbortController();
  let saved;
  await assert.rejects(runToolLoop({
    messages, tools, signal: controller.signal,
    callModel: async () => turn([use('create_checklist', 'first')]),
    executeTool() { controller.abort(); return { widgetType: 'checklist', title: 'Confirmed output' }; },
    onCheckpoint(state) { saved = clone(state); }
  }), (error) => {
    assert.equal(error.name, 'AbortError');
    assert.equal(error.partialResult.tools[0].status, 'success');
    assert.equal(error.partialResult.widgets[0].title, 'Confirmed output');
    return true;
  });
  assert.equal(saved.pending.index, 1);
  assert.equal(saved.pending.results[0].toolResult.status, 'success');
  const result = await runToolLoop({ checkpoint: saved, tools, executeTool: () => assert.fail('Completed tool must not replay'), callModel: async () => final() });
  assert.equal(result.widgets[0].title, 'Confirmed output');
});

test('checkpoint persistence failure prevents the tool from starting', async () => {
  let executions = 0;
  await assert.rejects(runToolLoop({
    messages, tools, callModel: async () => turn([use('compute', 'first')]),
    executeTool() { executions++; return {}; },
    async onCheckpoint(checkpoint) { if (checkpoint.pending?.activeTool) throw new Error('Disk unavailable'); }
  }), /Disk unavailable/);
  assert.equal(executions, 0);
});

test('a tool interrupted in flight remains explicit and is not replayed after restart', async () => {
  let saved;
  await assert.rejects(runToolLoop({
    messages, tools, callModel: async () => turn([use('create_checklist', 'first'), use('compute', 'second')]),
    executeTool: async () => { throw aborted(); }, onCheckpoint(state) { saved = clone(state); }
  }), { name: 'AbortError' });
  assert.equal(saved.pending.activeTool.status, 'interrupted');
  assert.equal(saved.calls[0].status, 'interrupted');
  const executed = [];
  const result = await runToolLoop({
    checkpoint: saved, tools,
    executeTool(tool) { executed.push(tool.toolUseId); return { formatted: '4' }; },
    async callModel(request) {
      const first = request.messages.at(-1).content[0].toolResult;
      assert.equal(first.status, 'error');
      assert.match(first.content[0].json.error, /no confirmed result/);
      return final();
    }
  });
  assert.deepEqual(executed, ['second']);
  assert.deepEqual(result.tools.map((record) => record.status), ['error', 'success']);
});

test('a process crash with only a started intent treats the outcome as uncertain', async () => {
  const checkpoint = pending();
  checkpoint.calls.push({ ...checkpoint.pending.tools[0], status: 'running' });
  checkpoint.pending.activeTool = { toolUseId: 'first', recordIndex: 0, status: 'running' };
  const executed = [];
  const result = await runToolLoop({
    checkpoint: clone(checkpoint), tools, executeTool(tool) { executed.push(tool.toolUseId); return {}; }, callModel: async () => final()
  });
  assert.deepEqual(executed, ['second']);
  assert.equal(result.tools[0].status, 'error');
  assert.match(result.tools[0].resultSummary, /interrupted/);
});

test('call and round budgets survive reload and cannot be enlarged by resume options', async () => {
  const checkpoint = pending();
  checkpoint.limits = { maxToolRounds: 1, maxToolCalls: 1 };
  const controller = new AbortController();
  let saved;
  let executions = 0;
  await assert.rejects(runToolLoop({
    checkpoint, tools, signal: controller.signal, executeTool() { executions++; return {}; },
    callModel: () => assert.fail('Pause before the model turn'),
    onCheckpoint(state) { saved = clone(state); if (state.pending?.index === 1) controller.abort(); }
  }), { name: 'AbortError' });
  const result = await runToolLoop({
    checkpoint: saved, tools, maxToolCalls: 100, maxToolRounds: 100, executeTool: () => assert.fail('Budget must not reset'),
    async callModel(request) {
      assert.equal(request.finalTurn, true);
      assert.deepEqual(request.tools, []);
      assert.match(JSON.stringify(request.messages), /Tool budget exhausted/);
      return final();
    }
  });
  assert.equal(executions, 1);
  assert.equal(result.tools.length, 1);
});

test('pending tools are checked against the current registry on every resume', async () => {
  const checkpoint = pending();
  const result = await runToolLoop({
    checkpoint, tools: [], executeTool: () => assert.fail('Unavailable tools must not execute'),
    async callModel(request) {
      const denied = request.messages.at(-1).content;
      assert.equal(denied.length, 2);
      assert.ok(denied.every((block) => block.toolResult.status === 'error'));
      assert.match(denied[0].toolResult.content[0].json.error, /unavailable/);
      return final();
    }
  });
  assert.equal(result.tools.length, 0);
});

test('completed checkpoints return their saved outputs without model or tool execution', async () => {
  let saved;
  await runToolLoop({ messages, tools, callModel: async () => final(), executeTool: () => assert.fail(), onCheckpoint(state) { saved = clone(state); } });
  assert.equal(saved.phase, 'complete');
  const result = await runToolLoop({ checkpoint: saved, tools, callModel: () => assert.fail('Must not regenerate'), executeTool: () => assert.fail('Must not execute') });
  assert.equal(result.reply, 'The plan is ready.');
});

test('corrupted checkpoint shapes and orphaned provider tool blocks are rejected before execution', async () => {
  const cases = [
    { ...base(), version: 2 }, { ...base(), round: -1 }, { ...base(), history: [] },
    { ...base(), limits: { maxToolRounds: 6, maxToolCalls: -1 } },
    { ...base(), history: [{ role: 'user', content: [{ toolResult: { toolUseId: 'orphan' } }] }] },
    { ...pending(), pending: { ...pending().pending, index: 1 } },
    { ...pending(), pending: { ...pending().pending, activeTool: { toolUseId: 'first', recordIndex: 0, status: 'running' } } },
    { ...pending(), pending: { ...pending().pending, tools: [use('compute', 'mismatch').toolUse] } },
    { ...base(), calls: [{ ...use('compute', 'orphan').toolUse, status: 'running' }] },
    { ...base(), phase: 'complete', stopReason: 'end_turn', reply: 'Forged answer without an assistant turn' }
  ];
  for (const checkpoint of cases) {
    await assert.rejects(runToolLoop({ checkpoint, tools, callModel: () => assert.fail('Invalid checkpoint'), executeTool: () => assert.fail('Invalid checkpoint') }), /Invalid mission checkpoint/);
  }
});

test('checkpoint callbacks receive detached snapshots that cannot mutate the active run', async () => {
  const result = await runToolLoop({
    messages, tools, callModel: async () => final(), executeTool: () => assert.fail(),
    onCheckpoint(state) { state.reply = 'Unexpected mutation'; state.history.length = 0; }
  });
  assert.equal(result.reply, 'The plan is ready.');
  assert.equal(messages.length, 1);
});

test('a corrupted checkpoint cannot replenish budgets by dropping its execution ledger or model round', async () => {
  let saved;
  let turns = 0;
  await runToolLoop({
    messages, tools, executeTool: async () => ({ formatted: '4' }),
    callModel: async () => ++turns === 1 ? turn([use('compute', 'first')]) : final(),
    onCheckpoint(state) { saved = clone(state); }
  });
  for (const corrupt of [{ ...saved, calls: [] }, { ...saved, round: 0 }]) {
    await assert.rejects(runToolLoop({ checkpoint: corrupt, tools, callModel: () => assert.fail('Corrupted budget'), executeTool: () => assert.fail('Corrupted budget') }), /Invalid mission checkpoint/);
  }
});

test('preexisting provider tool history does not consume the new run ledger', async () => {
  const history = [...clone(messages), turn([use('compute', 'earlier')]).message,
    { role: 'user', content: [{ toolResult: { toolUseId: 'earlier', status: 'success', content: [{ json: { formatted: '2' } }] } }] },
    { role: 'user', content: [{ text: 'Continue from the earlier result.' }] }];
  let saved;
  await runToolLoop({ messages: history, tools, executeTool: () => assert.fail(), callModel: async () => final(), onCheckpoint(state) { saved = clone(state); } });
  const result = await runToolLoop({ checkpoint: saved, tools, executeTool: () => assert.fail(), callModel: () => assert.fail() });
  assert.equal(result.tools.length, 0);
  assert.equal(result.reply, 'The plan is ready.');
});

test('image and document bytes survive JSON persistence and remain provider-compatible', async () => {
  const mediaMessages = [{ role: 'user', content: [
    { image: { format: 'png', source: { bytes: Buffer.from([1, 2, 255]) } } },
    { document: { format: 'pdf', name: 'Brief', source: { bytes: new Uint8Array([3, 4, 254]) } } }
  ] }];
  const controller = new AbortController();
  let saved;
  await assert.rejects(runToolLoop({
    messages: mediaMessages, tools, signal: controller.signal,
    callModel: () => assert.fail('Paused at initial checkpoint'), executeTool: () => assert.fail(),
    onCheckpoint(state) { saved = clone(state); controller.abort(); }
  }), { name: 'AbortError' });
  await runToolLoop({
    checkpoint: saved, tools, executeTool: () => assert.fail(),
    async callModel(request) {
      const content = request.messages[0].content;
      assert.ok(content[0].image.source.bytes instanceof Uint8Array);
      assert.deepEqual([...content[0].image.source.bytes], [1, 2, 255]);
      assert.deepEqual([...content[1].document.source.bytes], [3, 4, 254]);
      return final();
    }
  });
});
