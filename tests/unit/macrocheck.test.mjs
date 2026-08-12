// macrocheck.test.mjs — literal registry-ID validation inside $ macro lines.
// Uses the real cached 26.2 command tree + registries (same data the engine uses).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCommandTree } from '../../dist/syntax.js';
import { loadRegistries } from '../../dist/registry.js';
import { buildDeclaredRegistryIds, scanMacroRegistry } from '../../dist/macrocheck.js';

const tree = loadCommandTree('26.2');
const regs = loadRegistries('26.2');

function scan(content, declared = new Set()) {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-macro-'));
  const f = join(dir, 'm.mcfunction');
  writeFileSync(f, content);
  const r = scanMacroRegistry(f, tree, regs, declared);
  rmSync(dir, { recursive: true, force: true });
  return r;
}

test('evaluation scenario: removed knockback in a macro line is flagged', () => {
  const r = scan('$execute as $(source) run effect give $(target) minecraft:knockback 1 1\n');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].line, 1);
  assert.equal(r.issues[0].key, '宏行注册表');
  assert.ok(r.issues[0].msg.includes('minecraft:knockback'));
  assert.ok(r.issues[0].msg.includes('mob_effect'));
  assert.equal(r.checked, 1);
});

test('a legal vanilla registry ID in a macro line passes clean', () => {
  const r = scan('$execute as $(source) run effect give $(target) minecraft:speed 2 1\n');
  assert.equal(r.issues.length, 0);
  assert.equal(r.checked, 1);
});

test('execute/run chain with interpolations before the registry slot stays in sync', () => {
  // $(target) consumes one entity slot; minecraft:arrow is then a literal damage_type slot.
  const r = scan('$execute if biome ~ ~ ~ $(b) run damage $(t) 2 minecraft:arrow\n');
  assert.equal(r.issues.length, 0);
  assert.ok(r.checked >= 1, `expected arrow to be checked, got checked=${r.checked}`);
});

test('return run (dead-end literal, not execute) jumps to command root', () => {
  const r = scan('$return run attribute @p $(attr) modifier add foo 1 add_multiplied_total\n');
  assert.equal(r.issues.length, 0); // $(attr) is an interpolation → unchecked, no warning
  assert.ok(r.unchecked >= 1);
});

test('tags and custom namespaces are never warned (marked unchecked)', () => {
  const r = scan(
    '$execute run damage $(t) 2 #minecraft:is_projectile\n' +
    '$execute run damage $(t) 2 test:my_type\n',
  );
  assert.equal(r.issues.length, 0);
  assert.ok(r.unchecked >= 2);
});

test('pack-declared data-driven registry entry suppresses the warning', () => {
  // datapack declares data/minecraft/damage_type/my_type.json → minecraft:my_type is valid
  const declared = new Set(['damage_type/my_type']);
  const r = scan('$damage $(t) 2 minecraft:my_type\n', declared);
  assert.equal(r.issues.length, 0);
  // without the declaration it IS flagged
  const r2 = scan('$damage $(t) 2 minecraft:my_type\n');
  assert.equal(r2.issues.length, 1);
});

test('macro assignment lines and lines without interpolation are skipped', () => {
  const r = scan('$var = 5\n$execute run say hi\n# comment $execute run damage $(t) 2 x\n');
  assert.equal(r.lines, 0); // no line with $( … ) → nothing scanned
});

test('first-token interpolation (whole command is a macro) is unchecked, never warned', () => {
  const r = scan('$(full_command)\n');
  assert.equal(r.issues.length, 0);
  assert.equal(r.lines, 1);
  assert.ok(r.unchecked >= 1);
});

test('buildDeclaredRegistryIds collects registry entries (and skips tags)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-decl-'));
  try {
    mkdirSync(join(dir, 'data', 'test', 'damage_type'), { recursive: true });
    mkdirSync(join(dir, 'data', 'test', 'worldgen', 'biome'), { recursive: true });
    mkdirSync(join(dir, 'data', 'test', 'tags', 'damage_type'), { recursive: true });
    writeFileSync(join(dir, 'data', 'test', 'damage_type', 'my_type.json'), '{}');
    writeFileSync(join(dir, 'data', 'test', 'worldgen', 'biome', 'my_biome.json'), '{}');
    writeFileSync(join(dir, 'data', 'test', 'tags', 'damage_type', 'is_magic.json'), '{}');
    const d = buildDeclaredRegistryIds(dir);
    assert.ok(d.has('damage_type/my_type'));
    assert.ok(d.has('worldgen/biome/my_biome'));
    assert.ok(!d.has('tags/damage_type/is_magic'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('multitoken interpolation at a position arg stops conservatively (no false warning)', () => {
  const r = scan('$execute if biome $(b) run damage $(t) 2 minecraft:not_a_damage\n');
  // $(b) sits on a block_pos (3-token) slot → cannot resync → rest is unchecked, NOT warned
  assert.equal(r.issues.length, 0);
  assert.equal(r.checked, 0);
  assert.ok(r.unchecked >= 4);
});
