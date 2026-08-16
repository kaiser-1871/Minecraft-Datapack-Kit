import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scanGotchas } from '../../dist/gotchas.js';
// Most fixtures use 26.2 as a fixed label; ender-eye gotcha is version-gated and has a pre-1.21.4
// assertion in the same test. Cross-version smoke coverage is in tests/multi-version.test.mjs.
import { scanGotchasStandalone } from '../../dist/api.js';

function tmp(name, content) {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-gotcha-'));
  const p = join(dir, name);
  writeFileSync(p, content);
  return { p, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('particle item bare id triggers gotcha (message stamped with version)', () => {
  const f = tmp('x.mcfunction', 'particle minecraft:item dirt\n');
  const g = scanGotchas(f.p, 'x.mcfunction', '26.2');
  assert.equal(g.length, 1);
  assert.equal(g[0].key, 'particle-bare-id');
  assert.equal(g[0].line, 1);
  assert.ok(g[0].msg.startsWith('26.2:'));
  f.cleanup();
});

test('gotcha message uses the passed version', () => {
  const f = tmp('y.mcfunction', 'particle minecraft:item dirt\n');
  const g = scanGotchas(f.p, 'y.mcfunction', '1.21.4');
  assert.ok(g[0].msg.startsWith('1.21.4:'));
  f.cleanup();
});

test('summon lowercase NBT triggers gotcha', () => {
  const f = tmp('y.mcfunction', 'summon minecraft:zombie ~ ~ ~ {tags:[a]}\n');
  const g = scanGotchas(f.p, 'y.mcfunction', '26.2');
  assert.equal(g.length, 1);
  assert.equal(g[0].key, 'nbt-field-casing');
  f.cleanup();
});

test('damage nesting gotcha in json', () => {
  const f = tmp('a.json', '{ "criteria": { "c": { "trigger": "minecraft:damage_dealt", "conditions": { "damage": { "source_entity": {} } } } } }');
  const g = scanGotchas(f.p, 'a.json', '26.2');
  assert.ok(g.some(x => x.key === 'damage-nesting'));
  f.cleanup();
});

test('criteria+OR gotcha in json', () => {
  const f = tmp('b.json', '{ "criteria": { "c1": { "trigger": "minecraft:impossible" }, "c2": { "trigger": "minecraft:impossible" } }, "requirements": [["c1"], ["c2"]] }');
  const g = scanGotchas(f.p, 'b.json', '26.2');
  assert.ok(g.some(x => x.key === 'multi-criteria-OR'));
  f.cleanup();
});

test('clean file has no gotchas', () => {
  const f = tmp('z.mcfunction', 'say ok\n');
  assert.equal(scanGotchas(f.p, 'z.mcfunction', '26.2').length, 0);
  f.cleanup();
});

test('ender_eye item definition with consumable triggers the throw/consume_item gotcha', () => {
  const f = tmp('ender_eye.json', '{ "components": { "minecraft:consumable": {} } }');
  const g = scanGotchas(f.p, 'minecraft/item/ender_eye.json', '26.2');
  assert.equal(g.length, 1);
  assert.equal(g[0].key, 'ender-eye-consumable');
  assert.ok(g[0].msg.includes('consume_item'));

  const older = scanGotchas(f.p, 'minecraft/item/ender_eye.json', '1.21.3');
  assert.equal(older.length, 0, 'consumable did not exist before 1.21.4');
  f.cleanup();
});

test('other items with consumable do not trigger the ender_eye gotcha', () => {
  const f = tmp('apple.json', '{ "components": { "minecraft:consumable": {} } }');
  const g = scanGotchas(f.p, 'minecraft/item/apple.json', '26.2');
  assert.equal(g.length, 0);
  f.cleanup();
});


// ---- attribute multiplier direction: add_multiplied_* is ×(1+v); positive boosts, not halves ----

test('add_multiplied_total on a speed attribute with value in (0,1) triggers direction hint', () => {
  const f = tmp('a.mcfunction', 'attribute @p minecraft:movement_speed modifier add foo 0.5 add_multiplied_total\n');
  const g = scanGotchas(f.p, 'a.mcfunction', '26.2');
  assert.ok(g.some(x => x.key === 'attribute-multiplier-direction'), JSON.stringify(g));
  assert.ok(g[0].msg.includes('×1.50'), 'message explains ×(1+v)');
  f.cleanup();
});

test('add_multiplied_base also triggers, add_value does not', () => {
  const base = tmp('b.mcfunction', 'attribute @p minecraft:attack_speed modifier add foo 0.3 add_multiplied_base\n');
  assert.ok(scanGotchas(base.p, 'b.mcfunction', '26.2').some(x => x.key === 'attribute-multiplier-direction'));
  base.cleanup();
  const value = tmp('v.mcfunction', 'attribute @p minecraft:movement_speed modifier add foo 0.5 add_value\n');
  assert.ok(!scanGotchas(value.p, 'v.mcfunction', '26.2').some(x => x.key === 'attribute-multiplier-direction'));
  value.cleanup();
});

test('negative / >=1 values and non-speed attributes do not trigger', () => {
  const neg = tmp('n.mcfunction', 'attribute @p minecraft:movement_speed modifier add foo -0.5 add_multiplied_total\n');
  assert.ok(!scanGotchas(neg.p, 'n.mcfunction', '26.2').some(x => x.key === 'attribute-multiplier-direction'));
  neg.cleanup();
  const big = tmp('b.mcfunction', 'attribute @p minecraft:movement_speed modifier add foo 1.5 add_multiplied_total\n');
  assert.ok(!scanGotchas(big.p, 'b.mcfunction', '26.2').some(x => x.key === 'attribute-multiplier-direction'));
  big.cleanup();
  const hp = tmp('h.mcfunction', 'attribute @p minecraft:max_health modifier add foo 0.5 add_multiplied_total\n');
  assert.ok(!scanGotchas(hp.p, 'h.mcfunction', '26.2').some(x => x.key === 'attribute-multiplier-direction'));
  hp.cleanup();
});

test('modifier remove / modifier value get do not false-hit', () => {
  const rm = tmp('r.mcfunction', 'attribute @p minecraft:movement_speed modifier remove foo\nattribute @p minecraft:movement_speed modifier value get foo\n');
  assert.ok(!scanGotchas(rm.p, 'r.mcfunction', '26.2').some(x => x.key === 'attribute-multiplier-direction'));
  rm.cleanup();
});

// ---- scanGotchasStandalone (the MCP scan_gotchas entry: pure file scan, no engine) ----

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'pack');

test('scanGotchasStandalone finds gotchas in the fixture without an engine', () => {
  const gotchas = scanGotchasStandalone(FIXTURE, 'test/function/gotcha.mcfunction', '26.2');
  assert.equal(gotchas.length, 1);
  assert.equal(gotchas[0].file, 'test/function/gotcha.mcfunction');
  assert.ok(gotchas[0].items.some(x => x.key === 'particle-bare-id'), JSON.stringify(gotchas[0].items));
});
