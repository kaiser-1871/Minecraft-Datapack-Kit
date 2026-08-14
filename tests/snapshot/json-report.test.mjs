// json-report.test.mjs — snapshot the --json report shape so field renames/removals
// (schemaVersion, summary, coverage, engine, issues[]) break loudly instead of silently
// breaking downstream scripts/CI that parse the JSON.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checkDatapack } from '../../dist/api.js';

const fixture = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'pack');

test('--json report shape is stable (top-level keys and field types)', async () => {
  const { report } = await checkDatapack({ datapack: fixture, version: '26.2', engine: 'inproc', noLog: true });

  // top-level keys (rename/remove/add a field → this breaks)
  assert.deepEqual(Object.keys(report).sort(), [
    'byMessage', 'coverage', 'datapack', 'engine', 'files', 'gotchas', 'ignored',
    'issues', 'log', 'resolvedVersion', 'schemaVersion', 'summary', 'version',
  ].sort());

  // schema version gate
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.engine, 'inproc');

  // summary field types
  for (const k of ['errors', 'warnings', 'ignored', 'internalFailures', 'gotchas']) {
    assert.equal(typeof report.summary[k], 'number', `summary.${k} should be a number`);
  }

  // coverage field types
  for (const k of ['filesChecked', 'filesSkipped', 'macroLines', 'macroChecked', 'macroUnchecked', 'nbtLines', 'nbtChecked', 'nbtUnchecked', 'autoFiltered']) {
    assert.equal(typeof report.coverage[k], 'number', `coverage.${k} should be a number`);
  }

  // files
  assert.equal(typeof report.files.checked, 'number');
  assert.equal(typeof report.files.clean, 'number');

  // issue shape
  for (const i of report.issues) {
    assert.equal(typeof i.file, 'string');
    assert.equal(typeof i.line, 'number');
    assert.equal(typeof i.char, 'number');
    assert.ok(['E', 'W', '·'].includes(i.severity));
    assert.equal(typeof i.message, 'string');
  }

  // gotchas shape
  for (const g of report.gotchas) {
    assert.equal(typeof g.file, 'string');
    assert.ok(Array.isArray(g.items));
    for (const it of g.items) {
      assert.equal(typeof it.line, 'number');
      assert.equal(typeof it.key, 'string');
      assert.equal(typeof it.msg, 'string');
    }
  }

  // log is a discriminated union
  assert.equal(typeof report.log.found, 'boolean');

  // byMessage
  assert.ok(Array.isArray(report.byMessage));
  for (const m of report.byMessage) {
    assert.equal(typeof m.message, 'string');
    assert.equal(typeof m.count, 'number');
  }
});
