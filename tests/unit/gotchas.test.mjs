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

test('particle item bare id triggers gotcha', () => {
  const f = tmp('x.mcfunction', 'particle minecraft:item dirt\n');
  const g = scanGotchas(f.p, 'x.mcfunction');
  assert.equal(g.length, 1);
  assert.equal(g[0].key, '带参粒子裸ID');
  assert.equal(g[0].line, 1);
  f.cleanup();
});

test('summon lowercase NBT triggers gotcha', () => {
  const f = tmp('y.mcfunction', 'summon minecraft:zombie ~ ~ ~ {tags:[a]}\n');
  const g = scanGotchas(f.p, 'y.mcfunction');
  assert.equal(g.length, 1);
  assert.equal(g[0].key, 'NBT字段名');
  f.cleanup();
});

test('damage nesting gotcha in json', () => {
  const f = tmp('a.json', '{ "criteria": { "c": { "trigger": "minecraft:damage_dealt", "conditions": { "damage": { "source_entity": {} } } } } }');
  const g = scanGotchas(f.p, 'a.json');
  assert.ok(g.some(x => x.key === 'damage层级'));
  f.cleanup();
});

test('criteria+OR gotcha in json', () => {
  const f = tmp('b.json', '{ "criteria": { "c1": { "trigger": "minecraft:impossible" }, "c2": { "trigger": "minecraft:impossible" } }, "requirements": [["c1"], ["c2"]] }');
  const g = scanGotchas(f.p, 'b.json');
  assert.ok(g.some(x => x.key === '多criteria+OR'));
  f.cleanup();
});

test('clean file has no gotchas', () => {
  const f = tmp('z.mcfunction', 'say ok\n');
  assert.equal(scanGotchas(f.p, 'z.mcfunction').length, 0);
  f.cleanup();
});
