// engine.test.mjs — integration test running the real in-process engine against the
// fixture datapack (tests/fixtures/pack). Requires 26.2 data cached locally (it is).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkDatapack, completeAt } from '../../dist/api.js';

const fixture = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'pack');
const FIXTURE_FILE_COUNT = 5; // ref/nbt/gotcha/clean .mcfunction + pack.mcmeta

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

// ---- gate: 26.2 resolves legal vanilla IDs cleanly, and flags removed/typo IDs ----
// Proves two things the data-driven filter (F3) and macro checker (M2) build on:
//  * a legal vanilla ID (minecraft:attack_speed / minecraft:speed) yields NO "Cannot find"
//    diagnostic — so F3 is a safety net, not a noise-killer, in 26.2;
//  * a removed/typo ID (minecraft:knockback) DOES yield "Cannot find mob_effect" — the very
//    diagnostic the macro-line checker will reproduce for $ lines in M2.
function tempPack(files) {
  const dir = join(tmpdir(), `dpkit-gate-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(dir, 'data', 'test', 'function'), { recursive: true });
  writeFileSync(join(dir, 'pack.mcmeta'), JSON.stringify({ pack: { pack_format: 57, description: 'tmp' } }));
  for (const [rel, text] of Object.entries(files)) {
    const p = join(dir, 'data', ...rel.split('/'));
    mkdirSync(p.slice(0, Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))), { recursive: true });
    writeFileSync(p, text);
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('a broken pack.mcmeta surfaces as a diagnostic', async () => {
  const f = tempPack({ 'test/function/a.mcfunction': 'say ok\n' });
  // overwrite pack.mcmeta with broken JSON
  writeFileSync(join(f.dir, 'pack.mcmeta'), '{ broken json!!');
  try {
    const { report } = await checkDatapack({ datapack: f.dir, version: '26.2', engine: 'inproc', noLog: true, ignore: { useIgnore: false, extra: [] } });
    assert.ok(report.issues.some(i => i.file === 'pack.mcmeta' && i.message.includes('pack')), JSON.stringify(report.issues.map(i => `${i.file}:${i.message}`)));
  } finally {
    f.cleanup();
  }
});

test('completeAt with inline text returns registry completions (no file needed)', async () => {
  const text = 'effect give @s knock';
  const items = await completeAt({
    datapack: fixture,
    version: '26.2',
    rel: '__inline__.mcfunction',
    line: 1,
    column: text.length + 1,
    text,
    engine: 'inproc',
  });
  assert.ok(items.length >= 40, `expected mob_effect registry completions, got ${items.length}`);
  // the completion set for "knock" is the legal mob_effect values — knockback is NOT among them
  assert.ok(items.some(i => i.label === 'minecraft:speed'));
  assert.ok(!items.some(i => i.label === 'minecraft:knockback'), 'knockback is gone in 26.2');
});

test('26.2: legal vanilla IDs clean, removed effect flagged (Cannot find mob_effect)', async () => {
  const f = tempPack({
    'test/function/t.mcfunction':
      'attribute @p minecraft:attack_speed modifier add foo 1 add_value\neffect give @s minecraft:speed 5 1 true\neffect give @s minecraft:knockback 5 1 true\n',
  });
  try {
    const { report } = await checkDatapack({ datapack: f.dir, version: '26.2', engine: 'inproc', noLog: true, ignore: { useIgnore: false, extra: [] } });
    const msgs = report.issues.map(i => i.message).join('\n');
    assert.ok(!msgs.includes('Cannot find attribute'), 'legal vanilla attribute must not be flagged');
    assert.ok(!msgs.includes('Cannot find mob_effect “minecraft:speed”'), 'legal vanilla effect must not be flagged');
    assert.ok(msgs.includes('Cannot find mob_effect “minecraft:knockback”'), 'removed effect must be flagged');
  } finally {
    f.cleanup();
  }
});
