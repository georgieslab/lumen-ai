import { Buffer } from 'node:buffer';

// Keep provider-specific wire formats at the boundary of the shared tool loop.
// Unsupported inputs fail explicitly so a fallback cannot answer after silently
// losing an attachment or a tool result.
function unsupported(kind) {
  throw new Error(`OpenAI fallback does not support ${kind}. Use a document-capable provider or remove the unsupported attachment.`);
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid ${label} in provider message.`);
  return value;
}

function stringifyJson(value, label) {
  let serialized;
  try { serialized = JSON.stringify(value); }
  catch { throw new Error(`Invalid JSON ${label} in provider message.`); }
  if (serialized === undefined) throw new Error(`Invalid JSON ${label} in provider message.`);
  return serialized;
}

function convertImage(image) {
  const format = image?.format === 'jpg' ? 'jpeg' : image?.format;
  if (!['png', 'jpeg', 'gif', 'webp'].includes(format)) unsupported('this image format');
  const input = image?.source?.bytes;
  let bytes;
  if (typeof input === 'string') {
    if (!/^[a-zA-Z0-9+/]+={0,2}$/.test(input) || input.length % 4 === 1) throw new Error('Invalid base64 image in provider message.');
    bytes = Buffer.from(input, 'base64');
    if (bytes.toString('base64').replace(/=+$/, '') !== input.replace(/=+$/, '')) throw new Error('Invalid base64 image in provider message.');
  } else if (input instanceof Uint8Array) bytes = Buffer.from(input);
  else if (input instanceof ArrayBuffer) bytes = Buffer.from(input);
  else unsupported('images without inline bytes');
  if (!bytes.length) throw new Error('Empty image in provider message.');
  return { type: 'image_url', image_url: { url: `data:image/${format};base64,${bytes.toString('base64')}` } };
}

function convertToolResult(result) {
  const toolCallId = requireString(result?.toolUseId, 'tool result ID');
  if (!Array.isArray(result.content) || result.content.length === 0) throw new Error('Invalid tool result content in provider message.');
  for (const block of result.content) {
    if (!block || typeof block !== 'object') throw new Error('Invalid tool result block in provider message.');
    if ('document' in block) unsupported('document tool results');
    if (!('json' in block) && typeof block.text !== 'string') unsupported('this tool result content');
  }
  const value = result.content.length === 1 && 'json' in result.content[0] ? result.content[0].json : result.content;
  const content = stringifyJson(result.status === 'error' ? { status: 'error', result: value } : value, 'tool result');
  return { role: 'tool', tool_call_id: toolCallId, content };
}

export function toOpenAIMessages(messages) {
  if (!Array.isArray(messages)) throw new Error('Provider messages must be an array.');
  const output = [];
  for (const message of messages) {
    if (!message || !['user', 'assistant', 'system', 'developer'].includes(message.role)) throw new Error('Invalid provider message role.');
    const { role } = message;
    if (typeof message.content === 'string') {
      output.push({ role, content: message.content });
      continue;
    }
    if (!Array.isArray(message.content)) throw new Error('Invalid provider message content.');
    const parts = [];
    const toolCalls = [];
    const toolResults = [];
    for (const block of message.content) {
      if (!block || typeof block !== 'object') throw new Error('Invalid provider content block.');
      if ('document' in block) unsupported('document attachments');
      if (typeof block.text === 'string') parts.push({ type: 'text', text: block.text });
      else if (block.image) {
        if (role !== 'user') unsupported('images outside user messages');
        parts.push(convertImage(block.image));
      } else if (block.toolUse) {
        if (role !== 'assistant') throw new Error('Tool calls must belong to an assistant message.');
        const tool = block.toolUse;
        const input = tool.input ?? {};
        if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('Tool arguments must be a JSON object.');
        toolCalls.push({
          id: requireString(tool.toolUseId, 'tool call ID'), type: 'function',
          function: { name: requireString(tool.name, 'tool name'), arguments: stringifyJson(input, 'tool arguments') }
        });
      } else if (block.toolResult) {
        if (role !== 'user') throw new Error('Tool results must belong to a user message.');
        toolResults.push(convertToolResult(block.toolResult));
      } else unsupported(`content block ${Object.keys(block).join(', ') || '(empty)'}`);
    }
    // The API requires tool results before the next ordinary user message.
    output.push(...toolResults);
    if (parts.length || toolCalls.length) {
      const content = parts.some((part) => part.type === 'image_url') ? parts : (parts.length ? parts.map((part) => part.text).join('') : null);
      output.push({ role, content, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) });
    } else if (!toolResults.length) throw new Error('Empty provider message content.');
  }
  return output;
}

export function fromOpenAIResponse(response) {
  const choice = response?.choices?.[0];
  const message = choice?.message;
  if (!message || message.role !== 'assistant') throw new Error('OpenAI returned an invalid assistant message.');
  const stopReasons = { stop: 'end_turn', tool_calls: 'tool_use', length: 'max_tokens' };
  const stopReason = stopReasons[choice.finish_reason];
  if (!stopReason) throw new Error(`OpenAI response did not complete normally (${choice.finish_reason || 'missing completion status'}).`);
  const content = [];
  if (typeof message.content === 'string' && message.content) content.push({ text: message.content });
  else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part?.type === 'text' && typeof part.text === 'string') content.push({ text: part.text });
      else if (part?.type === 'refusal' && typeof part.refusal === 'string') content.push({ text: part.refusal });
      else unsupported('this response content');
    }
  } else if (message.content !== null && message.content !== undefined && message.content !== '') throw new Error('OpenAI returned invalid text content.');
  if (typeof message.refusal === 'string' && message.refusal && !content.length) content.push({ text: message.refusal });
  if (message.function_call) throw new Error('OpenAI returned an unsupported deprecated function call.');
  if (message.tool_calls != null && !Array.isArray(message.tool_calls)) throw new Error('OpenAI returned invalid tool calls.');
  const calls = message.tool_calls || [];
  if (stopReason === 'tool_use' && !calls.length) throw new Error('OpenAI requested tools without supplying a tool call.');
  if (calls.length && stopReason === 'end_turn') throw new Error('OpenAI returned tool calls with an inconsistent completion status.');
  const ids = new Set();
  for (const call of calls) {
    if (call?.type !== 'function') unsupported('this tool call type');
    const toolUseId = requireString(call.id, 'tool call ID');
    const name = requireString(call.function?.name, 'tool name');
    if (ids.has(toolUseId)) throw new Error('OpenAI returned duplicate tool call IDs.');
    ids.add(toolUseId);
    let input;
    try {
      if (typeof call.function.arguments !== 'string') throw new Error();
      input = JSON.parse(call.function.arguments);
    } catch { throw new Error(`Invalid JSON arguments from OpenAI tool ${name}.`); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`Arguments from OpenAI tool ${name} must be a JSON object.`);
    content.push({ toolUse: { toolUseId, name, input } });
  }
  return { message: { role: 'assistant', content }, stopReason };
}
