// logcheck.test.mjs — game-log self-check: discovery, freshness, advancement count, error hits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gameLogReport } from '../../dist/logcheck.js';

test('gameLogReport reads latest.log, reports stale packs and datapack load errors', () => {
  const root = mkdtempSync(join(tmpdir(), 'dpkit-logcheck-'));
  const logs = join(root, 'logs');
  const pack = join(root, 'pack');
  mkdirSync(logs, { recursive: true });
  mkdirSync(join(pack, 'data', 'my_ns', 'function'), { recursive: true });
  const fn = join(pack, 'data', 'my_ns', 'function', 'a.mcfunction');
  writeFileSync(fn, 'say hi\n');
  writeFileSync(join(logs, 'latest.log'), [
    'Loaded 7 advancements',
    'Some irrelevant mod line',
    '[Server thread/ERROR]: Errors in currently selected datapacks prevented the world from loading.',
    '[Server thread/ERROR]: Couldn\'t parse data/my_ns/function/bad.mcfunction',
  ].join('\n') + '\n');
  // Make the pack newer than the log → stale should be true.
  const past = new Date(Date.now() - 60_000);
  utimesSync(join(logs, 'latest.log'), past, past);
  const future = new Date(Date.now() + 60_000);
  utimesSync(fn, future, future);

  try {
    const r = gameLogReport(pack, [fn], root);
    assert.equal(r.found, true);
    assert.equal(r.stale, true);
    assert.equal(r.lastLoaded, '7');
    assert.ok(r.hits?.some(h => h.includes('Errors in currently selected datapacks')));
    assert.ok(r.hits?.some(h => h.includes('bad.mcfunction')));
    assert.ok(!r.hits?.some(h => h.includes('irrelevant mod line')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('gameLogReport degrades to found:false when no log exists', () => {
  const root = mkdtempSync(join(tmpdir(), 'dpkit-logcheck-empty-'));
  const oldAppdata = process.env.APPDATA;
  const oldHome = process.env.HOME;
  process.env.APPDATA = join(root, 'no-appdata');
  process.env.HOME = join(root, 'no-home');
  try {
    const r = gameLogReport(root, [], root);
    assert.deepEqual(r, { found: false });
  } finally {
    if (oldAppdata === undefined) delete process.env.APPDATA; else process.env.APPDATA = oldAppdata;
    if (oldHome === undefined) delete process.env.HOME; else process.env.HOME = oldHome;
    rmSync(root, { recursive: true, force: true });
  }
});
