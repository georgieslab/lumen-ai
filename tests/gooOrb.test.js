import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGooBlobs,
  GOO_BALL,
  GOO_FALLBACK_STOPS,
  GOO_SIZE,
  GOO_STATE_SPEED,
  GOO_TONES,
  GOO_TONE_STOPS,
  maxReach,
  targetPlaybackRate,
  toneStops
} from '../src/services/gooOrb.js';

test('builds four body lumps and five satellites with unique ids', () => {
  const blobs = buildGooBlobs();
  assert.equal(blobs.filter((b) => b.kind === 'blubb').length, 4);
  assert.equal(blobs.filter((b) => b.kind === 'sparkle').length, 5);
  assert.equal(new Set(blobs.map((b) => b.id)).size, blobs.length);
});

test('every blob starts at the centre of the body and orbits a point `orbit` away', () => {
  for (const blob of buildGooBlobs()) {
    assert.equal(blob.cx, GOO_BALL.cx);
    assert.equal(blob.cy, GOO_BALL.cy);
    const distance = Math.hypot(blob.ox - blob.cx, blob.oy - blob.cy);
    assert.ok(Math.abs(distance - blob.orbit) < 1e-9, `${blob.id} orbit radius`);
  }
});

test('no blob can leave the design canvas, so nothing is clipped', () => {
  for (const blob of buildGooBlobs()) {
    assert.ok(maxReach(blob) <= GOO_SIZE / 2, `${blob.id} reach ${maxReach(blob)}`);
    assert.ok(blob.duration > 0 && blob.delay >= 0);
  }
});

test('satellites travel further than the body blobs', () => {
  const blobs = buildGooBlobs();
  const bodyReach = Math.max(...blobs.filter((b) => b.kind === 'blubb').map(maxReach));
  const satelliteReach = Math.max(...blobs.filter((b) => b.kind === 'sparkle').map(maxReach));
  assert.ok(satelliteReach > bodyReach);
});

test('playback rate follows the state, and only voice states react to audio', () => {
  assert.equal(targetPlaybackRate('idle', 1), GOO_STATE_SPEED.idle);
  assert.equal(targetPlaybackRate('thinking', 1), GOO_STATE_SPEED.thinking);
  assert.ok(targetPlaybackRate('speaking', 0.8) > targetPlaybackRate('speaking', 0));
  assert.ok(targetPlaybackRate('listening', 5) <= GOO_STATE_SPEED.listening + 1.1);
  assert.equal(targetPlaybackRate('unknown-state', 0), 1);
  assert.equal(targetPlaybackRate('speaking', Number.NaN), GOO_STATE_SPEED.speaking);
});

test('bubble tones are built from the atmosphere colour variables', () => {
  assert.deepEqual(GOO_TONES, { a: 'var(--goo-a)', b: 'var(--goo-b)', c: 'var(--goo-c)' });
  const stops = toneStops('var(--goo-a)');
  assert.equal(stops.length, GOO_TONE_STOPS.length);
  assert.equal(stops[0], '#ffffff');
  assert.equal(stops[3], 'var(--goo-a)');
  assert.ok(stops[1].startsWith('color-mix(') && stops[4].startsWith('color-mix('));
  assert.ok(GOO_TONE_STOPS.every((offset, i) => i === 0 || offset > GOO_TONE_STOPS[i - 1]));
});

test('every tone has plain fallback colours for browsers without colour mixing', () => {
  for (const tone of Object.keys(GOO_TONES)) {
    assert.equal(GOO_FALLBACK_STOPS[tone].length, GOO_TONE_STOPS.length, tone);
    for (const colour of GOO_FALLBACK_STOPS[tone]) assert.match(colour, /^#[0-9a-f]{6}$/i);
  }
});
