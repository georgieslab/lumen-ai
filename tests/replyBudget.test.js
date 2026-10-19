import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PAGE_MODEL,
  DEFAULT_REPLY_TOKENS,
  LONG_MODEL_PAGE_TOKENS,
  PAGE_REPLY_TOKENS,
  conversationTokenBudget,
  isPageRequest,
  pageModelId,
  replyTokenBudget,
  truncationTail
} from '../services/replyBudget.js';

test('text synthesis uses the selected reply depth and safely migrates older modes', () => {
  const budget = mode => conversationTokenBudget('Explain how children learn through play.', [], mode, 'amazon.nova-lite-v1:0');
  assert.ok(budget('concise') < budget('balanced'));
  assert.ok(budget('balanced') < budget('deep'));
  assert.equal(budget('detailed'), budget('deep'));
  assert.equal(budget('narrative'), budget('balanced'));
  assert.equal(budget('unknown'), budget('concise'));
});

test('reply depth preserves room for tool arguments and complete page output', () => {
  for (const mode of ['concise', 'balanced', 'deep', 'bullets']) {
    assert.ok(conversationTokenBudget('Create a detailed schedule and checklist.', [], mode, 'amazon.nova-lite-v1:0', true) >= 4096);
    assert.equal(conversationTokenBudget('Build a game', [], mode, 'amazon.nova-lite-v1:0'), PAGE_REPLY_TOKENS);
    assert.equal(conversationTokenBudget('Build a game', [], mode, 'gpt-4o-mini', true), LONG_MODEL_PAGE_TOKENS);
  }
});

test('an explicit request for a full explanation has room even with a concise default', () => {
  for (const prompt of ['Explain photosynthesis in detail.', 'Give a step-by-step explanation.', 'Bitte ausführlich erklären.', 'Explique en détail.', 'Spiega in dettaglio.', 'Explícalo en detalle.', '詳しく説明してください。']) {
    assert.ok(conversationTokenBudget(prompt, [], 'concise') >= conversationTokenBudget(prompt, [], 'deep'), prompt);
  }
});

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

test('interactive planning cards stay in chat instead of opening a website brief', () => {
  for (const prompt of [
    'Create an interactive budget card',
    'Create an interactive checklist',
    'Create four interactive cards: a $3000 budget, checklist, comparison, and schedule.',
    'Create four interactive cards for my trip with a schedule, budget, checklist, and hotel comparison.'
  ]) {
    assert.equal(isPageRequest(prompt), false, prompt);
    assert.equal(replyTokenBudget(prompt), DEFAULT_REPLY_TOKENS, prompt);
  }
});

test('interactive requests with an explicit page or app target still use the website flow', () => {
  for (const prompt of [
    'Create an interactive HTML budget calculator',
    'Build an interactive webpage for my trip',
    'Create an interactive website',
    'Make an interactive dashboard',
    'Build an interactive game',
    'Create an interactive demo'
  ]) assert.equal(isPageRequest(prompt), true, prompt);
});

test('artifact titles and subjects cannot turn planning tools into website requests', () => {
  const prompts = [
    'Use compute to calculate 17 times 23, then create a checklist titled Saved checkpoint demo with Read plan and Check arithmetic. Summarize the result.',
    'Create a checklist titled Game launch with Book venue and Check equipment.',
    'Create a checklist named Launch page with Review copy and Publish.',
    'Create a checklist titled "Build a game demo" with Read plan and Check arithmetic.',
    'Create a checklist "Game demo" with Review and Publish.',
    'Create four interactive cards: a budget titled Demo, checklist, comparison, and schedule.',
    'Create a budget for my game launch.',
    'Create a schedule for website launch day.',
    'Create a comparison of landing page options.',
    'Create a game launch checklist.',
    'Create a checklist to build a game.'
  ];
  for (const prompt of prompts) {
    assert.equal(isPageRequest(prompt), false, prompt);
    assert.equal(replyTokenBudget(prompt), DEFAULT_REPLY_TOKENS, prompt);
  }
});

test('an explicit page target still wins when it contains planning artifacts', () => {
  for (const prompt of [
    'Build a web page containing a checklist.',
    'Create an HTML budget calculator.',
    'Create a checklist page with editable items.',
    'Create a game launch checklist, and then build a website for it.',
    'Create a checklist titled Launch demo, and then build a web page containing it.'
  ]) assert.equal(isPageRequest(prompt), true, prompt);
});

test('a new planning card request leaves a previous website conversation', () => {
  const history = [{ role: 'assistant', text: '```html\n<h1>My website</h1>\n```' }];
  assert.equal(isPageRequest('Create a checklist titled Game launch with Review plan and Publish.', history), false);
  assert.equal(replyTokenBudget('Create a budget for the website launch.', history), DEFAULT_REPLY_TOKENS);
  assert.equal(isPageRequest('Add a checklist to the web page.', history), true);
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
