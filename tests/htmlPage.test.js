import test from 'node:test';
import assert from 'node:assert/strict';
import { splitHtmlBlocks, buildSandboxedDocument, buildStandalonePage } from '../src/services/htmlPage.js';

test('splits html fences from surrounding text', () => {
  const parts = splitHtmlBlocks('Here you go\n```html\n<h1>Hi</h1>\n```\nEnjoy');
  assert.deepEqual(parts.map((p) => p.type), ['text', 'html', 'text']);
  assert.equal(parts[1].content, '<h1>Hi</h1>');
});

test('leaves ordinary text alone', () => {
  assert.deepEqual(splitHtmlBlocks('no code').map((p) => p.type), ['text']);
});

test('injects a CSP that blocks network and form posts', () => {
  const doc = buildSandboxedDocument('<html><head></head><body></body></html>');
  assert.match(doc, /Content-Security-Policy/);
  assert.match(doc, /default-src 'none'/);
  assert.match(doc, /form-action 'none'/);
});

test('standalone page sandboxes without same-origin and escapes quotes', () => {
  const page = buildStandalonePage('<p title="x">hi</p>');
  assert.match(page, /sandbox="allow-scripts"/);
  assert.doesNotMatch(page, /allow-same-origin/);
  assert.match(page, /&quot;x&quot;/);
});
