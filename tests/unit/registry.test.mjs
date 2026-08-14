// registry.test.mjs — per-version registry values from Spyglass's local cache.
// Requires 26.2 registry data cached locally (it is, alongside the command tree).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistries, registryIndex, listRegistryValues, normalizeRegistryName } from '../../dist/registry.js';
import { queryRegistry } from '../../dist/api.js';

test('26.2 registries are cached with bare value names', () => {
  const regs = loadRegistries('26.2');
  assert.ok(regs.attribute.length >= 40, 'attribute registry has 40+ values');
  assert.ok(regs.attribute.includes('attack_speed'), '26.2 uses bare "attack_speed" (no generic. prefix)');
  assert.ok(!regs.attribute.includes('generic.attack_speed'));
  assert.ok(regs.mob_effect.length >= 40);
  assert.ok(regs.mob_effect.includes('speed'));
  assert.ok(!regs.mob_effect.includes('knockback'), 'knockback was removed in 26.2');
  assert.ok(regs.damage_type.length > 0);
});

test('memo returns the same object on a second call', () => {
  assert.equal(loadRegistries('26.2'), loadRegistries('26.2'));
});

test('unknown/uncached version degrades gracefully to empty', () => {
  const regs = loadRegistries('0.0.none');
  assert.deepEqual(regs, {});
});

test('registryIndex lists names sorted with counts', () => {
  const idx = registryIndex('26.2');
  assert.ok(idx.length > 10);
  const mob = idx.find(x => x.name === 'mob_effect');
  assert.ok(mob && mob.count >= 40);
  // sorted
  for (let i = 1; i < idx.length; i++) assert.ok(idx[i - 1].name <= idx[i].name);
});

test('listRegistryValues accepts namespaced registry names', () => {
  const values = listRegistryValues('26.2', 'minecraft:mob_effect');
  assert.ok(values && values.includes('speed'));
  assert.equal(normalizeRegistryName('minecraft:attribute'), 'attribute');
  assert.equal(normalizeRegistryName('attribute'), 'attribute');
});

test('queryRegistry returns values for a known registry and an index for an unknown one', () => {
  const known = queryRegistry('minecraft:mob_effect', '26.2');
  assert.equal(known.found, true);
  assert.ok(known.count >= 40);
  assert.ok(known.values?.includes('speed'));
  assert.equal(known.index, undefined);

  const unknown = queryRegistry('nope', '26.2');
  assert.equal(unknown.found, false);
  assert.ok((unknown.index?.length ?? 0) > 10);
  const mob = unknown.index?.find(x => x.name === 'mob_effect');
  assert.ok(mob && mob.count >= 40);
});

test('queryRegistry distinguishes cache-miss (cached:false) from a genuinely unknown name', () => {
  // uncached version → no registry data at all, reported as cached:false (not "removed")
  const miss = queryRegistry('mob_effect', '0.0.none');
  assert.equal(miss.found, false);
  assert.equal(miss.cached, false);

  // a known version with cached data still has cached:true even for an unknown registry name
  const unknown = queryRegistry('nope', '26.2');
  assert.equal(unknown.found, false);
  assert.equal(unknown.cached, true);
});
