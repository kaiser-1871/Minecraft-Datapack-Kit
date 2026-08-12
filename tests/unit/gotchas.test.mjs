import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanGotchas } from '../../dist/gotchas.js';

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
  assert.equal(g[0].key, '带参粒子裸ID');
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
  assert.equal(g[0].key, 'NBT字段名');
  f.cleanup();
});

test('damage nesting gotcha in json', () => {
  const f = tmp('a.json', '{ "criteria": { "c": { "trigger": "minecraft:damage_dealt", "conditions": { "damage": { "source_entity": {} } } } } }');
  const g = scanGotchas(f.p, 'a.json', '26.2');
  assert.ok(g.some(x => x.key === 'damage层级'));
  f.cleanup();
});

test('criteria+OR gotcha in json', () => {
  const f = tmp('b.json', '{ "criteria": { "c1": { "trigger": "minecraft:impossible" }, "c2": { "trigger": "minecraft:impossible" } }, "requirements": [["c1"], ["c2"]] }');
  const g = scanGotchas(f.p, 'b.json', '26.2');
  assert.ok(g.some(x => x.key === '多criteria+OR'));
  f.cleanup();
});

test('clean file has no gotchas', () => {
  const f = tmp('z.mcfunction', 'say ok\n');
  assert.equal(scanGotchas(f.p, 'z.mcfunction', '26.2').length, 0);
  f.cleanup();
});

// ---- 乘数方向: add_multiplied_* 值是 ×(1+v),正值是提升不是减半 ----

test('add_multiplied_total on a speed attribute with value in (0,1) triggers direction hint', () => {
  const f = tmp('a.mcfunction', 'attribute @p minecraft:movement_speed modifier add foo 0.5 add_multiplied_total\n');
  const g = scanGotchas(f.p, 'a.mcfunction', '26.2');
  assert.ok(g.some(x => x.key === '乘数方向'), JSON.stringify(g));
  assert.ok(g[0].msg.includes('×1.50'), 'message explains ×(1+v)');
  f.cleanup();
});

test('add_multiplied_base also triggers, add_value does not', () => {
  const base = tmp('b.mcfunction', 'attribute @p minecraft:attack_speed modifier add foo 0.3 add_multiplied_base\n');
  assert.ok(scanGotchas(base.p, 'b.mcfunction', '26.2').some(x => x.key === '乘数方向'));
  base.cleanup();
  const value = tmp('v.mcfunction', 'attribute @p minecraft:movement_speed modifier add foo 0.5 add_value\n');
  assert.ok(!scanGotchas(value.p, 'v.mcfunction', '26.2').some(x => x.key === '乘数方向'));
  value.cleanup();
});

test('negative / >=1 values and non-speed attributes do not trigger', () => {
  const neg = tmp('n.mcfunction', 'attribute @p minecraft:movement_speed modifier add foo -0.5 add_multiplied_total\n');
  assert.ok(!scanGotchas(neg.p, 'n.mcfunction', '26.2').some(x => x.key === '乘数方向'));
  neg.cleanup();
  const big = tmp('b.mcfunction', 'attribute @p minecraft:movement_speed modifier add foo 1.5 add_multiplied_total\n');
  assert.ok(!scanGotchas(big.p, 'b.mcfunction', '26.2').some(x => x.key === '乘数方向'));
  big.cleanup();
  const hp = tmp('h.mcfunction', 'attribute @p minecraft:max_health modifier add foo 0.5 add_multiplied_total\n');
  assert.ok(!scanGotchas(hp.p, 'h.mcfunction', '26.2').some(x => x.key === '乘数方向'));
  hp.cleanup();
});

test('modifier remove / modifier value get do not false-hit', () => {
  const rm = tmp('r.mcfunction', 'attribute @p minecraft:movement_speed modifier remove foo\nattribute @p minecraft:movement_speed modifier value get foo\n');
  assert.ok(!scanGotchas(rm.p, 'r.mcfunction', '26.2').some(x => x.key === '乘数方向'));
  rm.cleanup();
});
