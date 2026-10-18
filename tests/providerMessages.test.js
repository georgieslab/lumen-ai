import test from 'node:test';
import assert from 'node:assert/strict';
import { toOpenAIMessages, fromOpenAIResponse } from '../services/providerMessages.js';

const response = (message, finishReason = 'stop') => ({ choices: [{ message: { role: 'assistant', ...message }, finish_reason: finishReason }] });

test('provider adapter preserves conversation text and user images', () => {
  const bytes = Buffer.from([0, 1, 2, 253, 254, 255]);
  const input = [
    { role: 'user', content: [{ text: 'Inspect this' }, { image: { format: 'png', source: { bytes } } }] },
    { role: 'assistant', content: [{ text: 'First. ' }, { text: 'Second.' }] }
  ];
  const converted = toOpenAIMessages(input);
  assert.deepEqual(converted, [
    { role: 'user', content: [{ type: 'text', text: 'Inspect this' }, { type: 'image_url', image_url: { url: `data:image/png;base64,${bytes.toString('base64')}` } }] },
    { role: 'assistant', content: 'First. Second.' }
  ]);
  assert.equal(input[0].content[1].image.source.bytes, bytes, 'adapter must not mutate the input');
});

test('provider adapter handles typed image bytes and base64 image bytes', () => {
  const image = (bytes) => [{ role: 'user', content: [{ image: { format: 'jpeg', source: { bytes } } }] }];
  assert.equal(toOpenAIMessages(image(new Uint8Array([1, 2, 3])))[0].content[0].image_url.url, 'data:image/jpeg;base64,AQID');
  assert.equal(toOpenAIMessages(image('AQID'))[0].content[0].image_url.url, 'data:image/jpeg;base64,AQID');
  assert.throws(() => toOpenAIMessages(image('not base64!')), /Invalid base64/);
  assert.throws(() => toOpenAIMessages(image(new Uint8Array())), /Empty image/);
});

test('documents and unsupported attachment sources fail rather than disappear from fallback context', () => {
  assert.throws(() => toOpenAIMessages([{ role: 'user', content: [{ text: 'Read attached' }, { document: { format: 'pdf', source: { bytes: Buffer.from('pdf') } } }] }]), /does not support document attachments/);
  assert.throws(() => toOpenAIMessages([{ role: 'user', content: [{ image: { format: 'png', source: { s3Location: { uri: 's3://bucket/key' } } } }] }]), /images without inline bytes/);
  assert.throws(() => toOpenAIMessages([{ role: 'user', content: [{ video: {} }] }]), /does not support content block/);
});

test('multiple Bedrock tool calls and results become the correct OpenAI roles and JSON content', () => {
  const input = [
    { role: 'assistant', content: [{ text: 'Preparing the plan.' }, { toolUse: { toolUseId: 'one', name: 'create_budget', input: { currency: 'EUR' } } }, { toolUse: { toolUseId: 'two', name: 'create_schedule', input: {} } }] },
    { role: 'user', content: [{ toolResult: { toolUseId: 'one', content: [{ json: { widgetType: 'budget', total: 1200 } }] } }, { toolResult: { toolUseId: 'two', content: [{ json: { widgetType: 'schedule' } }] } }] }
  ];
  assert.deepEqual(toOpenAIMessages(input), [
    { role: 'assistant', content: 'Preparing the plan.', tool_calls: [{ id: 'one', type: 'function', function: { name: 'create_budget', arguments: '{"currency":"EUR"}' } }, { id: 'two', type: 'function', function: { name: 'create_schedule', arguments: '{}' } }] },
    { role: 'tool', tool_call_id: 'one', content: '{"widgetType":"budget","total":1200}' },
    { role: 'tool', tool_call_id: 'two', content: '{"widgetType":"schedule"}' }
  ]);
});

