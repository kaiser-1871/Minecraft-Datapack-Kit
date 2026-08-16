// workspace-resource-pack.test.mjs — P2 acceptance: auxiliary datapacks are read-only symbol
// providers; resource packs only contribute sounds/font/lang symbols and are never validated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkDatapack } from '../../dist/api.js';

function write(root, rel, text) {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, text);
}

function tmp(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function datapack(dir, files = {}) {
  write(dir, 'pack.mcmeta', '{"pack":{"pack_format":107,"description":"x"}}');
  for (const [rel, text] of Object.entries(files)) write(dir, rel, text);
}

const opts = (dir, extra = {}) => checkDatapack({
  datapack: dir, version: '26.2', engine: 'inproc', noLog: true, noGotchas: true, noEntityNbt: true,
  ignore: { useIgnore: true, extra: [] }, ...extra,
});

test('workspace datapacks resolve cross-pack function/tag/predicate symbols without being checked', async () => {
  const main = tmp('dpkit-ws-main-');
  const other = tmp('dpkit-ws-other-');
  try {
    datapack(main.dir, { 'data/test/function/a.mcfunction': 'function animated_java:hello\nfunction #animated_java:tag1\nexecute if predicate animated_java:p run say ok\n' });
    datapack(other.dir, {
      'data/animated_java/function/hello.mcfunction': 'say hi\n',
      'data/animated_java/tags/function/tag1.json': '{"values":[]}',
      'data/animated_java/predicate/p.json': '{"condition":"minecraft:random_chance","chance":0.5}',
    });

    const { report } = await opts(main.dir, { workspace: [other.dir] });
    assert.equal(report.summary.errors, 0);
    assert.equal(report.summary.warnings, 0);
    assert.equal(report.summary.symbolsResolved, 3);
    assert.equal(report.resolvedSymbols.length, 3);
    for (const r of report.resolvedSymbols) {
      assert.equal(r.source, 'workspace');
      assert.equal(r.pack, other.dir);
      assert.match(r.note, /resolved from workspace datapack/);
    }
    // Workspace packs are providers only: their files were never added to the checked set.
    assert.equal(report.files.checked, 2); // a.mcfunction + pack.mcmeta of the MAIN pack only

    const without = await opts(main.dir);
    assert.equal(without.report.summary.errors, 0);
    assert.equal(without.report.summary.warnings, 0);
    assert.ok(without.report.scopeHints.length >= 3, 'missing cross-pack symbols should be scope hints');
    assert.ok(without.report.issues.every(i => !i.message.includes('animated_java')), JSON.stringify(without.report.issues));
  } finally {
    main.cleanup(); other.cleanup();
  }
});

test('resource packs resolve sound_event symbols and are labelled read-only', async () => {
  const main = tmp('dpkit-rp-main-');
  const rp = tmp('dpkit-rp-');
  try {
    datapack(main.dir, { 'data/test/function/a.mcfunction': 'playsound minecraft:custom.test master @s\n' });
    write(rp.dir, 'assets/minecraft/sounds.json', '{"custom.test":{"sounds":[]}}');
    write(rp.dir, 'assets/minecraft/font/myfont.json', '{}');
    write(rp.dir, 'assets/minecraft/lang/en_us.json', '{"mymod.key":"Hello"}');

    const { report } = await opts(main.dir, { resourcePacks: [rp.dir] });
    assert.equal(report.summary.errors, 0);
    assert.equal(report.summary.warnings, 0);
    assert.equal(report.summary.symbolsResolved, 1);
    assert.equal(report.resolvedSymbols[0].source, 'resource-pack');
    assert.equal(report.resolvedSymbols[0].note, 'resolved from resource pack (auxiliary symbol only, not validated)');
  } finally {
    main.cleanup(); rp.cleanup();
  }
});
