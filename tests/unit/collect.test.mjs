import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectFiles, toRel } from '../../dist/collect.js';

function makePack(files) {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-collect-'));
  for (const f of files) {
    const p = join(dir, 'data', f);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, '');
  }
  return dir;
}

test('collectFiles walks data/ for .mcfunction and non-dotfile .json', () => {
  const dir = makePack([
    'test/function/a.mcfunction',
    'test/function/b.mcfunction',
    'test/predicates/p.json',
    'test/functions/x.mcfunction',
    'test/ignore/.hidden.json', // dotfile .json is excluded
    'test/notes.txt',           // non-checkable extension is excluded
  ]);
  try {
    const { rels } = collectFiles(dir, '');
    assert.deepEqual(rels.sort(), [
      'test/function/a.mcfunction',
      'test/function/b.mcfunction',
      'test/functions/x.mcfunction',
      'test/predicates/p.json',
    ].sort());
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('--files glob filters relative to data/', () => {
  const dir = makePack(['test/function/a.mcfunction', 'test/function/b.mcfunction', 'other/c.mcfunction']);
  try {
    const { rels } = collectFiles(dir, 'test/function/*.mcfunction');
    assert.deepEqual(rels, ['test/function/a.mcfunction', 'test/function/b.mcfunction']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('missing data/ dir returns an empty file list (no throw)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-collect-'));
  try {
    assert.deepEqual(collectFiles(dir, ''), { files: [], rels: [] });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an unreadable data/ path is reported through the callback (not thrown away)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-collect-'));
  writeFileSync(join(dir, 'data'), 'not a directory');
  try {
    const unreadable = [];
    const res = collectFiles(dir, '', [], entry => unreadable.push(entry));
    assert.deepEqual(res, { files: [], rels: [] });
    assert.equal(unreadable.length, 1);
    assert.equal(unreadable[0].rel, '');
    assert.equal(unreadable[0].path, join(dir, 'data'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('collectFiles includes structure NBT files and overlay data with @overlay prefixes', () => {
  const dir = makePack([
    'test/function/a.mcfunction',
    'test/structure/a.nbt',
    'test/structure/sub/b.nbt',
  ]);
  // makePack always writes files under data/<f>; create overlay files by hand.
  mkdirSync(join(dir, 'overlay_1', 'data', 'test', 'function'), { recursive: true });
  writeFileSync(join(dir, 'overlay_1', 'data', 'test', 'function', 'o.mcfunction'), '');
  try {
    const { rels } = collectFiles(dir, '', ['overlay_1']);
    assert.deepEqual(rels, [
      '@overlay:overlay_1/test/function/o.mcfunction',
      'test/function/a.mcfunction',
      'test/structure/a.nbt',
      'test/structure/sub/b.nbt',
    ]);
    // --files matches the data-relative part without the overlay prefix
    assert.deepEqual(collectFiles(dir, 'test/function/*.mcfunction', ['overlay_1']).rels, [
      '@overlay:overlay_1/test/function/o.mcfunction',
      'test/function/a.mcfunction',
    ]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('toRel strips the data/ prefix and normalizes separators', () => {
  const dataDir = join('D:/pack', 'data');
  assert.equal(toRel(join(dataDir, 'test', 'a.mcfunction'), dataDir), 'test/a.mcfunction');
});
