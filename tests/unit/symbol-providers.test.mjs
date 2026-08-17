import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptySymbols, prepareAuxPacks, resolveAuxSymbol, scanPackSymbols } from '../../dist/symbol-providers.js';

function write(root, rel, text) {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, text);
}

test('scanPackSymbols indexes data symbols and resource-pack-only assets', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-sym-'));
  try {
    write(dir, 'data/a/function/nested/f.mcfunction', 'say hi\n');
    write(dir, 'data/a/tags/function/t.json', '{"values":[]}');
    write(dir, 'data/a/predicate/p.json', '{}');
    write(dir, 'assets/a/sounds.json', '{"snd.one":{}}');
    write(dir, 'assets/a/font/f.json', '{}');
    write(dir, 'assets/a/lang/en_us.json', '{"key.one":"x"}');
    const s = scanPackSymbols(dir, true);
    assert.ok(s.functions.has('a:nested/f'));
    assert.ok(s.tags.get('function')?.has('a:t'));
    assert.ok(s.predicates.has('a:p'));
    assert.ok(s.soundEvents.has('a:snd.one'));
    assert.ok(s.fonts.has('a:f'));
    assert.ok(s.translations.has('key.one'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('resolveAuxSymbol honors current > workspace > resource order', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-aux-'));
  try {
    write(dir, 'data/a/function/x.mcfunction', '');
    const current = { kind: 'current', display: 'current', root: dir, symbols: scanPackSymbols(dir, true), cleanup: () => {} };
    const ws = { kind: 'workspace', display: 'ws', root: dir, symbols: scanPackSymbols(dir, true), cleanup: () => {} };
    const rp = { kind: 'resource-pack', display: 'rp', root: dir, symbols: emptySymbols(), cleanup: () => {} };
    const hit = resolveAuxSymbol('Cannot find function "a:x" (rule: undeclaredSymbol)', [current, ws, rp]);
    assert.equal(hit?.source, 'current');

    const wsHit = resolveAuxSymbol('Cannot find function "a:x"', [ws, rp]);
    assert.equal(wsHit?.source, 'workspace');
    assert.equal(wsHit?.pack, 'ws');

    const rpSymbols = scanPackSymbols(dir, false);
    write(dir, 'assets/a/sounds.json', '{"snd.one":{}}');
    const rpWithSound = { ...rp, symbols: scanPackSymbols(dir, false) };
    const soundHit = resolveAuxSymbol('Cannot find sound_event "a:snd.one"', [rpWithSound]);
    assert.equal(soundHit?.source, 'resource-pack');
    assert.equal(soundHit?.note, 'resolved from resource pack (auxiliary symbol only, not validated)');
    void rpSymbols;
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('scanPackSymbols indexes objectives, teams, and structures from functions', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-sym2-'));
  try {
    write(dir, 'data/a/function/load.mcfunction', 'scoreboard objectives add kills dummy\nteam add red\n');
    write(dir, 'data/a/structures/house.nbt', '');
    const s = scanPackSymbols(dir, true);
    assert.ok(s.objectives.has('kills'));
    assert.ok(s.teams.has('red'));
    assert.ok(s.structures.has('a:house'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('resolveAuxSymbol resolves objectives, teams, and structures from workspace', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-aux3-'));
  try {
    write(dir, 'data/a/function/load.mcfunction', 'scoreboard objectives add kills dummy\nteam add red\n');
    write(dir, 'data/a/structures/house.nbt', '');
    const ws = { kind: 'workspace', display: 'ws', root: dir, symbols: scanPackSymbols(dir, true), cleanup: () => {} };
    assert.equal(resolveAuxSymbol('Cannot find objective "kills"', [ws])?.source, 'workspace');
    assert.equal(resolveAuxSymbol('Cannot find team "red"', [ws])?.source, 'workspace');
    assert.equal(resolveAuxSymbol('Cannot find structure "a:house"', [ws])?.source, 'workspace');
    assert.equal(resolveAuxSymbol('Cannot find objective "missing"', [ws]), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('prepareAuxPacks accepts comma lists and rejects missing paths', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-aux2-'));
  try {
    write(dir, 'data/a/function/x.mcfunction', '');
    const [a, b] = await prepareAuxPacks([`${dir},${dir}`], 'workspace');
    assert.equal(a.root, dir);
    assert.equal(b.root, dir);
    await assert.rejects(() => prepareAuxPacks(['Z:/no/such/aux/pack'], 'workspace'), /not found/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
