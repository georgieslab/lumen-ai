import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_AURAS, getAuraById, getNextAuraId } from '../src/services/auras.js';

test('PRESET_AURAS contains 8 rich ambient mood lighting presets', () => {
  assert.equal(PRESET_AURAS.length, 8);
  for (const aura of PRESET_AURAS) {
    assert.ok(aura.id, 'aura must have an id');
    assert.ok(aura.name, 'aura must have a name');
    assert.ok(aura.icon, 'aura must have an icon');
    assert.ok(aura.description, 'aura must have a description');
    assert.ok(Array.isArray(aura.colors) && aura.colors.length >= 3, 'aura must have 3+ palette colors');
    assert.ok(aura.accent, 'aura must have an accent color');
  }
});

test('getAuraById retrieves correct aura by id or defaults to first', () => {
  const aurora = getAuraById('aurora-borealis');
  assert.equal(aurora.id, 'aurora-borealis');
  assert.equal(aurora.name, 'Aurora Borealis');

  const fallback = getAuraById('non-existent-aura-xyz');
  assert.equal(fallback.id, PRESET_AURAS[0].id);
});

test('getNextAuraId cycles forward through presets continuously', () => {
  const first = PRESET_AURAS[0].id;
  const second = PRESET_AURAS[1].id;
  assert.equal(getNextAuraId(first), second);

  const last = PRESET_AURAS[PRESET_AURAS.length - 1].id;
  assert.equal(getNextAuraId(last), first);
});