test('tool-only assistant turns and failed tool results retain call IDs and failure status', () => {
  const converted = toOpenAIMessages([
    { role: 'assistant', content: [{ toolUse: { toolUseId: 'one', name: 'compute', input: { expression: '1+1' } } }] },
    { role: 'user', content: [{ text: 'Try again.' }, { toolResult: { toolUseId: 'one', status: 'error', content: [{ json: { error: 'Invalid expression' } }] } }] }
  ]);
  assert.equal(converted[0].content, null);
  assert.equal(converted[1].role, 'tool');
  assert.deepEqual(JSON.parse(converted[1].content), { status: 'error', result: { error: 'Invalid expression' } });
  assert.equal(converted[2].content, 'Try again.');
});

test('provider adapter refuses malformed calls, wrong roles, and unsupported tool result blocks', () => {
  assert.throws(() => toOpenAIMessages([{ role: 'user', content: [{ toolUse: { toolUseId: 'one', name: 'compute', input: {} } }] }]), /assistant message/);
  assert.throws(() => toOpenAIMessages([{ role: 'assistant', content: [{ toolUse: { name: 'compute', input: {} } }] }]), /tool call ID/);
  assert.throws(() => toOpenAIMessages([{ role: 'user', content: [{ toolResult: { toolUseId: 'one', content: [{ document: {} }] } }] }]), /document tool results/);
  assert.throws(() => toOpenAIMessages([{ role: 'user', content: [{ toolResult: { toolUseId: 'one', content: [] } }] }]), /Invalid tool result content/);
});

test('OpenAI plain and refused answers normalize to Bedrock text and stop reasons', () => {
  assert.deepEqual(fromOpenAIResponse(response({ content: 'Here is the plan.' })), { message: { role: 'assistant', content: [{ text: 'Here is the plan.' }] }, stopReason: 'end_turn' });
  assert.deepEqual(fromOpenAIResponse(response({ content: null, refusal: 'Unable to help.' })), { message: { role: 'assistant', content: [{ text: 'Unable to help.' }] }, stopReason: 'end_turn' });
  assert.equal(fromOpenAIResponse(response({ content: 'Partial answer' }, 'length')).stopReason, 'max_tokens');
});

test('OpenAI tool responses round-trip into executable Bedrock tool calls', () => {
  const source = response({ content: 'Creating a checklist.', tool_calls: [
    { id: 'call_checklist', type: 'function', function: { name: 'create_checklist', arguments: '{"title":"Trip","items":[{"text":"Pack"}]}' } },
    { id: 'call_compute', type: 'function', function: { name: 'compute', arguments: '{"expression":"1500-1200"}' } }
  ] }, 'tool_calls');
  const normalized = fromOpenAIResponse(source);
  assert.equal(normalized.stopReason, 'tool_use');
  assert.deepEqual(normalized.message.content[1], { toolUse: { toolUseId: 'call_checklist', name: 'create_checklist', input: { title: 'Trip', items: [{ text: 'Pack' }] } } });
  assert.deepEqual(toOpenAIMessages([normalized.message])[0], { role: 'assistant', content: source.choices[0].message.content, tool_calls: source.choices[0].message.tool_calls });
});

test('malformed, empty, and non-object OpenAI tool arguments throw before execution', () => {
  for (const args of ['{bad', '', 'null', '[]', '42', undefined]) {
    assert.throws(() => fromOpenAIResponse(response({ content: null, tool_calls: [{ id: 'one', type: 'function', function: { name: 'compute', arguments: args } }] }, 'tool_calls')), /JSON/);
  }
});

test('incomplete, filtered, and inconsistent OpenAI responses throw rather than signal success', () => {
  assert.throws(() => fromOpenAIResponse({ choices: [] }), /invalid assistant message/);
  assert.throws(() => fromOpenAIResponse(response({ content: null }, 'content_filter')), /did not complete normally/);
  assert.throws(() => fromOpenAIResponse(response({ content: null }, 'tool_calls')), /without supplying/);
  const tool_calls = [{ id: 'one', type: 'function', function: { name: 'compute', arguments: '{}' } }];
  assert.throws(() => fromOpenAIResponse(response({ content: null, tool_calls })), /inconsistent completion/);
  assert.throws(() => fromOpenAIResponse(response({ content: null, tool_calls: [...tool_calls, ...tool_calls] }, 'tool_calls')), /duplicate tool call IDs/);
});
