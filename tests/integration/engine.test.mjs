// engine.test.mjs — integration test running the real in-process engine against the
// fixture datapack (tests/fixtures/pack). Requires 26.2 data cached locally (it is).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checkDatapack } from '../../dist/api.js';

const fixture = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'pack');
const FIXTURE_FILE_COUNT = 4; // ref/nbt/gotcha/clean .mcfunction (pack.mcmeta excluded)

test('in-process engine checks the fixture', async () => {
  const { report } = await checkDatapack({ datapack: fixture, version: '26.2', engine: 'inproc', noLog: true });
  assert.equal(report.files.checked, FIXTURE_FILE_COUNT);
  assert.equal(report.summary.internalFailures, 0);
  assert.equal(report.engine, 'inproc');
  assert.equal(report.schemaVersion, 1);

  // ref.mcfunction: calling a nonexistent function → undeclaredSymbol warning
  const ref = report.issues.find(i => i.file === 'test/function/ref.mcfunction');
  assert.ok(ref, 'expected an issue in ref.mcfunction');
  assert.equal(ref.severity, 'W');
  assert.ok(ref.message.includes('no_such_func'));

  // gotcha.mcfunction: particle item without map syntax → real parser errors
  assert.ok(report.issues.some(i => i.file === 'test/function/gotcha.mcfunction'));

  // nbt.mcfunction: LastHurtMob is filtered by the default ignore
  assert.equal(report.summary.ignored, 1);
  assert.ok(!report.issues.some(i => i.message.includes('LastHurtMob')));
  assert.ok(report.ignored.some(i => i.file === 'test/function/nbt.mcfunction'));

  // gotchas: the particle item bare id is flagged
  const g = report.gotchas.find(x => x.file === 'test/function/gotcha.mcfunction');
  assert.ok(g, 'expected a gotcha in gotcha.mcfunction');
  assert.ok(g.items.some(i => i.key === '带参粒子裸ID'));
});

test('no-ignore exposes LastHurtMob', async () => {
  const { report } = await checkDatapack({
    datapack: fixture,
    version: '26.2',
    engine: 'inproc',
    noLog: true,
    ignore: { useIgnore: false, extra: [] },
  });
  assert.equal(report.summary.ignored, 0);
  assert.ok(report.issues.some(i => i.message.includes('LastHurtMob')));
});

test('in-process and LSP engines agree on the fixture', async () => {
  const inp = await checkDatapack({ datapack: fixture, version: '26.2', engine: 'inproc', noLog: true });
  const lsp = await checkDatapack({ datapack: fixture, version: '26.2', engine: 'lsp', noLog: true });
  assert.equal(inp.report.summary.errors, lsp.report.summary.errors);
  assert.equal(inp.report.summary.warnings, lsp.report.summary.warnings);
  assert.deepEqual(inp.report.issues, lsp.report.issues);
});
