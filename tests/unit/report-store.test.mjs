// report-store.test.mjs — report write/read/diff utilities.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diffReports, writeReport, readReport } from '../../dist/report-store.js';

function fakeReport(issues = []) {
  return {
    datapack: 'x', version: '26.2', resolvedVersion: '26.2',
    versionInfo: { target: '26.2', targetVersion: '26.2', actual: '26.2', cacheSource: 'local cache', fallback: false, targetDpv: null, actualDpv: null, uncheckedRange: null, message: null },
    files: { checked: 1, clean: 1 }, summary: { errors: 0, warnings: 0, ignored: 0, internalFailures: 0, gotchas: 0, symbolsResolved: 0, scopeHints: 0, knownFalsePositives: 0 },
    issues, ignored: [], gotchas: [], log: { found: false }, byMessage: [], resolvedSymbols: [], scopeHints: [], coverage: {},
    engine: 'inproc', schemaVersion: 1,
  };
}

test('writeReport writes file and returns null diff on first run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-report-store-'));
  const p = join(dir, 'report.json');
  try {
    const r = writeReport(fakeReport(), p);
    assert.equal(r.written, true);
    assert.equal(r.diff_from_last, null);
    assert.ok(readReport(p));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeReport computes diff on second run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-report-store-'));
  const p = join(dir, 'report.json');
  try {
    writeReport(fakeReport(), p);
    const old = fakeReport([{ file: 'a.mcfunction', line: 1, char: 0, severity: 'E', message: 'old' }]);
    writeFileSync(p, JSON.stringify(old));
    const cur = fakeReport([{ file: 'b.mcfunction', line: 1, char: 0, severity: 'E', message: 'new' }]);
    const r = writeReport(cur, p);
    assert.deepEqual(r.diff_from_last, { files_added: 1, files_removed: 1, new_errors: 1, fixed_errors: 1 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('diffReports returns null when old is null', () => {
  assert.equal(diffReports(null, fakeReport()), null);
});
