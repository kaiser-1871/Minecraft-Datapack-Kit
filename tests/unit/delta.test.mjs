import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { issueSig, loadBaseline, saveBaseline } from '../../dist/delta.js';

test('issueSig sorts by line then char', () => {
  const ds = [
    { severity: 2, message: 'B', range: { start: { line: 2, character: 0 }, end: { line: 2, character: 1 } } },
    { severity: 1, message: 'A', range: { start: { line: 1, character: 5 }, end: { line: 1, character: 6 } } },
  ];
  assert.equal(issueSig(ds), '1:A\n2:B');
});

test('issueSig is stable for same issues regardless of input order', () => {
  const a = [
    { severity: 1, message: 'x', range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } } },
    { severity: 2, message: 'y', range: { start: { line: 0, character: 9 }, end: { line: 0, character: 10 } } },
  ];
  const b = [...a].reverse();
  assert.equal(issueSig(a), issueSig(b));
});

test('baseline load/save round-trip + key mismatch', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-delta-'));
  const file = join(dir, 'b.json');
  try {
    saveBaseline(file, { datapack: 'DP', version: '26.2', files: { 'a.mcfunction': { sig: '1:x' } } });
    assert.deepEqual(loadBaseline(file, 'DP', '26.2'), { 'a.mcfunction': { sig: '1:x' } });
    assert.deepEqual(loadBaseline(file, 'OTHER', '26.2'), {}); // datapack mismatch
    assert.deepEqual(loadBaseline(file, 'DP', '26.3'), {});    // version mismatch
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
