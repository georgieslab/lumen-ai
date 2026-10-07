import test from 'node:test';
import assert from 'node:assert/strict';
import { extractOpenLinkRequest } from '../src/services/openLink.js';

test('detects open requests and normalizes URLs', () => {
  assert.equal(extractOpenLinkRequest('open https://reflection-writer.web.app/'), 'https://reflection-writer.web.app/');
  assert.equal(extractOpenLinkRequest('please visit example.com.'), 'https://example.com/');
});

test('ignores messages without an open intent or link', () => {
  assert.equal(extractOpenLinkRequest('How long do I cook pancakes?'), null);
  assert.equal(extractOpenLinkRequest('open the door'), null);
});
