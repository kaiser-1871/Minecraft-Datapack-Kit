// entity-nbt.test.mjs — per-version entity NBT schema + summon/data scanner.
// Uses the real cached vanilla-mcdoc tarball + registries (same data the engine validates against).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEntitySchemas, scanEntityNbt } from '../../dist/entity-nbt.js';
import { loadRegistries } from '../../dist/registry.js';

const schema = loadEntitySchemas('26.2');
const regs = loadRegistries('26.2');

function scan(content, version = '26.2') {
  return scanEntityNbt('tmp.mcfunction', schema, regs, new Set(), version, content);
}

test('schema loads from the cached mcdoc tarball and resolves zombie fields', () => {
  assert.ok(schema, 'schema should load (mcdoc tarball cached)');
  const z = schema.entities.get('zombie');
  assert.ok(z, 'zombie should be in the schema');
  assert.ok(z.has('IsBaby'));
  assert.ok(z.has('equipment'));
  assert.equal(z.get('HandItems')?.until, '1.21.5');
  assert.equal(z.get('equipment')?.since, '1.21.5');
  assert.equal(z.get('DeathLootTable')?.registry, 'loot_table');
});

test('evaluation scenario: HandItems/ArmorItems merged into equipment are flagged in 26.2', () => {
  const r = scan('summon minecraft:zombie ~ ~ ~ {HandItems:[{},{}]}\n');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].key, 'nbt-field-removed');
  assert.ok(r.issues[0].msg.includes("'HandItems'"));
  assert.ok(r.issues[0].msg.includes('removed in 1.21.5'));
  const r2 = scan('summon minecraft:zombie ~ ~ ~ {ArmorItems:[{},{},{},{}]}\n');
  assert.equal(r2.issues.length, 1);
  assert.equal(r2.issues[0].key, 'nbt-field-removed');
});

test('evaluation scenario: minecraft:empty loot table is flagged in 26.2', () => {
  const r = scan('summon minecraft:zombie ~ ~ ~ {DeathLootTable:"minecraft:empty"}\n');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].key, 'nbt-registry');
  assert.ok(r.issues[0].msg.includes('minecraft:empty'));
  assert.ok(r.issues[0].msg.includes('loot_table'));
});

test('valid summon NBT passes clean', () => {
  const r = scan('summon minecraft:zombie ~ ~ ~ {IsBaby:1b,equipment:{},DeathLootTable:"minecraft:chests/abandoned_mineshaft"}\n');
  assert.equal(r.issues.length, 0);
  assert.ok(r.checked >= 3);
});

test('data merge entity validates registry-bearing fields without knowing the entity type', () => {
  const r = scan('data merge entity @s {DeathLootTable:"minecraft:empty"}\n');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].key, 'nbt-registry');
});

test('unknown field / unknown entity are unchecked, never warned', () => {
  const r = scan('summon minecraft:zombie ~ ~ ~ {NoSuchField:1b}\n');
  assert.equal(r.issues.length, 0);
  assert.equal(r.unchecked, 1);
  const r2 = scan('summon mypack:custom_entity ~ ~ ~ {Whatever:1b}\n');
  assert.equal(r2.issues.length, 0);
  assert.equal(r2.unchecked, 1);
});

test('a field added in a later version is flagged as future in an older version', () => {
  // equipment was added in 1.21.5 — in 1.21.4 it is not available (and HandItems still is)
  const r = scan('summon minecraft:zombie ~ ~ ~ {equipment:{}}\n', '1.21.4');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].key, 'nbt-field-future');
  assert.ok(r.issues[0].msg.includes('added in 1.21.5'));
  const r2 = scan('summon minecraft:zombie ~ ~ ~ {HandItems:[{},{}]}\n', '1.21.4');
  assert.equal(r2.issues.length, 0);
});

// ---- real-parser coverage (P0 refactor): field-level/type-level #[id(…)] attributes ----

test('registry-annotated fields the old regex parser missed are now present', () => {
  // The regex parser only caught #[id(registry="…")] spelled out in the raw text and found 2
  // fields; the real parser also reads #[id("minecraft:…")] positional forms and attribute
  // trees, giving the data-merge check 10 registry-bearing fields.
  assert.ok(schema.registryFields.size >= 8, `registryFields=${schema.registryFields.size}`);
  assert.equal(schema.registryFields.get('Motive'), 'motive');
  assert.equal(schema.registryFields.get('SoundEvent'), 'sound_event');
  assert.equal(schema.registryFields.get('Dimension'), 'dimension');
});

test('inline `dispatch … to struct X {…}` targets resolve (area_effect_cloud)', () => {
  const aec = schema.entities.get('area_effect_cloud');
  assert.ok(aec, 'area_effect_cloud should be in the schema');
  assert.ok(aec.size >= 20, `area_effect_cloud fields=${aec.size}`);
  assert.ok(aec.has('Duration') && aec.has('Potion'));
});

test('positional #[id("minecraft:…")] form is validated (arrow SoundEvent)', () => {
  const r = scan('summon minecraft:arrow ~ ~ ~ {SoundEvent:"minecraft:no_such_sound"}\n');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].key, 'nbt-registry');
  assert.ok(r.issues[0].msg.includes('sound_event'));
});

test('registry missing from dpkit data is checked-but-skipped, never warned (Motive)', () => {
  // 'motive' is annotated in the schema but absent from dpkit's registry cache → skip, don't warn.
  const r = scan('data merge entity @s {Motive:"minecraft:whatever"}\n');
  assert.equal(r.issues.length, 0);
  assert.equal(r.checked, 1);
});