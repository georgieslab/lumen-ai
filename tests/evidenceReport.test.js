import test from 'node:test';
import assert from 'node:assert/strict';
import { EVIDENCE_TOOL, observedSourceMap } from '../services/evidenceReport.js';
import { runToolLoop } from '../services/agentRunner.js';
import { getToolDefinitions } from '../services/toolRegistry.js';

const url = 'https://example.com/reference';
const input = () => ({ title: 'Evidence review', claims: [{ claim: 'The example claim', verdict: 'supported', explanation: 'The source states this.', sources: [{ url, title: 'Original source' }] }] });
const search = { toolUseId: 'search', name: 'live_web_search', input: { query: 'Example' }, status: 'success', resultItems: [{ url, title: 'Original source' }] };

test('evidence cards reject invented links and unsupported conclusive verdicts', () => {
  assert.throws(() => EVIDENCE_TOOL.execute(input()), /not observed/);
  assert.throws(() => EVIDENCE_TOOL.execute(input(), { completedTools: [{ ...search, status: 'error' }] }), /not observed/);
  assert.throws(() => EVIDENCE_TOOL.execute(input(), { completedTools: [search] }), /source page actually read/);
  const noSources = input(); noSources.claims[0].sources = [];
  assert.throws(() => EVIDENCE_TOOL.execute(noSources), /needs observed/);
  noSources.claims[0].verdict = 'unresolved';
  assert.equal(EVIDENCE_TOOL.execute(noSources).claims[0].sources.length, 0);
});

test('evidence cards retain observed source provenance and server check time', () => {
  const report = EVIDENCE_TOOL.execute(input(), { completedTools: [search, { name: 'browse_web_page', status: 'success', input: { url } }], now: () => '2026-10-18T10:00:00Z' });
  assert.equal(report.widgetType, 'evidence_report');
  assert.equal(report.claims[0].sources[0].observedBy, 'page');
  assert.equal(report.checkedAt, '2026-10-18T10:00:00Z');
  assert.match(report.reportId, /^[0-9a-f-]{36}$/);
  assert.equal(observedSourceMap([{ ...search, resultItems: [{ url: 'javascript:alert(1)' }] }]).size, 0);
});

test('a resumed evidence tool receives completed research without repeating it', async () => {
  let saved; let calls = 0;
  const messages = [{ role: 'user', content: [{ text: 'Verify this claim.' }] }];
  const toolUse = (name, toolUseId, details) => ({ toolUse: { name, toolUseId, input: details } });
  await assert.rejects(runToolLoop({ messages, tools: getToolDefinitions(),
    callModel: async () => ({ stopReason: 'tool_use', message: { role: 'assistant', content: [toolUse('browse_web_page', 'search', { url }), toolUse('create_evidence_report', 'report', input())] } }),
    executeTool: async () => { calls++; return { content: 'The original source text.', title: 'Original source' }; },
    onCheckpoint: async checkpoint => {
      if (checkpoint.phase === 'tools' && checkpoint.pending.index === 1 && !checkpoint.pending.activeTool) { saved = structuredClone(checkpoint); throw new Error('Simulated disconnect'); }
    }
  }), /Simulated disconnect/);
  assert.equal(calls, 1);
  const result = await runToolLoop({ messages, checkpoint: saved, tools: getToolDefinitions(),
    callModel: async () => ({ stopReason: 'end_turn', message: { role: 'assistant', content: [{ text: 'Reviewed.' }] } }),
    executeTool: async (tool, context) => { calls++; assert.equal(tool.name, 'create_evidence_report'); return EVIDENCE_TOOL.execute(tool.input, context); }
  });
  assert.equal(calls, 2);
  assert.equal(result.widgets[0].claims[0].sources[0].observedBy, 'page');
});
