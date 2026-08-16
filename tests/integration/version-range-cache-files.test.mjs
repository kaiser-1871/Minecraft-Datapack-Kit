// version-range-cache-files.test.mjs — P2 acceptance for pack-format range detection, --files
// pack.mcmeta isolation, known-false-positive rules, delta counts, and cache-miss fail policy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkDatapack, DpkitError } from '../../dist/api.js';

function write(root, rel, text) {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, text);
}
function tmp(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
function base(dir, extra = {}) {
  return checkDatapack({
    datapack: dir, version: '26.2', engine: 'inproc', noLog: true, noGotchas: true, noEntityNbt: true,
    ignore: { useIgnore: true, extra: [] }, ...extra,
  });
}

test('max_format:9999999 is unbounded and min/max ranges are containment checks', async () => {
  const f = tmp('dpkit-range-');
  try {
    write(f.dir, 'pack.mcmeta', '{"pack":{"pack_format":94,"min_format":88,"max_format":9999999,"description":"x"}}');
    write(f.dir, 'data/test/function/a.mcfunction', 'say hi\n');
    const pinned = await base(f.dir, { version: '1.21.11' });
    assert.equal(pinned.report.summary.errors, 0);
    assert.equal(pinned.report.summary.warnings, 0);
    assert.ok(!pinned.report.issues.some(i => i.file === 'pack.mcmeta'));

    // auto now prefers the base pack_format release (1.21.11, dpv 94) inside the broad range.
    const auto = await base(f.dir, { version: 'auto' });
    assert.equal(auto.report.resolvedVersion, '1.21.11');
    assert.equal(auto.report.summary.errors, 0);

    const outside = await base(f.dir, { version: '26.2' });
    assert.equal(outside.report.summary.errors, 0); // unbounded range contains 26.2 too

    write(f.dir, 'pack.mcmeta', '{"pack":{"supported_formats":[88,94],"description":"x"}}');
    const no = await base(f.dir, { version: '26.2' });
    assert.ok(no.report.issues.some(i => i.file === 'pack.mcmeta' && i.severity === 'E' && /does not contain 26\.2/.test(i.message)));
  } finally { f.cleanup(); }
});

test('--files does not pull pack.mcmeta into the report unless explicitly requested', async () => {
  const f = tmp('dpkit-files-');
  try {
    write(f.dir, 'pack.mcmeta', 'not json {{');
    write(f.dir, 'data/test/function/a.mcfunction', 'say hi\n');
    const only = await base(f.dir, { only: 'test/function/a.mcfunction' });
    assert.equal(only.report.files.checked, 1);
    assert.ok(!only.report.issues.some(i => i.file === 'pack.mcmeta'));

    const asked = await base(f.dir, { only: 'pack.mcmeta' });
    assert.equal(asked.report.files.checked, 1);
    assert.ok(asked.report.issues.some(i => i.file === 'pack.mcmeta' && i.severity === 'E'));
  } finally { f.cleanup(); }
});

test('known-false-positive rules are data-driven, on by default, and disableable', async () => {
  const f = tmp('dpkit-fp-');
  try {
    write(f.dir, 'pack.mcmeta', '{"pack":{"pack_format":107,"description":"x"}}');
    write(f.dir, 'data/test/function/a.mcfunction',
      'summon minecraft:interaction ~ ~ ~ {response:3b}\ndata merge entity @s {text_opacity:-1b}\n');
    write(f.dir, 'data/test/predicate/p.json',
      '{"condition":"minecraft:entity_properties","entity":"this","predicate":{"components":{"minecraft:custom_model_data":5}}}');

    const on = await base(f.dir);
    assert.equal(on.report.summary.knownFalsePositives, 3);
    assert.ok(on.report.summary.errors + on.report.summary.warnings === 0);

    const off = await base(f.dir, { falsePositives: false });
    assert.equal(off.report.summary.knownFalsePositives, 0);
    assert.ok(off.report.summary.errors >= 3, JSON.stringify(off.report.issues));
  } finally { f.cleanup(); }
});

test('zero-variable $ macro lines are valid in-game and still macro-scanned', async () => {
  const f = tmp('dpkit-macro0-');
  try {
    write(f.dir, 'pack.mcmeta', '{"pack":{"pack_format":107,"description":"x"}}');
    write(f.dir, 'data/test/function/a.mcfunction', '$execute run effect give @s minecraft:knockback\n');
    const r = await base(f.dir);
    assert.ok(r.report.ignored.some(i => i.message.includes('macro-line-no-arguments')), JSON.stringify(r.report.ignored));
    assert.ok(r.report.issues.some(i => i.message.includes('[macro] registry') && i.message.includes('minecraft:knockback')), JSON.stringify(r.report.issues));
    assert.ok(!r.report.issues.some(i => i.message.includes('Expected at least one macro argument')));
  } finally { f.cleanup(); }
});

test('delta report exposes baseline/current/new/resolved error-warning counts', async () => {
  const f = tmp('dpkit-delta-');
  try {
    write(f.dir, 'pack.mcmeta', '{"pack":{"pack_format":107,"description":"x"}}');
    write(f.dir, 'data/test/function/a.mcfunction', 'effect give @s minecraft:knockback\n');
    const baselineFile = join(f.dir, 'base.json');
    const first = await base(f.dir, { delta: true, baselineFile });
    assert.deepEqual(first.report.delta.current, { errors: 0, warnings: 1 });
    assert.deepEqual(first.report.delta.current, { errors: 0, warnings: 1 });

    const second = await base(f.dir, { delta: true, baselineFile });
    assert.deepEqual(second.report.delta.baseline, { errors: 0, warnings: 1 });
    assert.deepEqual(second.report.delta.current, { errors: 0, warnings: 1 });
    assert.deepEqual(second.report.delta.new, { errors: 0, warnings: 0 });
    assert.deepEqual(second.report.delta.resolved, { errors: 0, warnings: 0 });
    const raw = JSON.parse(readFileSync(baselineFile, 'utf8'));
    assert.equal(raw.formatVersion, 2);
  } finally { f.cleanup(); }
});

test('cache-miss=fail exits with the stable environment code instead of a misleading report', async () => {
  const f = tmp('dpkit-cache-');
  try {
    write(f.dir, 'pack.mcmeta', '{"pack":{"pack_format":107,"description":"x"}}');
    write(f.dir, 'data/test/function/a.mcfunction', 'say hi\n');
    await assert.rejects(
      () => base(f.dir, { version: '9.99', cacheMiss: 'fail' }),
      (err) => err instanceof DpkitError && err.exitCode === 2 && /not cached locally/.test(err.message),
    );
  } finally { f.cleanup(); }
});
