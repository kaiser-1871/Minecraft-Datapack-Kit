import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePattern, createIgnoreFilter, isVanillaRegistryMiss } from '../../dist/ignore.js';

test('parsePattern: substring vs /regex/', () => {
  assert.equal(typeof parsePattern('foo'), 'string');
  assert.ok(parsePattern('/foo/') instanceof RegExp);
  assert.equal(parsePattern('/unclosed'), '/unclosed'); // invalid regex degrades to substring
});

test('built-in LastHurtMob matches both quote forms', () => {
  const f = createIgnoreFilter({ useIgnore: true, extra: [] });
  assert.ok(f('Unknown key “LastHurtMob”'));
  assert.ok(f('Unknown key "LastHurtMob"'));
  assert.ok(!f('Unknown key “Foo”'));
});

test('--no-ignore disables the built-in', () => {
  const f = createIgnoreFilter({ useIgnore: false, extra: [] });
  assert.ok(!f('Unknown key “LastHurtMob”'));
});

test('extra substring and regex patterns', () => {
  const f = createIgnoreFilter({ useIgnore: false, extra: ['foo', '/bar\\d+/'] });
  assert.ok(f('a foo b'));
  assert.ok(f('bar123'));
  assert.ok(!f('barabc'));
});

test('comma-separated extra patterns', () => {
  const f = createIgnoreFilter({ useIgnore: false, extra: ['a,b'] });
  assert.ok(f('a'));
  assert.ok(f('b'));
});

// ---- isVanillaRegistryMiss (data-driven vanilla-registry false-positive filter) ----

const REGS = { attribute: ['attack_speed', 'movement_speed'], mob_effect: ['speed', 'slowness'] };

test('filters a vanilla ID that IS in the registry (trailing rule suffix tolerated)', () => {
  assert.ok(isVanillaRegistryMiss('Cannot find attribute “minecraft:attack_speed” (rule: undeclaredSymbol)', REGS));
  assert.ok(isVanillaRegistryMiss('Cannot find attribute "minecraft:attack_speed"', REGS)); // ASCII quote form
});

test('does not filter an ID that is NOT in the registry (genuine typo/removed)', () => {
  assert.ok(!isVanillaRegistryMiss('Cannot find mob_effect “minecraft:knockback” (rule: undeclaredSymbol)', REGS));
  assert.ok(!isVanillaRegistryMiss('Cannot find attribute “minecraft:attack_speeed”', REGS));
});

test('does not filter custom namespaces or tags', () => {
  assert.ok(!isVanillaRegistryMiss('Cannot find damage_type “test:my_type”', REGS)); // category not a key either
  assert.ok(!isVanillaRegistryMiss('Cannot find damage_type “minecraft:is_magic”', REGS));
});

test('does not filter categories we have no registry data for', () => {
  assert.ok(!isVanillaRegistryMiss('Cannot find function “test:no_such_func”', REGS));
  assert.ok(!isVanillaRegistryMiss('Unknown key “Foo”', REGS));
});

test('tag getter is resolved lazily (only for tag-miss messages)', () => {
  let calls = 0;
  const getTags = () => { calls++; return new Set(['damage_type/is_projectile']); };
  // a non-tag registry miss must not touch the (expensive) tag getter
  assert.ok(isVanillaRegistryMiss('Cannot find attribute "minecraft:attack_speed"', REGS, getTags));
  assert.equal(calls, 0);
  // a tag miss resolves it exactly once and matches
  assert.ok(isVanillaRegistryMiss('Cannot find tag/damage_type "minecraft:is_projectile"', REGS, getTags));
  assert.equal(calls, 1);
  // a null getter (or null set) disables tag filtering
  assert.ok(!isVanillaRegistryMiss('Cannot find tag/damage_type "minecraft:is_projectile"', REGS, null));
});
