// version-profile.test.mjs — unit tests for version capability matrix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { versionCapability, versionProfileLabel, isAmbiguousPackFormat } from '../../dist/version-profile.js';

test('cached 26.2 is full and can give suggestions', () => {
  const cap = versionCapability('26.2');
  assert.equal(cap.profile, 'full');
  assert.equal(cap.hasCommands, true);
  assert.equal(cap.hasRegistries, true);
  assert.equal(cap.can_give_suggestions, true);
  assert.equal(cap.registry_coverage, 1);
});

test('unknown version degrades to none conservatively', () => {
  const cap = versionCapability('0.0-does-not-exist');
  assert.equal(cap.profile, 'none');
  assert.equal(cap.can_give_suggestions, false);
});

test('a wide pack-format range is ambiguous for auto', () => {
  // min=4,max=9999999 covers many releases → ambiguous.
  assert.equal(isAmbiguousPackFormat(4, 9999999, null), true);
  // A pack_format that exactly matches one release pins it.
  assert.equal(isAmbiguousPackFormat(4, 9999999, 94), false);
});

test('versionProfileLabel returns ambiguous for ambiguous range', () => {
  assert.equal(versionProfileLabel('auto', { minFormat: 4, maxFormat: 9999999, packFormat: null }), 'ambiguous');
});
