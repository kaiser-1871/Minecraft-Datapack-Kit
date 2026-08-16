import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDatapackClean, assertDatapackSnapshot, formatReport } from '../../dist/testing.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // tests/unit/ -> repo root
const FIXTURE = join(ROOT, 'tests', 'fixtures', 'pack');

const cleanOpts = {
  datapack: FIXTURE,
  version: '26.2',
  only: 'test/function/clean.mcfunction',
  noLog: true,
  noGotchas: true,
};

test('formatReport renders issue lines', () => {
  const report = {
    issues: [
      { file: 'a.mcfunction', line: 1, char: 0, severity: 'E', message: 'bad' },
      { file: 'b.mcfunction', line: 2, char: 3, severity: 'W', message: 'careful' },
    ],
  };
  const text = formatReport(report);
  assert.match(text, /a\.mcfunction:1:0 \[E\] bad/);
  assert.match(text, /b\.mcfunction:2:3 \[W\] careful/);
});

test('assertDatapackClean passes on a clean fixture file', async () => {
  const report = await assertDatapackClean(cleanOpts);
  assert.equal(report.summary.errors, 0);
  assert.equal(report.summary.internalFailures, 0);
});

test('assertDatapackSnapshot writes then compares a snapshot', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-snap-'));
  const snapshotFile = join(dir, 'snap.json');
  try {
    await assertDatapackSnapshot({ ...cleanOpts, snapshotFile, update: true });
    assert.ok(readFileSync(snapshotFile, 'utf8').includes('"version"'));
    const report = await assertDatapackSnapshot({ ...cleanOpts, snapshotFile, update: false });
    assert.equal(report.summary.errors, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('assertDatapackSnapshot reports a mismatch', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-snap-'));
  const snapshotFile = join(dir, 'snap.json');
  writeFileSync(snapshotFile, JSON.stringify({ version: '1.21.4', summary: { errors: 99 }, issues: [] }, null, 2) + '\n');
  try {
    await assert.rejects(
      () => assertDatapackSnapshot({ ...cleanOpts, snapshotFile, update: false }),
      /snapshot mismatch/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
