// version.test.mjs — game-version string comparison used by the entity-NBT schema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareGameVersions } from '../../dist/version.js';

test('basic dotted ordering', () => {
  assert.ok(compareGameVersions('1.21.4', '1.21.5') < 0);
  assert.equal(compareGameVersions('1.21.5', '1.21.5'), 0);
  assert.ok(compareGameVersions('1.21.5', '1.21.4') > 0);
});

test('26.x series sorts after 1.21.x', () => {
  assert.ok(compareGameVersions('1.21.11', '26.1') < 0);
  assert.ok(compareGameVersions('26.1', '26.2') < 0);
  assert.ok(compareGameVersions('26.2', '1.21.4') > 0);
});

test('snapshot suffixes are ignored, patch versions sort', () => {
  assert.equal(compareGameVersions('26.3-snapshot-2', '26.3-snapshot-5'), 0);
  assert.ok(compareGameVersions('26.1', '26.1.2') < 0);
  assert.ok(compareGameVersions('26.1.2', '26.1') > 0);
});