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

test('toRel strips the data/ prefix and normalizes separators', () => {
  const dataDir = join('D:/pack', 'data');
  assert.equal(toRel(join(dataDir, 'test', 'a.mcfunction'), dataDir), 'test/a.mcfunction');
});
