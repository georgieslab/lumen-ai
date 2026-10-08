import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PAGE_MODEL,
  DEFAULT_REPLY_TOKENS,
  LONG_MODEL_PAGE_TOKENS,
  PAGE_REPLY_TOKENS,
  isPageRequest,
  pageModelId,
  replyTokenBudget,
  truncationTail
} from '../services/replyBudget.js';

test('requests to build a page get the larger budget', () => {
  assert.equal(replyTokenBudget('Create a stunning single-file HTML page: a living aurora'), PAGE_REPLY_TOKENS);
  assert.equal(replyTokenBudget('write me a snake game'), PAGE_REPLY_TOKENS);
  assert.equal(replyTokenBudget('Build a landing page for my bakery'), PAGE_REPLY_TOKENS);
});

test('ordinary chat keeps the short budget', () => {
  assert.equal(replyTokenBudget("What's the weather in Vienna?"), DEFAULT_REPLY_TOKENS);
  assert.equal(replyTokenBudget('Explain how HTML works'), DEFAULT_REPLY_TOKENS);
  assert.equal(replyTokenBudget('Research hydrogen and create a PDF report'), DEFAULT_REPLY_TOKENS);
});

test('a follow-up on a page Lumen just wrote keeps the larger budget', () => {
  const history = [
    { role: 'user', text: 'build an aurora page' },
    { role: 'assistant', text: 'Here you go\n```html\n<p>x</p>\n```' }
  ];
  assert.equal(replyTokenBudget('make it glow more', history), PAGE_REPLY_TOKENS);
  assert.equal(replyTokenBudget('thanks!', history), DEFAULT_REPLY_TOKENS);
  assert.equal(replyTokenBudget('make it glow more', [{ role: 'assistant', text: 'no code here' }]), DEFAULT_REPLY_TOKENS);
});

test('a larger base budget is never lowered', () => {
  assert.equal(replyTokenBudget('build a game', [], 9000), 9000);
});

test('bad input does not throw', () => {
  assert.equal(isPageRequest(undefined, null), false);
  assert.equal(isPageRequest('', [null, undefined]), false);
});

test('a page cut off mid-code gets a closing fence and a note', () => {
  const cut = 'Here is your page.\n```html\n<html><body><canvas id=c></canvas><script>let x=';
  const tail = truncationTail(cut);
  assert.match(tail, /^\n```/);
  assert.match(tail, /length limit/);
  const fences = (cut + tail).match(/```/g).length;
  assert.equal(fences % 2, 0);
});

test('a complete reply gets nothing added', () => {
  assert.equal(truncationTail('Done.\n```html\n<p>x</p>\n```\nEnjoy.'), '');
  assert.equal(truncationTail('plain text'), '');
  assert.equal(truncationTail(''), '');
});

test('non-Nova models get room for a full page', () => {
  assert.equal(replyTokenBudget('build a game', [], 1350, 'amazon.nova-lite-v1:0'), PAGE_REPLY_TOKENS);
  assert.equal(replyTokenBudget('build a game', [], 1350, 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0'), LONG_MODEL_PAGE_TOKENS);
  assert.equal(replyTokenBudget('hello', [], 1350, 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0'), 1350);
});

test('the page model can be configured or turned off', () => {
  assert.equal(pageModelId({}), DEFAULT_PAGE_MODEL);
  assert.equal(pageModelId({ LUMEN_PAGE_MODEL_ID: ' eu.amazon.nova-pro-v1:0 ' }), 'eu.amazon.nova-pro-v1:0');
  assert.equal(pageModelId({ LUMEN_PAGE_MODEL_ID: 'none' }), null);
  assert.equal(pageModelId({ LUMEN_PAGE_MODEL_ID: '' }), DEFAULT_PAGE_MODEL);
});
