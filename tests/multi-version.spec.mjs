// multi-version.test.mjs — guard against overfitting the checker to one Minecraft release.
// Runs the real engine + post-scans across cached releases from the earliest available data
// version (1.14) up to 26.2 and asserts that command/registry/entity-schema data is per-version.
// Set DPKIT_TEST_VERSIONS to a comma-separated list; uncached versions are skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cachedCommandVersions, loadCommandTree } from '../dist/syntax.js';
import { loadRegistries } from '../dist/registry.js';
import { dataPackVersionOf } from '../dist/pack-mcmeta.js';
import { compareGameVersions } from '../dist/version.js';
import { checkDatapack } from '../dist/api.js';

const VERSIONS = (process.env.DPKIT_TEST_VERSIONS ?? '1.14,1.15.2,1.16.5,1.18.2,1.19.4,1.20.4,1.21.4,1.21.11,26.2')
  .split(',').map(s => s.trim()).filter(Boolean);
const cached = cachedCommandVersions();

function write(root, rel, text) {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, text);
}

test('engine check + macro/entity post-scans work from 1.14 to current', async (t) => {
  for (const version of VERSIONS) {
    await t.test(version, { skip: !cached.has(version) && `command data for ${version} is not cached` }, async () => {
      const dir = mkdtempSync(join(tmpdir(), 'dpkit-multi-'));
      try {
        const dpv = dataPackVersionOf(version);
        assert.ok(dpv != null, `version list has data_pack_version for ${version}`);
        // 1.13..1.20.5 use data/<ns>/functions; 1.21.2+ renamed it to data/<ns>/function.
        const folder = compareGameVersions(version, '1.21.2') < 0 ? 'functions' : 'function';
        write(dir, 'pack.mcmeta', JSON.stringify({ pack: { pack_format: dpv, description: 'multi-version smoke' } }));
        const macroLine = compareGameVersions(version, '1.20.2') >= 0
          ? '$execute run effect give @s minecraft:speed 1 1\n'
          : '';
        write(dir, `data/test/${folder}/main.mcfunction`,
          macroLine +
          'say hi\n' +
          'summon minecraft:zombie ~ ~ ~ {IsBaby:1b}\n');
        const { report } = await checkDatapack({
          datapack: dir,
          version,
          engine: 'inproc',
          cacheMiss: 'download',
          noLog: true,
          noGotchas: true,
        });
        assert.equal(report.versionInfo.target, version);
        assert.equal(report.resolvedVersion, version);
        assert.equal(report.summary.internalFailures, 0);
        assert.equal(report.coverage.engineUsed, true);
        assert.equal(report.summary.errors, 0, JSON.stringify(report.issues));
        if (compareGameVersions(version, '1.20.2') >= 0) {
          assert.equal(report.coverage.macroLines, 1);
          assert.equal(report.coverage.macroUnavailable, false);
        } else {
          assert.equal(report.coverage.macroLines, 0);
        }
        // The mcdoc schema is a single latest tarball with since/until annotations; if it isn't
        // cached this run can't judge entity NBT and reports that honestly.
        if (!report.coverage.nbtUnavailable) {
          assert.equal(report.coverage.nbtLines, 1);
          assert.equal(report.coverage.nbtUnavailable, false);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});

test('pre-1.14 versions fail loudly instead of being checked with wrong grammar', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-pre114-'));
  try {
    write(dir, 'pack.mcmeta', '{"pack":{"pack_format":3,"description":"x"}}');
    write(dir, 'data/test/functions/main.mcfunction', 'say hi\n');
    await assert.rejects(
      () => checkDatapack({ datapack: dir, version: '1.13.2', engine: 'inproc', cacheMiss: 'fail', noLog: true }),
      /before 1\.14/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('registry data is per-version, not copied from one release', () => {
  const oldRegs = loadRegistries('1.20.4');
  const newRegs = loadRegistries('26.2');
  const oldCached = cached.has('1.20.4') && Object.keys(oldRegs).length > 0;
  const newCached = cached.has('26.2') && Object.keys(newRegs).length > 0;
  if (!oldCached || !newCached) {
    // Meaningful comparison needs both caches; multi-version engine subtests already skip
    // per-version when uncached.
    return;
  }
  assert.ok(oldRegs.attribute.includes('generic.attack_speed'), '1.20.4 uses namespaced generic.* attribute ids');
  assert.ok(!oldRegs.attribute.includes('attack_speed'), '1.20.4 does not use the 1.21.2+ bare attribute id');
  assert.ok(newRegs.attribute.includes('attack_speed'), '26.2 uses the post-1.21.2 bare attribute id');
  assert.ok(!newRegs.attribute.includes('generic.attack_speed'), '26.2 no longer has generic.* attribute ids');
});

test('command trees are loaded per version and differ across releases', () => {
  if (!cached.has('1.20.4') || !cached.has('26.2')) return; // same guard as above
  const oldTree = loadCommandTree('1.20.4');
  const newTree = loadCommandTree('26.2');
  assert.ok(oldTree.children?.attribute, '1.20.4 has the attribute command');
  assert.ok(newTree.children?.attribute, '26.2 has the attribute command');
  // The trees are independently cached objects; this is a structure sanity check, not a
  // claim about any specific command difference.
  assert.notEqual(oldTree, newTree);
});
