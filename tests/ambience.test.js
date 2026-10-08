import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATMOSPHERE_PHASES,
  atmospherePhase,
  isAutoAtmosphere,
  swatchesFor,
  THEME_IDS,
  THEME_SWATCHES
} from '../src/services/ambience.js';

test('every theme has four distinct paint colours', () => {
  assert.deepEqual(THEME_IDS, ['visionos', 'cyberpunk', 'obsidian', 'solardawn', 'highcontrast']);
  for (const id of THEME_IDS) {
    const colours = THEME_SWATCHES[id];
    assert.equal(colours.length, 4, id);
    assert.equal(new Set(colours).size, 4, `${id} colours are distinct`);
    for (const colour of colours) assert.match(colour, /^#[0-9a-f]{6}$/i);
  }
});

test('unknown themes fall back to the default swatches', () => {
  assert.deepEqual(swatchesFor('nope'), THEME_SWATCHES.visionos);
  assert.deepEqual(swatchesFor('cyberpunk'), THEME_SWATCHES.cyberpunk);
});

test('auto follows the clock, a fixed setting wins, and bad input is a safe default', () => {
  assert.equal(atmospherePhase('auto', 'evening'), 'evening');
  assert.equal(atmospherePhase('night', 'morning'), 'night');
  assert.equal(atmospherePhase('auto', 'banana'), 'day');
  assert.equal(atmospherePhase(undefined, undefined), 'day');
  assert.ok(ATMOSPHERE_PHASES.every((phase) => atmospherePhase(phase, 'day') === phase));
});

test('only the auto setting is flagged as automatic', () => {
  assert.equal(isAutoAtmosphere('auto'), true);
  assert.equal(isAutoAtmosphere('day'), false);
});
