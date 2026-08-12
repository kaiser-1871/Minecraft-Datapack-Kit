// vanilla-tags.test.mjs — vanilla tag set extracted from the cached vanilla-data tarball.
// Requires 26.2's vanilla-data tarball cached locally (it is, alongside the command tree).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadVanillaTags } from '../../dist/vanilla-tags.js';
import { isVanillaRegistryMiss } from '../../dist/ignore.js';

test('26.2 vanilla tags include damage_type/is_projectile', () => {
  const tags = loadVanillaTags('26.2');
  assert.ok(tags && tags.size > 100, `expected a large tag set, got ${tags?.size ?? 'null'}`);
  assert.ok(tags.has('damage_type/is_projectile'), 'is_projectile is a vanilla damage_type tag');
  assert.ok(!tags.has('damage_type/is_magic'), 'is_magic was removed/renamed in 26.2 — data-driven');
  assert.ok(tags.has('entity_type/skeletons'), 'entity_type tags are included');
});

test('unknown/uncached version degrades gracefully to null', () => {
  assert.equal(loadVanillaTags('0.0.none'), null);
});

test('tag false positives are filtered when the tag data is available', () => {
  const tags = loadVanillaTags('26.2');
  assert.ok(tags);
  const msg = 'Cannot find tag/damage_type “minecraft:is_projectile” (rule: undeclaredSymbol)';
  assert.ok(isVanillaRegistryMiss(msg, {}, tags), 'vanilla tag ref is a known false positive');
  // a tag that is NOT vanilla (custom) is kept
  assert.ok(!isVanillaRegistryMiss('Cannot find tag/damage_type “minecraft:not_a_tag” (rule: undeclaredSymbol)', {}, tags));
  // without tag data, the filter stays off (safe fallback)
  assert.ok(!isVanillaRegistryMiss(msg, {}, null));
  assert.ok(!isVanillaRegistryMiss(msg, {}));
});
