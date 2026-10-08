import test from 'node:test';
import assert from 'node:assert/strict';
import { splitHtmlBlocks, repairHtmlFences, hideStreamingHtml, buildSandboxedDocument, buildStandalonePage } from '../src/services/htmlPage.js';

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

test('a block opened twice is still found as one page', () => {
  const segments = splitHtmlBlocks('```html\n```html\n<!DOCTYPE html><p>hi</p>\n```\nDone.');
  const pages = segments.filter((segment) => segment.type === 'html');
  assert.equal(pages.length, 1);
  assert.equal(pages[0].content, '<!DOCTYPE html><p>hi</p>');
});

test('a block that was never closed still becomes a page', () => {
  const segments = splitHtmlBlocks('Here:\n```html\n<p>cut off');
  assert.deepEqual(segments.map((segment) => segment.type), ['text', 'html']);
  assert.equal(segments[1].content, '<p>cut off');
});

test('normal blocks are left as they were', () => {
  const text = 'a\n```html\n<p>1</p>\n```\nb\n```html\n<p>2</p>\n```';
  assert.equal(repairHtmlFences(text), text);
  assert.equal(splitHtmlBlocks(text).filter((segment) => segment.type === 'html').length, 2);
  assert.equal(repairHtmlFences('no code'), 'no code');
});

test('half-written code is hidden while a reply streams', () => {
  assert.deepEqual(hideStreamingHtml('Here you go.\n```html\n<!DOCTYPE html><p>half'), { text: 'Here you go.', writing: true, codeChars: '<!DOCTYPE html><p>half'.length });
  assert.deepEqual(hideStreamingHtml('plain words'), { text: 'plain words', writing: false, codeChars: 0 });
  const done = hideStreamingHtml('A\n```html\n<p>x</p>\n```\nB');
  assert.equal(done.writing, false);
  assert.equal(done.codeChars, '<p>x</p>\n'.length);
});
